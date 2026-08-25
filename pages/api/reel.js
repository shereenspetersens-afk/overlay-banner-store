import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

export const config = {
  api: {
    responseLimit: false,
  },
};

const RESOURCES_DIR = path.join(process.cwd(), 'public', 'resources');

const IG_REEL_REQUIREMENTS = {
  aspectRatio: '9:16 recommended (min 4:5, max 1.91:1)',
  minDurationSeconds: 3,
  maxDurationSeconds: 90,
  maxFileSizeBytes: 1073741824, // 1 GB
  containerFormat: 'mp4',
  videoCodec: 'H.264',
  audioCodec: 'AAC',
  maxWidth: 1080,
  maxHeight: 1920,
  minFrameRate: 23,
  maxFrameRate: 60,
};

// Only allow folder names that are simple slugs — prevents directory traversal
function sanitizeSegment(name) {
  return /^[a-zA-Z0-9_-]+$/.test(name) ? name : null;
}

// Only allow plain filenames with no separators
function sanitizeFilename(name) {
  const base = path.basename(name);
  return /^[a-zA-Z0-9_\-. ]+\.mp4$/i.test(base) ? base : null;
}

// Resolve a path and verify it stays inside RESOURCES_DIR
function safePath(...parts) {
  const resolved = path.resolve(RESOURCES_DIR, ...parts);
  if (!resolved.startsWith(RESOURCES_DIR + path.sep) && resolved !== RESOURCES_DIR) {
    throw new Error('Path traversal detected');
  }
  return resolved;
}

// List mp4 files directly inside a directory (non-recursive)
function listMp4s(dirPath) {
  return fs
    .readdirSync(dirPath)
    .filter((f) => /\.mp4$/i.test(f) && fs.statSync(path.join(dirPath, f)).isFile());
}

// ── /tmp state tracking (Vercel's filesystem is read-only; files cannot be moved) ──
// State file lives in /tmp which is writable on Vercel serverless functions.
// Caveat: /tmp is per-instance and resets on cold starts, which is acceptable for this use case.
const TMP_STATE_DIR = '/tmp';

function stateFilePath(folderName) {
  return path.join(TMP_STATE_DIR, `reel_served_${folderName}.json`);
}

function loadServedSet(folderName) {
  try {
    const raw = fs.readFileSync(stateFilePath(folderName), 'utf8');
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function saveServedSet(folderName, servedSet) {
  fs.writeFileSync(stateFilePath(folderName), JSON.stringify([...servedSet]));
}

function markAsServed(folderName, filename) {
  const served = loadServedSet(folderName);
  served.add(filename);
  saveServedSet(folderName, served);
  console.log(`✅ Marked as served: ${filename} (${served.size} total served)`);
}

// Pick a random unserved mp4; resets the cycle when all files have been served once
function pickRandomMp4(folderPath, folderName) {
  const allFiles = listMp4s(folderPath);
  if (allFiles.length === 0) return null;

  const served = loadServedSet(folderName);
  let available = allFiles.filter((f) => !served.has(f));

  if (available.length === 0) {
    // All files have been served — reset the cycle
    saveServedSet(folderName, new Set());
    available = allFiles;
    console.log(`🔄 Cycle reset: all ${allFiles.length} file(s) have been served, starting over`);
  }

  return available[Math.floor(Math.random() * available.length)];
}

// Stream a local mp4 and mark it served once the response finishes
function streamLocalFile(filePath, folderName, res) {
  return new Promise((resolve, reject) => {
    const stat = fs.statSync(filePath);

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', String(stat.size));
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);

    stream.on('error', reject);
    res.on('finish', () => {
      try {
        markAsServed(folderName, path.basename(filePath));
      } catch (err) {
        console.error('❌ Failed to update served state:', err.message);
      }
      resolve();
    });
    res.on('error', reject);
  });
}

// Resolve redirects and stream video from a remote URL
function streamVideoFromUrl(videoUrl, res, redirectCount = 0) {
  if (redirectCount > 5) {
    throw new Error('Too many redirects');
  }

  return new Promise((resolve, reject) => {
    const protocol = videoUrl.startsWith('https') ? https : http;

    protocol.get(videoUrl, (upstream) => {
      const { statusCode, headers } = upstream;

      if (statusCode === 301 || statusCode === 302 || statusCode === 307 || statusCode === 308) {
        upstream.resume(); // drain
        const location = headers.location;
        if (!location) return reject(new Error('Redirect without Location header'));
        return streamVideoFromUrl(location, res, redirectCount + 1).then(resolve).catch(reject);
      }

      if (statusCode !== 200) {
        upstream.resume();
        return reject(new Error(`Upstream returned HTTP ${statusCode}`));
      }

      // Serve with proper video headers so Instagram can consume this URL
      res.setHeader('Content-Type', headers['content-type'] || 'video/mp4');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      if (headers['content-length']) {
        res.setHeader('Content-Length', headers['content-length']);
      }

      upstream.pipe(res);
      upstream.on('end', resolve);
      upstream.on('error', reject);
    }).on('error', reject);
  });
}

// Build this endpoint's own URL (used as video_url for Instagram)
function buildSelfUrl(req, params) {
  const host = req.headers.host || 'localhost:3000';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const qs = new URLSearchParams(params).toString();
  return `${proto}://${host}/api/reel?${qs}`;
}

const IG_POSTING_STEPS = (videoUrl, caption) => [
  {
    step: 1,
    action: 'Create Reels media container',
    method: 'POST',
    endpoint: 'https://graph.facebook.com/v19.0/{ig-user-id}/media',
    body: {
      media_type: 'REELS',
      video_url: videoUrl,
      caption: caption || '<your caption here>',
      access_token: '<YOUR_PAGE_ACCESS_TOKEN>',
    },
    response: 'Returns { id: "<creation_id>" }. Save the creation_id.',
  },
  {
    step: 2,
    action: 'Poll upload status until FINISHED',
    method: 'GET',
    endpoint: 'https://graph.facebook.com/v19.0/{creation-id}?fields=status_code&access_token=<token>',
    poll_interval_seconds: 5,
    expected_final_value: 'FINISHED',
    other_possible_values: ['IN_PROGRESS', 'ERROR', 'EXPIRED'],
  },
  {
    step: 3,
    action: 'Publish the Reel',
    method: 'POST',
    endpoint: 'https://graph.facebook.com/v19.0/{ig-user-id}/media_publish',
    body: {
      creation_id: '<creation_id_from_step_1>',
      access_token: '<YOUR_PAGE_ACCESS_TOKEN>',
    },
    response: 'Returns { id: "<ig-media-id>" }.',
  },
];

export default async function handler(req, res) {
  console.log('\n🎬 === REEL VIDEO API ===');
  console.log('Method:', req.method, '| Query:', req.query);

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Use GET.' });
  }

  const { folder, file, video, caption = '', output } = req.query;

  // ── No params at all → show usage ────────────────────────────────────────
  if (!folder && !video) {
    return res.status(400).json({
      error: 'Provide either `folder` (local file) or `video` (remote URL) parameter.',
      modes: {
        local_folder: {
          description:
            'Serve a local mp4 from public/resources/{folder}/. After streaming the file is moved to public/resources/{folder}/done/ so it is never served twice.',
          examples: {
            auto_pick:   '/api/reel?folder=vid1',
            specific_file: '/api/reel?folder=vid1&file=testtest.mp4',
            json_info:   '/api/reel?folder=vid1&output=json',
          },
        },
        remote_proxy: {
          description:
            'Proxy a remote mp4 URL. Use this endpoint URL as video_url for the Instagram Graph API.',
          examples: {
            proxy: '/api/reel?video=https://example.com/clip.mp4',
            json_info: '/api/reel?video=https://example.com/clip.mp4&output=json',
          },
        },
      },
      instagram_requirements: IG_REEL_REQUIREMENTS,
    });
  }

  try {
    // ════════════════════════════════════════════════════════════════════════
    // LOCAL FILE MODE  (?folder=vid1  or  ?folder=vid1&file=testtest.mp4)
    // ════════════════════════════════════════════════════════════════════════
    if (folder) {
      const safeFolder = sanitizeSegment(folder);
      if (!safeFolder) {
        return res.status(400).json({ error: 'Invalid folder name. Use only letters, numbers, - and _.' });
      }

      const folderPath = safePath(safeFolder);

      if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
        return res.status(404).json({
          error: `Folder not found: public/resources/${safeFolder}`,
          tip: 'Create the folder and drop mp4 files into it.',
        });
      }

      // Resolve which file to serve
      let targetFilename;
      if (file) {
        targetFilename = sanitizeFilename(file);
        if (!targetFilename) {
          return res.status(400).json({ error: 'Invalid file name. Use alphanumeric characters and .mp4 extension.' });
        }
      } else {
        // Random pick; resets cycle in /tmp state when all files have been served
        targetFilename = pickRandomMp4(folderPath, safeFolder);
        if (!targetFilename) {
          return res.status(404).json({
            error: `No mp4 files found in public/resources/${safeFolder}/`,
          });
        }
      }

      const filePath = safePath(safeFolder, targetFilename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          error: `File not found: ${targetFilename}`,
          folder: `public/resources/${safeFolder}/`,
        });
      }

      // ── JSON mode: return proxy URL + posting steps, don't serve yet ──────
      if (output === 'json') {
        const proxyUrl = buildSelfUrl(req, { folder: safeFolder, file: targetFilename });
        const served = loadServedSet(safeFolder);
        const total = listMp4s(folderPath).length;

        // caption_suggestion = filename without extension, underscores → spaces — ready to paste into Make
        const captionSuggestion = path.parse(targetFilename).name.replace(/[_-]+/g, ' ');

        return res.status(200).json({
          success: true,
          source: 'local',
          folder: safeFolder,
          file: targetFilename,
          caption_suggestion: caption || captionSuggestion,
          file_size_bytes: fs.statSync(filePath).size,
          proxy_video_url: proxyUrl,
          served_count: served.size,
          total_files: total,
          note: 'In Make: map proxy_video_url → Video URL, caption_suggestion → Caption.',
          instagram_requirements: IG_REEL_REQUIREMENTS,
          instagram_posting_steps: IG_POSTING_STEPS(proxyUrl, caption || captionSuggestion),
          permissions_required: ['instagram_basic', 'instagram_content_publish', 'pages_read_engagement'],
        });
      }

      // ── Proxy/stream mode: serve file, then move to done/ ─────────────────
      console.log(`📂 Serving local file: public/resources/${safeFolder}/${targetFilename}`);
      await streamLocalFile(filePath, safeFolder, res);
      return;
    }

    // ════════════════════════════════════════════════════════════════════════
    // REMOTE URL PROXY MODE  (?video=https://...)
    // ════════════════════════════════════════════════════════════════════════

    // Validate URL — only http/https to prevent SSRF
    let parsedUrl;
    try {
      parsedUrl = new URL(video);
    } catch {
      return res.status(400).json({ error: 'Invalid video URL. Provide a full http/https URL.' });
    }
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return res.status(400).json({ error: 'Only http and https video URLs are supported.' });
    }

    // Block private/internal addresses
    const hostname = parsedUrl.hostname.toLowerCase();
    const privatePatterns = [/^localhost$/, /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^::1$/];
    if (privatePatterns.some((p) => p.test(hostname))) {
      return res.status(400).json({ error: 'video URL must point to a public server.' });
    }

    if (output === 'json') {
      const proxyUrl = buildSelfUrl(req, { video });

      return res.status(200).json({
        success: true,
        source: 'remote',
        proxy_video_url: proxyUrl,
        original_video_url: video,
        caption: caption || null,
        note: 'Use proxy_video_url as video_url in the Instagram Graph API.',
        instagram_requirements: IG_REEL_REQUIREMENTS,
        instagram_posting_steps: IG_POSTING_STEPS(proxyUrl, caption),
        permissions_required: ['instagram_basic', 'instagram_content_publish', 'pages_read_engagement'],
      });
    }

    await streamVideoFromUrl(video, res);

  } catch (error) {
    console.error('❌ Reel API error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Reel API failed', message: error.message });
    }
  }
}
