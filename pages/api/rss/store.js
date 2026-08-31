import { readIndex, writeIndex, storeImage } from '../../../lib/rssStore';
import { parseJsonBody } from '../../../lib/parseBody';

export const config = { api: { bodyParser: false } };

// Auth helper — returns true when the request is allowed to proceed
function isAuthorized(req) {
  const secret = process.env.RSS_STORE_SECRET;
  if (!secret) return true;
  const provided = req.headers['x-api-key'] || req.query.secret;
  return provided === secret;
}

// Build and persist one item; returns the saved item object
async function storeOne({ imageUrl, title, description = '', source = 'default' }) {
  new URL(imageUrl); // throws if invalid
  const safeSrc = source.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase().slice(0, 64);
  const id = crypto.randomUUID();
  const storedImageUrl = await storeImage(imageUrl, safeSrc, id);
  return {
    id,
    source: safeSrc,
    title: title.trim().slice(0, 1000),
    description: description.trim().slice(0, 20000),
    imageUrl: storedImageUrl || imageUrl,
    originalImageUrl: imageUrl,
    storedAt: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET: return all stored items ──────────────────────────────────────────
  if (req.method === 'GET') {
    const items = await readIndex();
    return res.status(200).json({ success: true, total: items.length, items });
  }

  // ── POST: store one item or a batch ──────────────────────────────────────
  if (req.method === 'POST') {
    if (!isAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized. Provide x-api-key header.' });
    }

    const body = await parseJsonBody(req);

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
          optional: ['description', 'source'],
        });
      }
      try { new URL(entry.imageUrl); } catch {
        return res.status(400).json({ error: `Item at index ${i} has an invalid imageUrl` });
      }
    }

    // Build all items (image uploads run in parallel per batch)
    const newItems = await Promise.all(inputs.map(storeOne));

    // Prepend newest items first
    const existing = await readIndex();
    await writeIndex([...newItems, ...existing]);

    if (newItems.length === 1) {
      return res.status(201).json({ success: true, item: newItems[0] });
    }
    return res.status(201).json({ success: true, count: newItems.length, items: newItems });
  }

  return res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });
}
