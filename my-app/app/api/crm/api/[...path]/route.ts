import { NextRequest } from 'next/server';
import { proxyOptions, proxyToDesignApi } from '@/app/lib/proxyToDesignApi';

async function handle(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxyToDesignApi(req, `/api/${(path || []).join('/')}`);
}

export const OPTIONS = (req: NextRequest) => proxyOptions(req);
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
