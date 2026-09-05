import { readIndex, writeIndex, storeImage } from '../../../lib/rssStore';
import { parseJsonBody } from '../../../lib/parseBody';

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

// Auth helper — returns true when the request is allowed to proceed
function isAuthorized(req) {
  const secret = process.env.RSS_STORE_SECRET;
  if (!secret) return true;
  const provided = req.headers['x-api-key'] || req.query.secret;
  return provided === secret;
}

const isDataUrl = (u) => typeof u === 'string' && /^data:image\/[a-z0-9.+-]+;base64,/i.test(u);

function validateImageUrl(u) {
  if (isDataUrl(u)) return true;
  try { new URL(u); return true; } catch { return false; }
}

const sanitizeSource = (s) =>
  String(s || '').replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase().slice(0, 64);

// Accept `sources: []`, comma-separated `source: "a,b"`, or single string.
function normalizeSources(entry) {
  const raw = Array.isArray(entry.sources) && entry.sources.length
    ? entry.sources
    : String(entry.source ?? 'default').split(',');
  const cleaned = [...new Set(raw.map(sanitizeSource).filter(Boolean))];
  return cleaned.length ? cleaned : ['default'];
}

// Build and persist ONE item (single source); returns the saved item object
async function storeOneForSource({ imageUrl, title, description = '', source }) {
  const id = crypto.randomUUID();
  const storedImageUrl = await storeImage(imageUrl, source, id);
  return {
    id,
    source,
    title: title.trim().slice(0, 1000),
    description: description.trim().slice(0, 20000),
    imageUrl: storedImageUrl || (isDataUrl(imageUrl) ? null : imageUrl),
    originalImageUrl: isDataUrl(imageUrl) ? null : imageUrl,
    storedAt: new Date().toISOString(),
    used: false,
    usedAt: null,
  };
}

// Fan an input entry out to one saved item per source
async function storeEntry(entry) {
  if (!validateImageUrl(entry.imageUrl)) throw new Error('Invalid imageUrl');
  const sources = normalizeSources(entry);
  return Promise.all(
    sources.map((source) =>
      storeOneForSource({
        imageUrl: entry.imageUrl,
        title: entry.title,
        description: entry.description,
        source,
      })
    )
  );
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, application/x-www-form-urlencoded');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // ── GET: return all stored items ────────────────────────────────────────
    if (req.method === 'GET') {
      const items = await readIndex();
      return res.status(200).json({ success: true, total: items.length, items });
    }

    // ── POST: store one item or a batch (each can fan out to multiple sources) ─
    if (req.method === 'POST') {
      if (!isAuthorized(req)) {
        return res.status(401).json({ error: 'Unauthorized. Provide x-api-key header.' });
      }

      let body;
      try {
        body = await parseJsonBody(req);
      } catch (err) {
        return res.status(400).json({ error: 'Could not parse request body as JSON', details: err.message });
      }

      // Accept either a single object or an array for batch inserts
      const inputs = Array.isArray(body) ? body : [body];

      if (inputs.length === 0) {
        return res.status(400).json({ error: 'Body must be a non-empty object or array.' });
      }

      // Validate all entries before writing anything
      for (const [i, entry] of inputs.entries()) {
        if (!entry.imageUrl || !entry.title) {
          return res.status(400).json({
            error: `Item at index ${i} is missing required fields`,
            required: ['imageUrl', 'title'],
            optional: ['description', 'source', 'sources'],
          });
        }
        if (!validateImageUrl(entry.imageUrl)) {
          return res.status(400).json({ error: `Item at index ${i} has an invalid imageUrl` });
        }
      }

      // Build all items; each entry may fan out to N items (one per source)
      const nestedItems = await Promise.all(inputs.map(storeEntry));
      const newItems = nestedItems.flat();

      // Prepend newest items first
      const existing = await readIndex();
      await writeIndex([...newItems, ...existing]);

      if (newItems.length === 1) {
        return res.status(201).json({ success: true, item: newItems[0] });
      }
      return res.status(201).json({ success: true, count: newItems.length, items: newItems });
    }

    return res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });

  } catch (err) {
    console.error('rss/store unhandled error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
