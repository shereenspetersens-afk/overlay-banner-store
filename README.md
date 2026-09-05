# �️ Banner Generator API

A powerful Next.js application that creates professional image banners with custom text overlays. Features 12 design variants, direct image URLs, and comprehensive image processing capabilities.

## ✨ Features

- **🎨 13 Professional Designs**: From news alerts to corporate styles, plus a blank/transparent option
- **⚡ Direct Image URLs**: Works like wsrv.nl for instant embedding
- **🖼️ High Quality Output**: 1080×1350 resolution with optimized compression
- **📱 Preview Mode**: Interactive preview with download options
- **🔗 Multiple Formats**: JPEG and PNG support
- **🚀 Fast Processing**: Server-side rendering with Sharp image processing
- **🌐 Public API**: No authentication required
- **🔴 Reddit Integration**: Extract and process images directly from Reddit posts

## 🔧 API Parameters

### Direct Image & Bundled Font Overlay
- `image` → Source image URL (required)
- `title` → Text overlay for banner
- `website` → Brand/website name (optional)
- `design` → Design variant: `default`, `design1`-`design12`, `blank`
- `format` → Output format: `jpeg` (default) or `png`
- `preview` → Set to `true` for interactive preview
- `w` → Width in pixels (default: 1080)
- `h` → Height in pixels (default: 1350)

### Reddit Image Extractor
- `url` → Reddit post URL (required)
- `title` → Text overlay for banner (optional)
- `website` → Brand/website name (optional)
- `w` → Width in pixels (default: 1080)
- `h` → Height in pixels (default: 1350)
- `design` → Design variant (optional, default: no overlay unless title/website provided)

## 🚀 API Endpoints

### 1. Direct Image URL (recommended)
```
https://your-domain.com/api/direct-image?image=IMAGE_URL&title=TITLE&design=DESIGN
```

### 2. Reddit Image Extractor
```
https://your-domain.com/api/reddit-image?url=REDDIT_POST_URL&title=TITLE&website=WEBSITE
```
Automatically extracts images from Reddit posts and applies overlays. Supports:
- Single images
- Gallery posts (multiple images)
- External image links
- JSON output or direct JPEG with overlay

**Frontend UI:** Visit `/reddit` for an interactive interface to extract and process Reddit images.

### 3. Preview Mode
```
https://your-domain.com/?image=IMAGE_URL&title=TITLE&preview=true
```

### 4. JSON Metadata (API Endpoint)
```
https://your-domain.com/api/image?image=IMAGE_URL&title=TITLE
```

## 📝 Complete Fetch Examples

### 🎨 All Design Variants

#### Default Design (Modern Gradient)
```javascript
fetch('https://your-domain.com/api/direct-image?image=https://picsum.photos/800/600&title=Modern%20Banner&website=YourBrand.com')
```

#### Design 1 - 🚨 Classic Red Alert (Breaking News)
```javascript
fetch('https://your-domain.com/api/direct-image?image=https://picsum.photos/800/600&title=BREAKING%20NEWS&website=CNN.com&design=design1')
```

#### Design 2 - ⚡ Blue Pulse (Tech News)
```javascript
fetch('https://your-domain.com/api/direct-image?image=https://picsum.photos/800/600&title=TECH%20UPDATE&website=TechCrunch.com&design=design2')
```

#### Design 3 - 🟡 Yellow Flash (Viral Content)
```javascript
fetch('https://your-domain.com/api/direct-image?image=https://picsum.photos/800/600&title=VIRAL%20NOW&website=BuzzFeed.com&design=design3')
```

#### Design 4 - 🟥 Gradient Burst (YouTube Style)
```javascript
fetch('https://your-domain.com/api/direct-image?image=https://picsum.photos/800/600&title=HOT%20TOPIC&website=YouTube.com&design=design4')
```

#### Design 5 - 📰 White Noise (Professional News)
```javascript
fetch('https://your-domain.com/api/direct-image?image=https://picsum.photos/800/600&title=OFFICIAL%20STATEMENT&website=Reuters.com&design=design5')
```

#### Design 6 - 🧨 Cyber Alert (Futuristic)
```javascript
fetch('https://your-domain.com/api/direct-image?image=https://picsum.photos/800/600&title=CYBER%20ALERT&website=Wired.com&design=design6')
```

#### Design 7 - 🔥 Red Flash Impact (Urgent Alert)
```javascript
fetch('https://your-domain.com/api/direct-image?image=https://picsum.photos/800/600&title=FLASH%20UPDATE&website=NewsAlert.com&design=design7')
```

#### Design 8 - ⚡ Electric Cyan Pop (Future Tech)
```javascript
fetch('https://your-domain.com/api/direct-image?image=https://picsum.photos/800/600&title=FUTURE%20TECH&website=CyberNews.com&design=design8')
```

#### Design 9 - 🖤 Black + Red Pulse (Energy)
```javascript
fetch('https://your-domain.com/api/direct-image?image=https://picsum.photos/800/600&title=ENERGY%20PULSE&website=PowerNews.com&design=design9')
```

#### Design 10 - 🟠 Amber Alert (Authority)
```javascript
fetch('https://your-domain.com/api/direct-image?image=https://picsum.photos/800/600&title=AMBER%20WARNING&website=AlertSystem.com&design=design10')
```

#### Design 11 - 🔵 Blue Ribbon News (Corporate)
```javascript
fetch('https://your-domain.com/api/direct-image?image=https://picsum.photos/800/600&title=CORPORATE%20NEWS&website=BusinessDaily.com&design=design11')
```

#### Design 12 - 🔴 Metallic Red Signal (Modern)
```javascript
fetch('https://your-domain.com/api/direct-image?image=https://picsum.photos/800/600&title=METALLIC%20SIGNAL&website=ModernNews.com&design=design12')
```

#### Design: Blank - ⬜ Completely Transparent (No Overlay)
```javascript
fetch('https://your-domain.com/api/direct-image?image=https://picsum.photos/800/600&title=&website=&design=blank')
```
Perfect for when you want the raw image without any background, text, or overlay elements. The title and website parameters are ignored with this design.

**Also available in bundled-font-overlay:**
```javascript
fetch('https://your-domain.com/api/bundled-font-overlay?image=https://picsum.photos/800/600&design=blank')
```

### � Reddit Image Integration

#### Extract Image URLs from Reddit Post (JSON)
```javascript
// Get JSON response with all image URLs from a Reddit post
fetch('https://your-domain.com/api/reddit-image?url=https://www.reddit.com/r/pics/comments/abc123/cool_photo/')
  .then(response => response.json())
  .then(data => console.log(data));

// Response:
{
  "success": true,
  "count": 1,
  "images": [
    "https://i.redd.it/xyz123.jpg"
  ],
  "post_url": "https://www.reddit.com/r/pics/comments/abc123/cool_photo/"
}
```

#### Reddit Image with Overlay (Direct JPEG)
```javascript
// Extract Reddit image and apply overlay in one request
fetch('https://your-domain.com/api/reddit-image?url=https://www.reddit.com/r/pics/comments/abc123/cool_photo/&title=FROM%20REDDIT&website=Reddit.com')
  .then(response => response.blob())
  .then(blob => {
    // Use the processed image with overlay
    const imgUrl = URL.createObjectURL(blob);
    document.querySelector('img').src = imgUrl;
  });
```

#### Reddit Gallery Support
```javascript
// Automatically extracts all images from Reddit gallery posts
fetch('https://your-domain.com/api/reddit-image?url=https://www.reddit.com/r/pics/comments/gallery_post/')
  .then(response => response.json())
  .then(data => {
    console.log(`Found ${data.count} images in gallery`);
    data.images.forEach(img => console.log(img));
  });

// Response for gallery:
{
  "success": true,
  "count": 3,
  "images": [
    "https://i.redd.it/image1.jpg",
    "https://i.redd.it/image2.jpg",
    "https://i.redd.it/image3.jpg"
  ],
  "post_url": "..."
}
```

#### Reddit Image with Custom Dimensions
```javascript
// Process Reddit image with custom size and design
fetch('https://your-domain.com/api/reddit-image?url=https://www.reddit.com/r/EarthPorn/comments/xyz/&title=EARTH%20PORN&w=1920&h=1080&design=design3')
```

### �🖼️ Format Variations

#### PNG Format (with transparency support)
```javascript
fetch('https://your-domain.com/api/direct-image?image=https://picsum.photos/800/600&title=PNG%20Banner&format=png&design=design2')
```

#### Custom Dimensions
```javascript
fetch('https://your-domain.com/api/direct-image?image=https://picsum.photos/800/600&title=Custom%20Size&w=1920&h=1080&design=design1')
```

### 📱 Interactive Preview Mode
```javascript
// Open in browser for interactive preview with download options
window.open('https://your-domain.com/?image=https://picsum.photos/800/600&title=Preview%20Banner&website=Demo.com&preview=true&design=design3')
```

### 📊 JSON Metadata Response
```javascript
// Get pure JSON metadata (no HTML wrapper)
fetch('https://your-domain.com/api/image?image=https://picsum.photos/800/600&title=Metadata%20Only')
  .then(response => response.json())
  .then(data => console.log(data));
```

#### JSON Response Example:
```json
[
  {
    "statusCode": 200,
    "headers": [
      {
        "name": "content-type",
        "value": "image/jpeg"
      },
      {
        "name": "content-length", 
        "value": "370962"
      }
    ],
    "cookieHeaders": [],
    "data": "IMTBuffer(370962, binary, ffd8ffe000104a46...): /9j/4AAQSkZJRgABAQAAAQ...",
    "fileSize": 370962,
    "fileName": "file.jpeg",
    "contentType": "image/jpeg",
    "url": "https://picsum.photos/800/600",
    "title": "Metadata Only",
    "timestamp": "2025-11-02T12:00:00.000Z"
  }
]
```

## 🎨 Design Variants Guide

| Design | Style | Best For | Color Scheme |
|--------|-------|----------|--------------|
| `default` | Modern gradient | General use | Blue gradient |
| `design1` | 🚨 Red Alert | Breaking news | Red gradient |
| `design2` | ⚡ Blue Pulse | Tech news | Electric blue |
| `design3` | 🟡 Yellow Flash | Viral content | Yellow accent |
| `design4` | 🟥 Gradient Burst | YouTube style | Red-orange |
| `design5` | 📰 White Noise | Professional | Clean white |
| `design6` | 🧨 Cyber Alert | Futuristic | Neon effects |
| `design7` | 🔥 Red Flash | Urgent alerts | Impact red |
| `design8` | ⚡ Electric Cyan | Fresh tech | Cyan pop |
| `design9` | 🖤 Black + Red | Energetic | Black/red |
| `design10` | 🟠 Amber Alert | Authority | Amber warning |
| `design11` | 🔵 Blue Ribbon | Corporate | Professional blue |
| `design12` | 🔴 Metallic Red | Modern polish | Metallic red |
| `blank` | ⬜ Transparent | Raw image | No overlay |

**Note:** The `blank` design returns the image without any overlay and is available in both `/api/direct-image` and `/api/bundled-font-overlay` endpoints.

## 🔧 Advanced Usage

### 🌐 Reddit Image Fetcher UI

Visit `/reddit` on your deployed app for a full-featured web interface:

```
https://your-domain.com/reddit
```

**Features:**
- 📥 Paste any Reddit post URL to extract images
- 🖼️ Supports single images and gallery posts
- 🎨 Apply 13 design variants with custom text overlays
- 💾 Download processed banners directly
- 📋 Copy image URLs to clipboard
- ⚡ Real-time preview of generated banners

### Reddit Post to Banner
```javascript
// Automatically fetch Reddit image and create banner
const redditUrl = 'https://www.reddit.com/r/itookapicture/comments/xyz/amazing_sunset/';
const bannerUrl = `https://your-domain.com/api/reddit-image?url=${encodeURIComponent(redditUrl)}&title=AMAZING%20SUNSET&website=Reddit.com&design=design1`;

// Use in img tag
document.querySelector('img').src = bannerUrl;
```

### Reddit Gallery Processing
```javascript
// Extract all images from Reddit gallery
async function processRedditGallery(redditUrl) {
  const response = await fetch(`https://your-domain.com/api/reddit-image?url=${encodeURIComponent(redditUrl)}`);
  const data = await response.json();
  
  if (data.success) {
    console.log(`Found ${data.count} images:`);
    data.images.forEach((imgUrl, index) => {
      console.log(`Image ${index + 1}: ${imgUrl}`);
      // Process each image with overlay
      const overlayUrl = `https://your-domain.com/api/direct-image?image=${encodeURIComponent(imgUrl)}&title=Image%20${index + 1}&design=design2`;
      // Use overlayUrl as needed
    });
  }
}
```

### Embedding in HTML
```html
<img src="https://your-domain.com/api/direct-image?image=https://picsum.photos/800/600&title=Embedded%20Banner&design=design1" alt="News Banner" />

<!-- Reddit image with overlay -->
<img src="https://your-domain.com/api/reddit-image?url=https://reddit.com/r/pics/comments/abc/&title=REDDIT%20PIC&design=design3" alt="Reddit Banner" />
```

### Social Media Integration
```javascript
// Perfect for social media posts
const bannerUrl = 'https://your-domain.com/api/direct-image?' + 
  'image=https://images.unsplash.com/photo-1506905925346-21bda4d32df4' +
  '&title=Social%20Media%20Post' +
  '&website=YourBrand.com' +
  '&design=design3' +
  '&format=png';

// Use bannerUrl for Twitter, Facebook, Instagram, etc.
```

### Batch Processing
```javascript
const designs = ['design1', 'design2', 'design3'];
const baseUrl = 'https://your-domain.com/api/direct-image?image=https://picsum.photos/800/600&title=Batch%20Test';

designs.forEach(design => {
  fetch(`${baseUrl}&design=${design}`)
    .then(response => response.blob())
    .then(blob => {
      // Process each design variant
      console.log(`Generated ${design} variant`);
    });
});
```

## 📊 Response Formats

The API supports multiple response types:

- **Direct Image**: Binary image data (default for `/api/direct-image`)
- **JSON Metadata**: Complete image information with base64 data
- **Interactive Preview**: HTML interface with download options

## � RSS Feed Store

Persistent image feed backed by Vercel Blob. Items are stored as a single JSON index; images are re-hosted under `resources/<source>/`. Visit **`/feed`** for the interactive viewer with multi-image upload, per-item and batch caption editing, and source management.

### 🔐 Authentication

Write operations (`POST` / `PATCH` / `DELETE`) require the `x-api-key` header (or `?secret=…` query) matching the `RSS_STORE_SECRET` environment variable. Read operations (`GET`) are always open.

```bash
export RSS_KEY="your-secret-here"
```

### 📇 Endpoints Overview

| Method | Path | Purpose |
|--------|------|---------|
| `GET`    | `/api/rss/items` | List / filter / search / paginate items |
| `GET`    | `/api/rss/store` | Return all stored items (unpaginated) |
| `GET`    | `/api/rss/item/[id]` | Get a single item |
| `POST`   | `/api/rss/store` | Store one or many items (image URL or base64 data URL) |
| `PATCH`  | `/api/rss/item/[id]` | Update `title`, `description`, or `source` on one item |
| `DELETE` | `/api/rss/item/[id]` | Delete one item and its stored image |
| `POST`   | `/api/rss/batch` | Bulk update or delete many items in one call |

### 📥 GET `/api/rss/items` — list the feed

Query parameters (all optional):

| Param      | Description                                                  | Default |
|------------|--------------------------------------------------------------|---------|
| `source`   | Filter by source name (exact match, e.g. `uploads`)          | —       |
| `search`   | Full-text search across `title` + `description`              | —       |
| `used`     | `false` → unused only, `true` → used only                    | —       |
| `limit`    | Items per page (1–100)                                       | `20`    |
| `page`     | Page number (1-indexed)                                      | `1`     |
| `markUsed` | `true` → also flip returned items to `used=true` (write op). Requires `x-api-key` when `RSS_STORE_SECRET` is set. | —       |

```bash
# All items, first 20
curl "https://your-domain.com/api/rss/items"

# Filter by source
curl "https://your-domain.com/api/rss/items?source=uploads"

# Only unused items (avoid duplicates)
curl "https://your-domain.com/api/rss/items?used=false"

# Atomic "pop" — retrieve 10 unused items and mark them used in one call
curl "https://your-domain.com/api/rss/items?used=false&limit=10&markUsed=true" \
  -H "x-api-key: $RSS_KEY"

# Full-text search
curl "https://your-domain.com/api/rss/items?search=sunset"

# Paginate
curl "https://your-domain.com/api/rss/items?limit=50&page=2"

# Combined
curl "https://your-domain.com/api/rss/items?source=uploads&search=2026&limit=24&page=1"
```

```javascript
// Fetch a filtered page
const params = new URLSearchParams({ source: 'uploads', limit: '24', page: '1' });
const data = await fetch(`/api/rss/items?${params}`).then(r => r.json());
console.log(data.pagination); // { total, page, limit, pages }
console.log(data.items);      // array of items

// Derive the unique source list (there is no dedicated /sources endpoint)
const all = await fetch('/api/rss/items?limit=100').then(r => r.json());
const sources = [...new Set(all.items.map(i => i.source))].sort();
```

Response shape:
```json
{
  "items": [
    {
      "id": "9d1a2c-…",
      "source": "uploads",
      "title": "Amazing sunset",
      "description": "**Location:** Manila Bay",
      "imageUrl": "https://…blob.vercel-storage.com/resources/uploads/9d1a2c-….jpg",
      "originalImageUrl": "https://picsum.photos/800/600",
      "storedAt": "2026-09-05T04:22:08.479Z",
      "used": false,
      "usedAt": null
    }
  ],
  "pagination": { "total": 42, "page": 1, "limit": 20, "pages": 3 }
}
```

> **Item lifecycle:** every item has a boolean `used` flag (default `false`) and a `usedAt` ISO timestamp. Consumers should either query with `?used=false` and later flip items via `POST /api/rss/batch` **or** use `?used=false&markUsed=true` for atomic "take next unused" semantics — this prevents duplicate retrieval.

### 📥 GET `/api/rss/item/[id]` — get one item

```bash
curl "https://your-domain.com/api/rss/item/9d1a2c-…"
```

### 📤 POST `/api/rss/store` — create one or many

Accepts a single object **or** an array. `imageUrl` may be an `http(s)://…` URL **or** a `data:image/…;base64,…` data URL (used by the `/feed` upload UI).

Single item, remote URL:
```bash
curl -X POST "https://your-domain.com/api/rss/store" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $RSS_KEY" \
  -d '{
    "imageUrl": "https://picsum.photos/800/600",
    "title": "Amazing sunset",
    "description": "**Location:** Manila Bay",
    "source": "uploads"
  }'
```

Batch (array):
```bash
curl -X POST "https://your-domain.com/api/rss/store" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $RSS_KEY" \
  -d '[
    { "imageUrl": "https://picsum.photos/800/600?a", "title": "One",   "source": "uploads" },
    { "imageUrl": "https://picsum.photos/800/600?b", "title": "Two",   "source": "uploads" },
    { "imageUrl": "https://picsum.photos/800/600?c", "title": "Three", "source": "uploads" }
  ]'
```

Data URL upload (base64 image inline):
```javascript
const file = document.querySelector('input[type=file]').files[0];
const dataUrl = await new Promise((res) => {
  const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file);
});
await fetch('/api/rss/store', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-api-key': RSS_KEY },
  body: JSON.stringify({
    imageUrl: dataUrl,               // data:image/png;base64,…
    title: 'Uploaded from browser',
    description: '',
    source: 'uploads',
  }),
});
```

### ✏️ PATCH `/api/rss/item/[id]` — edit one item

Any of `title`, `description`, `source`, `used` may be provided; omitted fields are left unchanged. Setting `used: true` also stamps `usedAt` to the current ISO time; `used: false` clears it.

```bash
curl -X PATCH "https://your-domain.com/api/rss/item/9d1a2c-…" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $RSS_KEY" \
  -d '{ "title": "New title", "description": "New description", "source": "curated", "used": true }'
```

### 🔁 POST `/api/rss/batch` — bulk update or delete

Body shape:
```json
{
  "action": "update",
  "ids": ["id1", "id2"],
  "all": false,
  "source": "optional-source-filter",
  "patch": {
    "source": "new-source",
    "used": true,
    "title": "overwrite title",
    "titlePrefix": "🔥 ",
    "titleSuffix": " (updated)",
    "titleReplace": { "find": "foo", "replace": "bar", "flags": "gi" },
    "description": "overwrite description",
    "descriptionPrefix": "…",
    "descriptionSuffix": "…",
    "descriptionReplace": { "find": "\\bTOS\\b", "replace": "Terms", "flags": "g" }
  }
}
```

Targeting rules:
- Provide `ids` **or** set `all: true` — one of them is required.
- Optionally add `source: "…"` to further restrict which items are affected.

Change the source for a set of IDs:
```bash
curl -X POST "https://your-domain.com/api/rss/batch" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $RSS_KEY" \
  -d '{
    "action": "update",
    "ids": ["id-1", "id-2", "id-3"],
    "patch": { "source": "curated-2026" }
  }'
```

Prefix every title from a given source:
```bash
curl -X POST "https://your-domain.com/api/rss/batch" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $RSS_KEY" \
  -d '{
    "action": "update",
    "all": true,
    "source": "uploads",
    "patch": { "titlePrefix": "🔥 " }
  }'
```

Delete many at once:
```bash
curl -X POST "https://your-domain.com/api/rss/batch" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $RSS_KEY" \
  -d '{ "action": "delete", "ids": ["id-1", "id-2"] }'
```

Reset an entire source back to unused (e.g. to re-queue a feed):
```bash
curl -X POST "https://your-domain.com/api/rss/batch" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $RSS_KEY" \
  -d '{
    "action": "update",
    "all": true,
    "source": "uploads",
    "patch": { "used": false }
  }'
```

Mark specific IDs as used after consuming them:
```bash
curl -X POST "https://your-domain.com/api/rss/batch" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $RSS_KEY" \
  -d '{ "action": "update", "ids": ["id-1", "id-2"], "patch": { "used": true } }'
```

### 🗑️ DELETE `/api/rss/item/[id]` — delete one item

```bash
curl -X DELETE "https://your-domain.com/api/rss/item/9d1a2c-…" \
  -H "x-api-key: $RSS_KEY"
```

### 🖥️ Interactive Viewer — `/feed`

```
https://your-domain.com/feed
```

- 🔍 Search + source-tab filtering + pagination
- 🟢 **Usage filter** — All / Unused / Used chips at the top
- ⬆️ Drag-and-drop **multi-image upload** with per-item editable title, source, and description
- 🧰 Batch caption tools during staging (prefix/suffix titles, set description, set source for all)
- ✅ **Select mode** to bulk change source, edit captions, mark used/unused, or delete existing items
- 🔁 **Per-source batch** — when a source tab is active, one-click *Mark all unused* / *Mark all used*
- 🔑 Admin-key input (stored in `localStorage`, sent as `x-api-key`)

## �🛠 Development

1. Install dependencies:
```bash
npm install
```

2. Run development server:
```bash
npm run dev
```

3. Test the API:
```bash
# Test direct image generation
curl "http://localhost:3001/api/direct-image?image=https://picsum.photos/800/600&title=Test%20Banner&design=design1" --output test-banner.jpg

# Test JSON metadata (pure JSON API)
curl "http://localhost:3001/api/image?image=https://picsum.photos/800/600&title=Test%20Metadata"

# Test preview mode
open "http://localhost:3001/?image=https://picsum.photos/800/600&title=Test%20Preview&preview=true&design=design2"
```

4. Build for production:
```bash
npm run build
```

## � Security & Access

### Public Homepage
- Default homepage shows a clean, professional interface
- No API details exposed to public visitors
- Perfect for public deployment

### Technical Documentation
- Access with `?admin=docs` parameter
- Complete API documentation and examples
- For developers and technical users

```bash
# Public homepage (safe for public)
https://your-domain.com/

# Technical docs (for developers)
https://your-domain.com/?admin=docs
```

## 🚀 Deployment

### Vercel (Recommended)
1. Connect GitHub repository to Vercel
2. Automatic deployments with global CDN
3. Serverless functions with Sharp optimization
4. Built-in SSL and performance optimization

### Environment Variables
No environment variables required - the API is designed to work out of the box.

### Production Considerations
- Sharp image processing is optimized for serverless
- Global CDN ensures fast image delivery
- No rate limiting implemented (add if needed)
- CORS enabled for cross-origin requests

## 📈 Performance

- **Image Processing**: Server-side Sharp optimization
- **Output Quality**: 1080×1350 high resolution
- **Compression**: Optimized JPEG (quality: 90) and PNG
- **Caching**: Browser and CDN friendly headers
- **Response Time**: < 2s for most images

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add new design variants in `pages/api/direct-image.js`
4. Test with multiple image formats
5. Submit a pull request

## 📄 License

MIT License - feel free to use in personal and commercial projects.

## 🔗 Links

- **Live Demo**: [Try the API](https://your-domain.com/api/direct-image?image=https://picsum.photos/800/600&title=Demo%20Banner&design=design1)
- **Preview Mode**: [Interactive Preview](https://your-domain.com/?image=https://picsum.photos/800/600&title=Demo&preview=true&design=design2)
- **Documentation**: [Technical Docs](https://your-domain.com/?admin=docs)