import { readIndex } from '../../../lib/rssStore';

/**
 * GET /api/rss/items
 *
 * Query parameters:
 *   source  — filter by feed source name (optional)
 *   search  — full-text search in title and description (optional)
 *   limit   — items per page, max 100, default 20
 *   page    — page number, default 1
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const { source, search, limit = '20', page = '1' } = req.query;

  let items = await readIndex();

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

  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const pageNum  = Math.max(1, parseInt(page, 10) || 1);
  const total    = items.length;
  const start    = (pageNum - 1) * limitNum;

  return res.status(200).json({
    items: items.slice(start, start + limitNum),
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum),
    },
  });
}
