import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60; // Max execution time for Vercel Serverless
export const dynamic = 'force-dynamic';

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

  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': `${parsedUrl.origin}/`,
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'cross-site'
  };

  const rangeHeader = request.headers.get('range');
  if (rangeHeader) {
    headers['Range'] = rangeHeader;
  }

  try {
    const res = await fetch(targetUrl, {
      method: 'GET',
      headers,
      cache: 'no-store'
    });

    if (!res.ok && res.status !== 206) {
      return NextResponse.json({
        error: `Failed to fetch video segment (Status: ${res.status})`,
        targetUrl
      }, { status: res.status });
    }

    const responseHeaders = new Headers();
    // Force Content-Type to video/MP2T so HLS player receives proper MPEG-TS stream
    responseHeaders.set('Content-Type', 'video/MP2T');
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD');
    responseHeaders.set('Access-Control-Allow-Headers', '*');

    const contentLength = res.headers.get('content-length');
    if (contentLength) responseHeaders.set('Content-Length', contentLength);

    const contentRange = res.headers.get('content-range');
    if (contentRange) responseHeaders.set('Content-Range', contentRange);

    const acceptRanges = res.headers.get('accept-ranges');
    if (acceptRanges) responseHeaders.set('Accept-Ranges', acceptRanges);

    return new NextResponse(res.body, {
      status: res.status,
      headers: responseHeaders
    });

  } catch (error: any) {
    return NextResponse.json({
      error: 'Failed to fetch segment on Vercel',
      details: error.message,
      targetUrl
    }, { status: 502 });
  }
}
