// Service Worker for Client-Side M3U8 & Segment Interception (0 Server Load)

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function buildProxyUrl(targetAbsoluteUrl, origin) {
  try {
    const urlObj = new URL(targetAbsoluteUrl);
    const pathname = urlObj.pathname.toLowerCase();

    if (pathname.endsWith('.m3u8') || urlObj.search.toLowerCase().includes('.m3u8')) {
      return `${origin}/sw-m3u8?url=${encodeURIComponent(targetAbsoluteUrl)}`;
    }
  } catch (e) {
    return targetAbsoluteUrl;
  }

  return `${origin}/sw-segment?url=${encodeURIComponent(targetAbsoluteUrl)}`;
}

function rewriteM3u8Manifest(manifestText, targetUrl, origin) {
  const targetObj = new URL(targetUrl);
  const lines = manifestText.split(/\r?\n/);

  const rewrittenLines = lines.map(line => {
    const trimmed = line.trim();

    if (!trimmed) return line;

    if (trimmed.startsWith('#')) {
      if (trimmed.includes('URI="')) {
        return line.replace(/URI="([^"]+)"/g, (match, p1) => {
          if (p1.startsWith('data:')) return match;
          let absUrl;
          try {
            absUrl = new URL(p1, targetObj).href;
          } catch (e) {
            absUrl = p1;
          }
          const proxiedUrl = buildProxyUrl(absUrl, origin);
          return `URI="${proxiedUrl}"`;
        });
      }
      return line;
    }

    let absoluteTargetUrl;
    try {
      absoluteTargetUrl = new URL(trimmed, targetObj).href;
    } catch (e) {
      return line;
    }

    return buildProxyUrl(absoluteTargetUrl, origin);
  });

  return rewrittenLines.join('\n');
}

async function handleM3u8Request(request) {
  const requestUrl = new URL(request.url);
  const targetUrl = requestUrl.searchParams.get('url');

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing url param' }), { status: 400 });
  }

  const parsedUrl = new URL(targetUrl);
  const origin = requestUrl.origin;

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Referer': `${parsedUrl.origin}/`
      }
    });

    if (!response.ok) {
      return new Response(`Target returned status ${response.status}`, { status: response.status });
    }

    const manifestText = await response.text();
    const rewrittenManifest = rewriteM3u8Manifest(manifestText, targetUrl, origin);

    return new Response(rewrittenManifest, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Cache-Control': 'no-cache'
      }
    });
  } catch (err) {
    return new Response(`Service Worker fetch error: ${err.message}`, { status: 502 });
  }
}

async function handleSegmentRequest(request) {
  const requestUrl = new URL(request.url);
  const targetUrl = requestUrl.searchParams.get('url');

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing url param' }), { status: 400 });
  }

  const parsedUrl = new URL(targetUrl);
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Referer': `${parsedUrl.origin}/`
  };

  const range = request.headers.get('range');
  if (range) {
    headers['Range'] = range;
  }

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers
    });

    const responseHeaders = new Headers(response.headers);
    // Overwrite Content-Type to video/MP2T for video chunks (.jpeg, .png, .ts)
    responseHeaders.set('Content-Type', 'video/MP2T');
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', '*');

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders
    });
  } catch (err) {
    return new Response(`Service Worker segment error: ${err.message}`, { status: 502 });
  }
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.pathname === '/sw-m3u8') {
    event.respondWith(handleM3u8Request(event.request));
  } else if (url.pathname === '/sw-segment') {
    event.respondWith(handleSegmentRequest(event.request));
  }
});
