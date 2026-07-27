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
 * Helper to construct the proxy URL for a target link.
 * If target is a sub-playlist (.m3u8), routes through /api/proxy-m3u8.
 * ALL other URI lines (including .jpeg, .png, .ts, .key, etc.) route through /api/proxy-segment.
 */
function buildProxyUrl(targetAbsoluteUrl, proxyBaseUrl) {
  let urlObj;
  try {
    urlObj = new URL(targetAbsoluteUrl);
  } catch (e) {
    return targetAbsoluteUrl;
  }

  const pathname = urlObj.pathname.toLowerCase();

  // Route sub-playlists through /api/proxy-m3u8
  if (pathname.endsWith('.m3u8') || urlObj.search.toLowerCase().includes('.m3u8')) {
    return `${proxyBaseUrl}/api/proxy-m3u8?url=${encodeURIComponent(targetAbsoluteUrl)}`;
  }

  // Route all segment chunks (.ts, .jpeg, .png, .key, extensionless) through /api/proxy-segment
  return `${proxyBaseUrl}/api/proxy-segment?url=${encodeURIComponent(targetAbsoluteUrl)}`;
}

/**
 * Rewrites relative and absolute URIs in an M3U8 manifest:
 * - Scans line by line. Any non-# line is treated as a URI and rewritten to proxy.
 * - Also rewrites URI="..." in tags like #EXT-X-KEY or #EXT-X-MAP.
 */
function rewriteM3u8Manifest(manifestText, targetUrl, proxyBaseUrl) {
  const targetObj = new URL(targetUrl);
  const lines = manifestText.split(/\r?\n/);

  const rewrittenLines = lines.map(line => {
    const trimmed = line.trim();

    if (!trimmed) return line;

    // Handle tag lines (starting with #)
    if (trimmed.startsWith('#')) {
      // Rewrite URI="..." attributes in tags like #EXT-X-KEY or #EXT-X-MAP
      if (trimmed.includes('URI="')) {
        return line.replace(/URI="([^"]+)"/g, (match, p1) => {
          if (p1.startsWith('data:')) return match;
          let absUrl;
          try {
            absUrl = new URL(p1, targetObj).href;
          } catch (e) {
            absUrl = p1;
          }
          const proxiedUrl = buildProxyUrl(absUrl, proxyBaseUrl);
          return `URI="${proxiedUrl}"`;
        });
      }
      return line;
    }

    // Resolve non-tag lines (URIs) to absolute target CDN URL
    let absoluteTargetUrl;
    try {
      absoluteTargetUrl = new URL(trimmed, targetObj).href;
    } catch (e) {
      return line;
    }

    // Wrap URI in proxy endpoint
    return buildProxyUrl(absoluteTargetUrl, proxyBaseUrl);
  });

  return rewrittenLines.join('\n');
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: 'Full M3U8 & Segment Proxy (All extensions proxied)',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/proxy-m3u8
 * Fetches M3U8 manifest and rewrites ALL inner URI lines to proxy endpoints.
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

  // Construct dynamic proxy base URL
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
        'Referer': `${parsedUrl.origin}/`,
        'Origin': parsedUrl.origin
      },
      responseType: 'text',
      timeout: 15000
    });

    const rewrittenManifest = rewriteM3u8Manifest(response.data, targetUrl, proxyBaseUrl);

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.status(200).send(rewrittenManifest);

  } catch (error) {
    console.error(`[MANIFEST-ERROR] ${targetUrl} -> ${error.message}`);
    const statusCode = error.response ? error.response.status : 502;
    return res.status(statusCode).json({
      error: 'Failed to fetch M3U8 manifest',
      details: error.message,
      targetUrl
    });
  }
});

/**
 * GET /api/proxy-segment
 * Streams video segment chunks (.ts, .jpeg, .png, .key, etc.) from target CDN.
 * Overrides Content-Type to video/MP2T so HLS player receives proper MPEG-TS stream.
 */
app.get('/api/proxy-segment', async (req, res) => {
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

  console.log(`[SEGMENT-FETCH] Target: ${targetUrl}`);

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': `${parsedUrl.origin}/`,
    'Origin': parsedUrl.origin
  };

  if (req.headers.range) {
    headers['Range'] = req.headers.range;
  }

  try {
    const response = await axios({
      method: 'GET',
      url: targetUrl,
      headers,
      responseType: 'stream',
      timeout: 25000
    });

    // Force Content-Type to video/MP2T for video chunks (even if disguised as .jpeg / .png)
    res.setHeader('Content-Type', 'video/MP2T');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }

    if (response.headers['content-range']) {
      res.setHeader('Content-Range', response.headers['content-range']);
    }

    if (response.headers['accept-ranges']) {
      res.setHeader('Accept-Ranges', response.headers['accept-ranges']);
    }

    res.status(response.status);
    response.data.pipe(res);

    response.data.on('error', (err) => {
      console.error(`[SEGMENT-PIPE-ERROR] ${err.message}`);
      if (!res.headersSent) {
        res.status(500).end();
      }
    });

  } catch (error) {
    console.error(`[SEGMENT-ERROR] Failed to fetch segment (${targetUrl}): ${error.message}`);
    if (!res.headersSent) {
      const statusCode = error.response ? error.response.status : 502;
      return res.status(statusCode).json({
        error: 'Failed to fetch segment via proxy',
        details: error.message,
        targetUrl
      });
    }
  }
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 M3U8 Full Proxy Backend running on port ${PORT}`);
  console.log(`🔗 Manifest Endpoint: /api/proxy-m3u8?url=<URL>`);
  console.log(`🎬 Segment Endpoint:  /api/proxy-segment?url=<URL>`);
  console.log(`====================================================`);
});
