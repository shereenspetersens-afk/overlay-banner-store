import { readIndex, writeIndex, storeImage } from '../../../lib/rssStore';

/**
 * POST /api/rss/store
 *
 * Designed to be called from Make (Integromat) or any HTTP client.
 *
 * Headers:
 *   x-api-key: <RSS_STORE_SECRET env var>   (required if secret is set)
 *
 * Body (JSON):
 * {
 *   "imageUrl":    "https://example.com/image.jpg",  // required
 *   "title":       "Article title",                   // required
 *   "description": "Article description...",          // optional
 *   "source":      "my-feed-name"                     // optional, default: "default"
 * }
 *
 * Response 201:
 * { "success": true, "item": { id, source, title, description, imageUrl, originalImageUrl, storedAt } }
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // Optional secret-key auth — set RSS_STORE_SECRET env var to enable
  const secret = process.env.RSS_STORE_SECRET;
  if (secret) {
    const provided = req.headers['x-api-key'] || req.query.secret;
    if (!provided || provided !== secret) {
      return res.status(401).json({ error: 'Unauthorized. Provide x-api-key header.' });
    }
  }

  const { imageUrl, title, description = '', source = 'default' } = req.body || {};

  if (!imageUrl || !title) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['imageUrl', 'title'],
      optional: ['description', 'source'],
      example: {
        imageUrl: 'https://example.com/image.jpg',
        title: 'My Article',
        description: 'Optional description',
        source: 'my-rss-feed',
      },
    });
  }

  // Validate imageUrl is a real URL
  try {
    new URL(imageUrl);
  } catch {
    return res.status(400).json({ error: 'imageUrl is not a valid URL' });
  }

  // Sanitize source name to be safe for use as a folder path
  const safeSrc = source.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase().slice(0, 64);
  const id = crypto.randomUUID();

  // Download and persist image to Vercel Blob
  const storedImageUrl = await storeImage(imageUrl, safeSrc, id);

  const item = {
    id,
    source: safeSrc,
    title: title.trim().slice(0, 500),
    description: description.trim().slice(0, 5000),
    imageUrl: storedImageUrl || imageUrl, // fallback to original URL if store failed
    originalImageUrl: imageUrl,
    storedAt: new Date().toISOString(),
  };

  // Prepend to index so newest items appear first
  const items = await readIndex();
  items.unshift(item);
  await writeIndex(items);

  return res.status(201).json({ success: true, item });
}
