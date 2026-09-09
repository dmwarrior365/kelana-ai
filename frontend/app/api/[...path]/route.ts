import { type NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL ?? "https://kelana-ai-06269263.fastapicloud.dev";

// Hop-by-hop headers that must not be forwarded
const HOP_BY_HOP = new Set([
  "host",
  "connection",
  "keep-alive",
  "transfer-encoding",
  "te",
  "upgrade",
  "proxy-authorization",
  "proxy-authenticate",
  // Prevent double-decompression: Next.js fetch decodes the body, so
  // forwarding these causes ERR_CONTENT_DECODING_FAILED in the browser
  "accept-encoding",
  "content-encoding",
  // Let fetch set the correct content-length for the buffered body
  "content-length",
]);

async function proxy(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  const url = `${BACKEND}/api/${path.join("/")}${req.nextUrl.search}`;

  // Build a clean set of request headers
  const reqHeaders: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      reqHeaders[key] = value;
    }
  });

  // Buffer the body — streaming (req.body + duplex:"half") is unreliable on Vercel
  let body: string | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await req.text();
    if (body === "") body = undefined;
  }

  try {
    const res = await fetch(url, {
      method: req.method,
      headers: reqHeaders,
      body,
    });

    // Read the response as text so Next.js fully decodes any compression
    const resText = await res.text();

    // Build clean response headers (no hop-by-hop, no encoding headers)
    const resHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      if (!HOP_BY_HOP.has(key.toLowerCase())) {
        resHeaders[key] = value;
      }
    });
    // Body is already decoded — tell the browser it's plain text/json
    delete resHeaders["content-encoding"];

    return new NextResponse(resText, {
      status: res.status,
      headers: resHeaders,
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? `Proxy error: ${err.message}`
        : `Proxy error: ${String(err)}`;
    return NextResponse.json({ detail: message }, { status: 503 });
  }
}

export const GET    = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => proxy(req, ctx);
export const POST   = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => proxy(req, ctx);
export const PUT    = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => proxy(req, ctx);
export const PATCH  = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => proxy(req, ctx);
export const DELETE = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => proxy(req, ctx);
