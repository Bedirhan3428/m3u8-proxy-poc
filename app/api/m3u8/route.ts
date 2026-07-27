import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60; // Max execution time for Vercel Serverless
export const dynamic = 'force-dynamic';

function buildProxyUrl(targetAbsoluteUrl: string, proxyBaseUrl: string): string {
  try {
    const urlObj = new URL(targetAbsoluteUrl);
    const pathname = urlObj.pathname.toLowerCase();

    if (pathname.endsWith('.m3u8') || urlObj.search.toLowerCase().includes('.m3u8')) {
      return `${proxyBaseUrl}/api/m3u8?url=${encodeURIComponent(targetAbsoluteUrl)}`;
    }
  } catch (e) {
    return targetAbsoluteUrl;
  }

  return `${proxyBaseUrl}/api/segment?url=${encodeURIComponent(targetAbsoluteUrl)}`;
}

function rewriteM3u8Manifest(manifestText: string, targetUrl: string, proxyBaseUrl: string): string {
  const targetObj = new URL(targetUrl);
  const lines = manifestText.split(/\r?\n/);

  const rewrittenLines = lines.map(line => {
    const trimmed = line.trim();

    if (!trimmed) return line;

    if (trimmed.startsWith('#')) {
      if (trimmed.includes('URI="')) {
        return line.replace(/URI="([^"]+)"/g, (match, p1) => {
          if (p1.startsWith('data:')) return match;
          let absUrl: string;
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

    let absoluteTargetUrl: string;
    try {
      absoluteTargetUrl = new URL(trimmed, targetObj).href;
    } catch (e) {
      return line;
    }

    return buildProxyUrl(absoluteTargetUrl, proxyBaseUrl);
  });

  return rewrittenLines.join('\n');
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'Missing required query parameter "url"' }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch (err) {
    return NextResponse.json({ error: 'Invalid target URL format provided.' }, { status: 400 });
  }

  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  const proxyBaseUrl = `${protocol}://${host}`;

  try {
    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': `${parsedUrl.origin}/`,
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site'
      },
      cache: 'no-store'
    });

    if (!res.ok) {
      return NextResponse.json({
        error: `Failed to fetch target M3U8 manifest (Status: ${res.status})`,
        targetUrl
      }, { status: res.status });
    }

    const manifestText = await res.text();
    const rewrittenManifest = rewriteM3u8Manifest(manifestText, targetUrl, proxyBaseUrl);

    return new NextResponse(rewrittenManifest, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error: any) {
    return NextResponse.json({
      error: 'Failed to fetch M3U8 manifest on Vercel',
      details: error.message,
      targetUrl
    }, { status: 502 });
  }
}
