import type { NextResponse } from 'next/server'

export function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  }
}

export function withCors<T extends NextResponse | Response>(res: T): T {
  const headers = corsHeaders()
  for (const [k, v] of Object.entries(headers)) {
    res.headers.set(k, v)
  }
  return res
}
