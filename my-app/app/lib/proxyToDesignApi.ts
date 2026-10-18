import { NextRequest, NextResponse } from 'next/server';
import { resolveBackendApiBase } from '@/app/lib/apiBase';

function corsHeaders(req: NextRequest): Headers {
  const origin = req.headers.get('origin') || '*';
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Access-Control-Allow-Methods', 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS');
  headers.set(
    'Access-Control-Allow-Headers',
    req.headers.get('access-control-request-headers') || 'Content-Type, Authorization',
  );
  return headers;
}

export function proxyOptions(req: NextRequest): NextResponse {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function proxyToDesignApi(
  req: NextRequest,
  apiPath: string,
): Promise<NextResponse> {
  const base = resolveBackendApiBase().replace(/\/$/, '');
  const path = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
  const url = `${base}${path}${req.nextUrl.search}`;
  const headers = new Headers();
  const contentType = req.headers.get('content-type');
  if (contentType) headers.set('Content-Type', contentType);
  const auth = req.headers.get('authorization');
  if (auth) headers.set('Authorization', auth);

  const init: RequestInit = { method: req.method, headers };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.arrayBuffer();
  }

  const upstream = await fetch(url, init);
  const body = await upstream.arrayBuffer();
  const outHeaders = corsHeaders(req);
  const upstreamType = upstream.headers.get('content-type');
  if (upstreamType) outHeaders.set('Content-Type', upstreamType);
  return new NextResponse(body, { status: upstream.status, headers: outHeaders });
}
