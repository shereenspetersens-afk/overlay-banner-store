/**
 * Safe JSON body parser that handles literal (unescaped) newlines and other
 * control characters inside string values — a common issue when clients
 * send multi-line text in JSON without escaping line breaks.
 *
 * Usage in an API route:
 *   1. Add:  export const config = { api: { bodyParser: false } };
 *   2. Replace `req.body` reads with: await parseJsonBody(req)
 */

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

/**
 * Walks the raw JSON string character-by-character and escapes any literal
 * control characters (newline, carriage-return, tab) that appear inside
 * string values, turning them into their JSON escape sequences.
 */
function sanitizeJsonControlChars(str) {
  let inString = false;
  let escaped = false;
  let result = '';

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const code = str.charCodeAt(i);

    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }

    if (char === '\\' && inString) {
      result += char;
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }

    // Escape all JSON-illegal control characters (U+0000–U+001F) inside strings
    if (inString && code < 0x20) {
      switch (code) {
        case 0x08: result += '\\b'; break;
        case 0x09: result += '\\t'; break;
        case 0x0A: result += '\\n'; break;
        case 0x0C: result += '\\f'; break;
        case 0x0D: result += '\\r'; break;
        default:   result += `\\u${code.toString(16).padStart(4, '0')}`; break;
      }
      continue;
    }

    result += char;
  }

  return result;
}

/**
 * Reads the raw request body and returns a parsed object.
 * Supports application/json (with newline sanitization) and
 * application/x-www-form-urlencoded bodies.
 * Returns {} for empty bodies.
 */
export async function parseJsonBody(req) {
  const raw = await readRawBody(req);
  if (!raw || !raw.trim()) return {};

  const contentType = (req.headers['content-type'] || '').toLowerCase();

  // Form-encoded body — no JSON validation issues, newlines arrive URL-decoded
  if (contentType.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(raw));
  }

  try {
    return JSON.parse(raw);
  } catch {
    // Second attempt after escaping literal control characters in strings
    return JSON.parse(sanitizeJsonControlChars(raw));
  }
}
