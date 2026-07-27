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
 * If target ends with .m3u8, routes through /api/proxy-m3u8.
 * Otherwise (e.g., .ts segments, keys), routes through /api/proxy-segment.
 */
function buildProxyUrl(targetAbsoluteUrl, proxyBaseUrl) {
  const urlObj = new URL(targetAbsoluteUrl);
  const pathname = urlObj.pathname.toLowerCase();

  if (pathname.endsWith('.m3u8')) {
    return `${proxyBaseUrl}/api/proxy-m3u8?url=${encodeURIComponent(targetAbsoluteUrl)}`;
  } else {
    return `${proxyBaseUrl}/api/proxy-segment?url=${encodeURIComponent(targetAbsoluteUrl)}`;
  }
}

/**
 * Rewrites relative and absolute URIs in an M3U8 manifest so that:
 * - Sub/Variant playlists (.m3u8) point to /api/proxy-m3u8
 * - Video chunks (.ts) and encryption keys point to /api/proxy-segment
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
          if (p1.startsWith('data:')) return match;
          const absUrl = new URL(p1, targetObj).href;
          const proxiedKeyUrl = `${proxyBaseUrl}/api/proxy-segment?url=${encodeURIComponent(absUrl)}`;
          return `URI="${proxiedKeyUrl}"`;
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

    // Return proxied URL
    return buildProxyUrl(absoluteTargetUrl, proxyBaseUrl);
  });

  return rewrittenLines.join('\n');
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: 'Direct Proxy Tunnel',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/proxy-m3u8
 * Fetches M3U8 manifest and rewrites inner URLs to proxy through this backend.
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

  // Construct dynamic proxy base URL (e.g. https://m3u8-proxy-poc.onrender.com)
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

/**
 * GET /api/proxy-segment
 * Streams .ts video chunks and media assets directly from target CDN to client.
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

  // Forward Range header if client requests specific byte range
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Referer': `${parsedUrl.origin}/`
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
      timeout: 20000
    });

    res.setHeader('Content-Type', response.headers['content-type'] || 'video/MP2T');
    res.setHeader('Access-Control-Allow-Origin', '*');

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
      console.error(`[STREAM-PIPE-ERROR] ${err.message}`);
      if (!res.headersSent) {
        res.status(500).end();
      }
    });

  } catch (error) {
    console.error(`[SEGMENT-ERROR] Failed to stream segment ${targetUrl}: ${error.message}`);
    if (!res.headersSent) {
      const statusCode = error.response ? error.response.status : 502;
      return res.status(statusCode).json({
        error: 'Failed to stream video segment',
        details: error.message,
        targetUrl
      });
    }
  }
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 M3U8 Direct Proxy Backend running on port ${PORT}`);
  console.log(`🔗 Manifest Endpoint: /api/proxy-m3u8?url=<URL>`);
  console.log(`🎬 Segment Endpoint:  /api/proxy-segment?url=<URL>`);
  console.log(`====================================================`);
});
