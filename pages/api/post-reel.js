// Instagram Reels auto-poster via the Meta Graph API.
// Handles the full 3-step flow: create container → poll status → publish.
//
// Required query params (GET) or body fields (POST):
//   token        - Instagram Page Access Token
//   ig_user_id   - Numeric Instagram Business/Creator account ID
//   video_url    - Publicly accessible mp4 URL (e.g. /api/reel?video=... from this same app)
//   caption      - (optional) Reel caption / hashtags
//
// Example:
//   POST /api/post-reel
//   { "token": "...", "ig_user_id": "12345", "video_url": "https://...", "caption": "Hello!" }

export const runtime = 'nodejs';

const GRAPH_BASE = 'https://graph.facebook.com/v19.0';

// How long to wait for the video to finish uploading (ms)
const UPLOAD_TIMEOUT_MS = 4 * 60 * 1000; // 4 minutes
const POLL_INTERVAL_MS = 6000;            // 6 seconds between polls

async function graphPost(endpoint, body) {
  const res = await fetch(`${GRAPH_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    const msg = data.error?.message || `Graph API HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

async function graphGet(endpoint, token) {
  const url = `${GRAPH_BASE}${endpoint}&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || data.error) {
    const msg = data.error?.message || `Graph API HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

// Poll the creation_id until status_code is FINISHED (or timeout / error)
async function pollUntilFinished(creationId, token) {
  const deadline = Date.now() + UPLOAD_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const data = await graphGet(`/${creationId}?fields=status_code`, token);
    const status = data.status_code;
    console.log(`📊 Upload status: ${status}`);

    if (status === 'FINISHED') return;
    if (status === 'ERROR' || status === 'EXPIRED') {
      throw new Error(`Video upload failed with status: ${status}`);
    }
    // IN_PROGRESS — keep polling
  }

  throw new Error('Timed out waiting for video upload to finish.');
}

export default async function handler(req, res) {
  console.log('\n📤 === POST REEL API ===');
  console.log('Method:', req.method);

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Use GET or POST.' });
  }

  // Accept params from query string (GET) or JSON body (POST)
  const params = req.method === 'POST' ? (req.body || {}) : req.query;
  const { token, ig_user_id, video_url, caption = '' } = params;

  // ── Input validation ──────────────────────────────────────────────────────
  const missing = [];
  if (!token) missing.push('token');
  if (!ig_user_id) missing.push('ig_user_id');
  if (!video_url) missing.push('video_url');

  if (missing.length) {
    return res.status(400).json({
      error: `Missing required parameter(s): ${missing.join(', ')}`,
      required_params: {
        token: 'Instagram Page Access Token',
        ig_user_id: 'Numeric Instagram Business/Creator account ID',
        video_url: 'Publicly accessible mp4 URL',
      },
      optional_params: {
        caption: 'Reel caption / hashtags',
      },
      permissions_needed: [
        'instagram_basic',
        'instagram_content_publish',
        'pages_read_engagement',
      ],
      tip: 'Pass video_url as the URL of /api/reel?video=<your_mp4> to proxy through this service.',
    });
  }

  // Validate video_url format
  let parsedVideoUrl;
  try {
    parsedVideoUrl = new URL(video_url);
  } catch {
    return res.status(400).json({ error: 'video_url must be a valid http/https URL.' });
  }
  if (parsedVideoUrl.protocol !== 'http:' && parsedVideoUrl.protocol !== 'https:') {
    return res.status(400).json({ error: 'video_url must use http or https.' });
  }

  try {
    // ── Step 1: Create the Reels media container ──────────────────────────
    console.log('📦 Step 1: Creating Reels media container...');
    const containerBody = {
      media_type: 'REELS',
      video_url,
      access_token: token,
    };
    if (caption) containerBody.caption = caption;

    const container = await graphPost(`/${ig_user_id}/media`, containerBody);
    const creationId = container.id;
    console.log(`✅ Container created: ${creationId}`);

    // ── Step 2: Poll until upload is FINISHED ─────────────────────────────
    console.log('⏳ Step 2: Waiting for video upload to finish...');
    await pollUntilFinished(creationId, token);
    console.log('✅ Video upload finished.');

    // ── Step 3: Publish the Reel ──────────────────────────────────────────
    console.log('🚀 Step 3: Publishing Reel...');
    const published = await graphPost(`/${ig_user_id}/media_publish`, {
      creation_id: creationId,
      access_token: token,
    });
    const mediaId = published.id;
    console.log(`✅ Reel published! Media ID: ${mediaId}`);

    return res.status(200).json({
      success: true,
      media_id: mediaId,
      creation_id: creationId,
      message: 'Reel successfully published to Instagram.',
      instagram_media_url: `https://www.instagram.com/p/${mediaId}/`,
    });
  } catch (error) {
    console.error('❌ Post Reel error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to post Reel to Instagram.',
      message: error.message,
    });
  }
}
