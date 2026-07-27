const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for all incoming frontend requests
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Range', 'Accept']
}));

app.use(express.json());

/**
 * Rewrites URIs in an M3U8 manifest:
 * - Sub/Variant playlists (.m3u8) point to /api/proxy-m3u8
 * - Video chunks (.ts) and encryption keys point directly to target CDN (frontend bypass)
 */
function rewriteM3u8Manifest(manifestText, targetUrl, proxyBaseUrl) {
  const targetObj = new URL(targetUrl);
  const lines = manifestText.split(/\r?\n/);

  const rewrittenLines = lines.map(line => {
    const trimmed = line.trim();

    if (!trimmed) return line;

    // Handle tag lines
    if (trimmed.startsWith('#')) {
      // Rewrite URI attributes in tags like #EXT-X-KEY:METHOD=AES-128,URI="key.key"
      if (trimmed.includes('URI="')) {
        return line.replace(/URI="([^"]+)"/g, (match, p1) => {
          if (p1.startsWith('data:') || p1.startsWith('http://') || p1.startsWith('https://')) return match;
          const absUrl = new URL(p1, targetObj).href;
          return `URI="${absUrl}"`;
        });
      }
      return line;
    }

    // Resolve relative URL to full target CDN URL
    let absoluteTargetUrl;
    try {
      absoluteTargetUrl = new URL(trimmed, targetObj).href;
    } catch (e) {
      return line;
    }

    // If line is a variant playlist (.m3u8), proxy via backend
    const pathname = new URL(absoluteTargetUrl).pathname.toLowerCase();
    if (pathname.endsWith('.m3u8')) {
      return `${proxyBaseUrl}/api/proxy-m3u8?url=${encodeURIComponent(absoluteTargetUrl)}`;
    }

    // For .ts video chunks and media assets, return absolute CDN URL directly
    // This allows hls.js (frontend) to fetch chunks directly from target CDN!
    return absoluteTargetUrl;
  });

  return rewrittenLines.join('\n');
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: 'Manifest-Only Proxy (TS chunks directly from CDN)',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/proxy-m3u8
 * Fetches M3U8 manifest and rewrites relative links:
 * - Nested .m3u8 playlists -> Proxied through /api/proxy-m3u8
 * - .ts segment chunks -> Direct target CDN URLs (backend bypassed)
 */
app.get('/api/proxy-m3u8', async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing required query parameter "url"' });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid target URL format provided.' });
  }

  // Construct dynamic proxy base URL (e.g. http://localhost:5000)
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  const proxyBaseUrl = `${protocol}://${host}`;

  console.log(`[MANIFEST-FETCH] Target: ${targetUrl}`);

  try {
    const response = await axios({
      method: 'GET',
      url: targetUrl,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': `${parsedUrl.origin}/`
      },
      responseType: 'text',
      timeout: 12000
    });

    const rewrittenManifest = rewriteM3u8Manifest(response.data, targetUrl, proxyBaseUrl);

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.status(200).send(rewrittenManifest);

  } catch (error) {
    console.error(`[MANIFEST-ERROR] ${error.message}`);
    const statusCode = error.response ? error.response.status : 502;
    return res.status(statusCode).json({
      error: 'Failed to fetch M3U8 manifest',
      details: error.message,
      targetUrl
    });
  }
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 M3U8 Manifest-Only Proxy Backend running on port ${PORT}`);
  console.log(`🔗 Endpoint: /api/proxy-m3u8?url=<URL>`);
  console.log(`⚡ TS Chunks: Directly fetched by Frontend from CDN`);
  console.log(`====================================================`);
});
