import { readIndex, writeIndex, deleteImageBlob } from '../../../lib/rssStore';
import { parseJsonBody } from '../../../lib/parseBody';

export const config = { api: { bodyParser: false } };

const isAuthorized = (req) => {
  const secret = process.env.RSS_STORE_SECRET;
  if (!secret) return true;
  const provided = req.headers['x-api-key'] || req.query.secret;
  return provided === secret;
};

const sanitizeSource = (s) =>
  String(s || '').replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase().slice(0, 64);

function parseList(value) {
  if (value == null) return [];
  const arr = Array.isArray(value) ? value : String(value).split(',');
  return [...new Set(arr.map((s) => String(s).trim()).filter(Boolean))];
}

function parseDate(value) {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

/**
 * Apply the caption / source patch to a single item.
 * Supported patch fields (all optional):
 *   source           — overwrite source (sanitized)
 *   title            — overwrite title
 *   titlePrefix      — prepend to title
 *   titleSuffix      — append to title
 *   titleReplace     — { find, replace, flags? } find/replace on title
 *   description      — overwrite description
 *   descriptionPrefix
 *   descriptionSuffix
 *   descriptionReplace — { find, replace, flags? }
 */
function applyPatch(item, patch) {
  const next = { ...item };

  if (typeof patch.source === 'string' && patch.source.trim()) {
    next.source = sanitizeSource(patch.source);
  }

  if (typeof patch.used === 'boolean') {
    next.used   = patch.used;
    next.usedAt = patch.used ? new Date().toISOString() : null;
  }

  let title = next.title || '';
  if (typeof patch.title === 'string')       title = patch.title;
  if (patch.titleReplace && patch.titleReplace.find != null) {
    const { find, replace = '', flags = 'g' } = patch.titleReplace;
    try { title = title.replace(new RegExp(find, flags), replace); } catch { /* invalid regex */ }
  }
  if (typeof patch.titlePrefix === 'string') title = patch.titlePrefix + title;
  if (typeof patch.titleSuffix === 'string') title = title + patch.titleSuffix;
  next.title = title.trim().slice(0, 1000);

  let desc = next.description || '';
  if (typeof patch.description === 'string') desc = patch.description;
  if (patch.descriptionReplace && patch.descriptionReplace.find != null) {
    const { find, replace = '', flags = 'g' } = patch.descriptionReplace;
    try { desc = desc.replace(new RegExp(find, flags), replace); } catch { /* invalid regex */ }
  }
  if (typeof patch.descriptionPrefix === 'string') desc = patch.descriptionPrefix + desc;
  if (typeof patch.descriptionSuffix === 'string') desc = desc + patch.descriptionSuffix;
  next.description = desc.trim().slice(0, 20000);

  return next;
}

/**
 * POST /api/rss/batch
 *
 * Body:
 * {
 *   "action": "update" | "delete",       (default "update")
 *   "ids": ["...", "..."],               (required unless "all": true)
 *   "all": false,                        (optional — target all items)
 *   "source": "a" | "a,b" | ["a","b"],   (optional — restrict to matching sources)
 *   "sources": ["a","b"],                (alias for "source")
 *   "search": "text",                    (optional — full-text filter on title+description)
 *   "used": true | false,                (optional — restrict by used flag)
 *   "from": "ISO", "to": "ISO",          (optional — storedAt range)
 *   "usedFrom": "ISO", "usedTo": "ISO",  (optional — usedAt range)
 *   "patch": { ... }                     (required for "update")
 * }
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized. Provide x-api-key header.' });
  }

  let body;
  try {
    body = await parseJsonBody(req);
  } catch (err) {
    return res.status(400).json({ error: 'Could not parse request body as JSON', details: err.message });
  }

  const {
    action = 'update',
    ids,
    all = false,
    source: sourceFilter,
    sources: sourcesFilter,
    search,
    used: usedFilter,
    from, to, usedFrom, usedTo,
    patch,
  } = body || {};

  if (!['update', 'delete'].includes(action)) {
    return res.status(400).json({ error: 'action must be "update" or "delete"' });
  }

  const items = await readIndex();

  const idSet     = Array.isArray(ids) ? new Set(ids) : null;
  const sourceSet = new Set(parseList(sourcesFilter ?? sourceFilter));
  const q         = typeof search === 'string' && search.trim() ? search.trim().toLowerCase() : null;
  const fromMs    = parseDate(from);
  const toRaw     = to && /^\d{4}-\d{2}-\d{2}$/.test(String(to)) ? `${to}T23:59:59.999Z` : to;
  const toMs      = parseDate(toRaw);
  const usedFromMs = parseDate(usedFrom);
  const usedToRaw  = usedTo && /^\d{4}-\d{2}-\d{2}$/.test(String(usedTo)) ? `${usedTo}T23:59:59.999Z` : usedTo;
  const usedToMs   = parseDate(usedToRaw);

  const matches = (item) => {
    if (idSet && !idSet.has(item.id)) return false;
    if (!idSet && !all) return false;
    if (sourceSet.size > 0 && !sourceSet.has(item.source)) return false;
    if (typeof usedFilter === 'boolean' && !!item.used !== usedFilter) return false;
    if (q) {
      const hay = `${item.title || ''}\n${item.description || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (fromMs != null && Date.parse(item.storedAt) < fromMs) return false;
    if (toMs   != null && Date.parse(item.storedAt) > toMs)   return false;
    if (usedFromMs != null && (!item.usedAt || Date.parse(item.usedAt) < usedFromMs)) return false;
    if (usedToMs   != null && (!item.usedAt || Date.parse(item.usedAt) > usedToMs))   return false;
    return true;
  };

  if (!idSet && !all) {
    return res.status(400).json({ error: 'Provide "ids" array or set "all": true' });
  }

  if (action === 'delete') {
    const kept = [];
    const removed = [];
    for (const item of items) {
      if (matches(item)) removed.push(item); else kept.push(item);
    }
    if (removed.length === 0) {
      return res.status(200).json({ success: true, updated: 0, items: [] });
    }
    await writeIndex(kept);
    await Promise.all(removed.map((r) => deleteImageBlob(r.imageUrl)));
    return res.status(200).json({ success: true, deleted: removed.length, items: removed });
  }

  // action === 'update'
  if (!patch || typeof patch !== 'object') {
    return res.status(400).json({ error: '"patch" object is required for update' });
  }

  const updatedItems = [];
  const next = items.map((item) => {
    if (!matches(item)) return item;
    const updated = applyPatch(item, patch);
    updatedItems.push(updated);
    return updated;
  });

  if (updatedItems.length === 0) {
    return res.status(200).json({ success: true, updated: 0, items: [] });
  }

  await writeIndex(next);
  return res.status(200).json({ success: true, updated: updatedItems.length, items: updatedItems });
}
