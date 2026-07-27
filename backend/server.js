const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for all incoming frontend requests
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Range']
}));

app.use(express.json());

/**
 * Creates an HTTP/HTTPS or SOCKS agent depending on the configured proxy URL.
 * Supports:
 * - HTTP/HTTPS proxy: http://user:pass@host:port
 * - SOCKS5 proxy: socks5://user:pass@host:port or socks://host:port
 */
function createProxyAgent(proxyUrl) {
  if (!proxyUrl || typeof proxyUrl !== 'string' || proxyUrl.trim() === '') {
    return null;
  }

  const cleanUrl = proxyUrl.trim();
  try {
    if (cleanUrl.startsWith('socks5://') || cleanUrl.startsWith('socks://') || cleanUrl.startsWith('socks4://')) {
      return new SocksProxyAgent(cleanUrl);
    } else if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
      return new HttpsProxyAgent(cleanUrl);
    } else {
      // Default to http proxy if protocol missing
      return new HttpsProxyAgent(`http://${cleanUrl}`);
    }
  } catch (err) {
    console.error('[PROXY-CONFIG-ERROR] Invalid proxy URL format:', err.message);
    return null;
  }
}

/**
 * Rewrites relative URIs in an M3U8 manifest into full absolute target CDN URLs.
 * This guarantees that downstream .ts segment requests go directly to the target CDN,
 * fulfilling the backend bypass requirement for video chunk delivery.
 */
function rewriteM3u8Manifest(manifestText, targetUrl) {
  const targetObj = new URL(targetUrl);
  const lines = manifestText.split(/\r?\n/);

  const rewrittenLines = lines.map(line => {
    const trimmed = line.trim();
    // Empty lines or comment/tag lines starting with '#'
    if (!trimmed || trimmed.startsWith('#')) {
      // Handle URI attributes in tags like #EXT-X-KEY:METHOD=AES-128,URI="key.key"
      if (trimmed.includes('URI="')) {
        return line.replace(/URI="([^"]+)"/g, (match, p1) => {
          if (p1.startsWith('http://') || p1.startsWith('https://') || p1.startsWith('data:')) {
            return match;
          }
          const absUrl = new URL(p1, targetObj).href;
          return `URI="${absUrl}"`;
        });
      }
      return line;
    }

    // If line is already absolute URL, keep it
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return line;
    }

    // Resolve relative URL to absolute URL targeting original CDN
    try {
      const absoluteUrl = new URL(trimmed, targetObj).href;
      return absoluteUrl;
    } catch (e) {
      return line;
    }
  });

  return rewrittenLines.join('\n');
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    proxyConfigured: Boolean(process.env.PROXY_URL),
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/proxy-m3u8
 * Query params:
 *  - url (required): Target M3U8 stream URL
 *  - proxy (optional): Override proxy URL per-request (e.g., http://turkey-proxy:8080)
 */
app.get('/api/proxy-m3u8', async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({
      error: 'Missing required query parameter "url". Example: /api/proxy-m3u8?url=https://example.com/stream.m3u8'
    });
  }

  // Validate URL format
  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl);
  } catch (err) {
    return res.status(400).json({
      error: 'Invalid target URL format provided.'
    });
  }

  // Determine proxy configuration (request override or environment default)
  const proxyUrl = req.query.proxy || process.env.PROXY_URL;
  const agent = createProxyAgent(proxyUrl);

  console.log(`[MANIFEST-FETCH] Target: ${targetUrl}`);
  if (proxyUrl) {
    console.log(`[PROXY-ACTIVE] Using proxy: ${proxyUrl.replace(/:[^:@]+@/, ':****@')}`);
  } else {
    console.log(`[DIRECT-FETCH] No proxy configured, fetching directly.`);
  }

  try {
    const axiosConfig = {
      method: 'GET',
      url: targetUrl,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': `${parsedUrl.origin}/`
      },
      responseType: 'text',
      timeout: 10000
    };

    let response;
    if (agent) {
      try {
        console.log(`[PROXY-ATTEMPT] Attempting fetch via proxy...`);
        const proxyAxiosConfig = { ...axiosConfig, httpsAgent: agent, httpAgent: agent };
        response = await axios(proxyAxiosConfig);
        console.log(`[PROXY-SUCCESS] Successfully fetched manifest via proxy.`);
      } catch (proxyError) {
        console.warn(`[PROXY-FALLBACK] Proxy fetch failed (${proxyError.message}). Falling back to direct connection...`);
        // Fallback to direct fetch without proxy agent
        response = await axios(axiosConfig);
        console.log(`[DIRECT-SUCCESS] Successfully fetched manifest via direct connection fallback.`);
      }
    } else {
      response = await axios(axiosConfig);
    }

    // Rewrite relative manifest URLs to absolute CDN URLs
    const rewrittenManifest = rewriteM3u8Manifest(response.data, targetUrl);

    // Set appropriate M3U8 headers
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.status(200).send(rewrittenManifest);

  } catch (error) {
    console.error(`[FETCH-ERROR] Failed to fetch target M3U8 manifest: ${error.message}`);

    const statusCode = error.response ? error.response.status : 502;
    return res.status(statusCode).json({
      error: 'Failed to fetch M3U8 manifest',
      details: error.message,
      code: error.code || 'FETCH_ERROR',
      targetUrl
    });
  }
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 M3U8 Proxy Backend running on http://localhost:${PORT}`);
  console.log(`🔗 Endpoint: http://localhost:${PORT}/api/proxy-m3u8?url=<M3U8_URL>`);
  console.log(`⚙️  Configured Proxy: ${process.env.PROXY_URL || 'None (Direct Mode)'}`);
  console.log(`====================================================`);
});
