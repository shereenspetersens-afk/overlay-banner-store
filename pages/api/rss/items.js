import { readIndex, writeIndex } from '../../../lib/rssStore';

// Split "a,b,c" or repeated params into a deduped array of trimmed values
function parseList(value) {
  if (value == null) return [];
  const arr = Array.isArray(value) ? value : String(value).split(',');
  return [...new Set(arr.map((s) => String(s).trim()).filter(Boolean))];
}

// Parse an ISO/date string into an epoch ms; returns null on failure
function parseDate(value) {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

/**
 * GET /api/rss/items
 *
 * Query parameters:
 *   source    — one source, or comma-separated list (also accepts `sources`)
 *   search    — full-text search in title and description
 *   used      — "true" → only used; "false" → only unused
 *   from,to   — inclusive date range on storedAt (ISO or YYYY-MM-DD)
 *   usedFrom,usedTo — inclusive date range on usedAt
 *   limit     — items per page, max 100, default 20
 *   page      — page number, default 1
 *   markUsed  — "true" → flip returned items to used=true (requires x-api-key)
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const {
    source, sources, search,
    limit = '20', page = '1',
    used, markUsed,
    from, to, usedFrom, usedTo,
  } = req.query;

  const allItems = await readIndex();
  let items = allItems;

  const sourceList = parseList(sources ?? source);
  if (sourceList.length > 0) {
    const set = new Set(sourceList);
    items = items.filter((item) => set.has(item.source));
  }

  if (search) {
    const q = search.toLowerCase();
    items = items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
    );
  }

  if (used === 'true')  items = items.filter((i) => !!i.used);
  if (used === 'false') items = items.filter((i) => !i.used);

  const fromMs = parseDate(from);
  // Treat plain YYYY-MM-DD in `to` as end-of-day so ranges are inclusive
  const toRaw  = to && /^\d{4}-\d{2}-\d{2}$/.test(String(to)) ? `${to}T23:59:59.999Z` : to;
  const toMs   = parseDate(toRaw);
  if (fromMs != null) items = items.filter((i) => Date.parse(i.storedAt) >= fromMs);
  if (toMs   != null) items = items.filter((i) => Date.parse(i.storedAt) <= toMs);

  const usedFromMs = parseDate(usedFrom);
  const usedToRaw  = usedTo && /^\d{4}-\d{2}-\d{2}$/.test(String(usedTo)) ? `${usedTo}T23:59:59.999Z` : usedTo;
  const usedToMs   = parseDate(usedToRaw);
  if (usedFromMs != null) items = items.filter((i) => i.usedAt && Date.parse(i.usedAt) >= usedFromMs);
  if (usedToMs   != null) items = items.filter((i) => i.usedAt && Date.parse(i.usedAt) <= usedToMs);

  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const pageNum  = Math.max(1, parseInt(page, 10) || 1);
  const total    = items.length;
  const start    = (pageNum - 1) * limitNum;
  const returned = items.slice(start, start + limitNum);

  if (markUsed === 'true' && returned.length > 0) {
    const secret = process.env.RSS_STORE_SECRET;
    if (secret) {
      const provided = req.headers['x-api-key'] || req.query.secret;
      if (provided !== secret) {
        return res.status(401).json({ error: 'markUsed requires x-api-key' });
      }
    }
    const ids = new Set(returned.map((i) => i.id));
    const now = new Date().toISOString();
    const nextIndex = allItems.map((i) =>
      ids.has(i.id) ? { ...i, used: true, usedAt: now } : i
    );
    await writeIndex(nextIndex);
    for (const item of returned) { item.used = true; item.usedAt = now; }
  }

  return res.status(200).json({
    items: returned,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum),
    },
  });
}
