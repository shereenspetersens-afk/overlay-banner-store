import { readIndex, writeIndex, deleteImageBlob } from '../../../../lib/rssStore';
import { parseJsonBody } from '../../../../lib/parseBody';

export const config = { api: { bodyParser: false } };

const isAuthorized = (req) => {
  const secret = process.env.RSS_STORE_SECRET;
  if (!secret) return true;
  const provided = req.headers['x-api-key'] || req.query.secret;
  return provided === secret;
};

const sanitizeSource = (s) =>
  String(s || '').replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase().slice(0, 64);

/**
 * GET    /api/rss/item/[id]  — retrieve a single RSS item by ID
 * PATCH  /api/rss/item/[id]  — update title / description / source
 * DELETE /api/rss/item/[id]  — remove an item and its stored image
 *
 * PATCH and DELETE require x-api-key header matching RSS_STORE_SECRET env var.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  const items = await readIndex();
  const itemIndex = items.findIndex((i) => i.id === id);

  if (itemIndex === -1) {
    return res.status(404).json({ error: 'Item not found', id });
  }

  if (req.method === 'GET') {
    return res.status(200).json(items[itemIndex]);
  }

  if (req.method === 'PATCH') {
    if (!isAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized. Provide x-api-key header.' });
    }

    let body;
    try {
      body = await parseJsonBody(req);
    } catch (err) {
      return res.status(400).json({ error: 'Could not parse request body as JSON', details: err.message });
    }

    const current = items[itemIndex];
    const updated = { ...current };

    if (typeof body.title === 'string')       updated.title = body.title.trim().slice(0, 1000);
    if (typeof body.description === 'string') updated.description = body.description.trim().slice(0, 20000);
    if (typeof body.source === 'string' && body.source.trim()) {
      updated.source = sanitizeSource(body.source);
    }
    if (typeof body.used === 'boolean') {
      updated.used   = body.used;
      updated.usedAt = body.used ? new Date().toISOString() : null;
    }

    items[itemIndex] = updated;
    await writeIndex(items);
    return res.status(200).json({ success: true, item: updated });
  }

  if (req.method === 'DELETE') {
    if (!isAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized. Provide x-api-key header.' });
    }

    const [removed] = items.splice(itemIndex, 1);
    await writeIndex(items);
    await deleteImageBlob(removed.imageUrl);

    return res.status(200).json({ success: true, deleted: removed });
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
