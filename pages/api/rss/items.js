import { readIndex, writeIndex } from '../../../lib/rssStore';

/**
 * GET /api/rss/items
 *
 * Query parameters:
 *   source   — filter by feed source name (optional)
 *   search   — full-text search in title and description (optional)
 *   used     — "true" → only items already used; "false" → only unused (optional)
 *   limit    — items per page, max 100, default 20
 *   page     — page number, default 1
 *   markUsed — "true" → also flip the returned items to used=true (write op).
 *              Requires x-api-key (or ?secret=) when RSS_STORE_SECRET is set.
 *
 * Response 200:
 * {
 *   "items": [...],
 *   "pagination": { "total", "page", "limit", "pages" }
 * }
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const { source, search, limit = '20', page = '1', used, markUsed } = req.query;

  const allItems = await readIndex();
  let items = allItems;

  if (source) {
    items = items.filter((item) => item.source === source);
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
