import { readIndex, writeIndex, deleteImageBlob } from '../../../../lib/rssStore';

/**
 * GET    /api/rss/item/[id]  — retrieve a single RSS item by ID
 * DELETE /api/rss/item/[id]  — remove an item and its stored image
 *
 * DELETE requires x-api-key header matching RSS_STORE_SECRET env var.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
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

  if (req.method === 'DELETE') {
    const secret = process.env.RSS_STORE_SECRET;
    if (secret) {
      const provided = req.headers['x-api-key'] || req.query.secret;
      if (!provided || provided !== secret) {
        return res.status(401).json({ error: 'Unauthorized. Provide x-api-key header.' });
      }
    }

    const [removed] = items.splice(itemIndex, 1);
    await writeIndex(items);
    await deleteImageBlob(removed.imageUrl);

    return res.status(200).json({ success: true, deleted: removed });
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
