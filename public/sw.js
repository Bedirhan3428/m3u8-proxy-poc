// Service Worker Hybrid Master Architecture (0 Server Load for TS chunks + Fallback)

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

async function handleSegmentRequest(request) {
  const requestUrl = new URL(request.url);
  const targetUrl = requestUrl.searchParams.get('url');

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing url param' }), { status: 400 });
  }

  const parsedUrl = new URL(targetUrl);
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': '*/*'
  };

  const range = request.headers.get('range');
  if (range) {
    headers['Range'] = range;
  }

  try {
    // 1. Attempt Client-Side Direct Fetch (0 Vercel Load)
    let response = await fetch(targetUrl, {
      method: 'GET',
      headers,
      mode: 'cors'
    }).catch(() => null);

    // 2. If client CORS block occurred, try no-cors mode
    if (!response || (!response.ok && response.status !== 206)) {
      response = await fetch(targetUrl, {
        method: 'GET',
        headers,
        mode: 'no-cors'
      }).catch(() => null);
    }

    if (response && (response.ok || response.type === 'opaque' || response.status === 206)) {
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('Content-Type', 'video/MP2T');
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, OPTIONS');

      return new Response(response.body, {
        status: response.status || 200,
        headers: responseHeaders
      });
    }

    // 3. Fallback to /api/segment Next.js API Proxy Route if client-side is blocked
    return fetch(`${requestUrl.origin}/api/segment?url=${encodeURIComponent(targetUrl)}`);

  } catch (err) {
    // Fallback to /api/segment
    return fetch(`${requestUrl.origin}/api/segment?url=${encodeURIComponent(targetUrl)}`);
  }
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.pathname === '/sw-segment') {
    event.respondWith(handleSegmentRequest(event.request));
  }
});
