import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const BACKEND = process.env.BACKEND_URL ?? "https://kelana-ai-06269263.fastapicloud.dev";

// Hop-by-hop and encoding headers that must not be forwarded
const STRIP_REQ = new Set([
  "host", "connection", "keep-alive", "transfer-encoding",
  "te", "upgrade", "proxy-authorization", "proxy-authenticate",
  "accept-encoding", "content-length",
]);

const STRIP_RES = new Set([
  "connection", "keep-alive", "transfer-encoding",
  "te", "upgrade", "content-encoding", "content-length",
]);

async function proxy(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  const url = `${BACKEND}/api/${path.join("/")}${req.nextUrl.search}`;

  // Build clean request headers
  const reqHeaders: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    if (!STRIP_REQ.has(key.toLowerCase())) {
      reqHeaders[key] = value;
    }
  });

  // Buffer body — streaming is unreliable on Vercel
  let body: string | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await req.text();
    if (body === "") body = undefined;
    if (body) {
      reqHeaders["content-length"] = Buffer.byteLength(body).toString();
    }
  }

  try {
    const res = await fetch(url, {
      method: req.method,
      headers: reqHeaders,
      body,
    });

    // Read as buffer — avoids any re-encoding by the runtime
    const resBuffer = await res.arrayBuffer();

    // Build clean response headers
    const resHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      if (!STRIP_RES.has(key.toLowerCase())) {
        resHeaders[key] = value;
      }
    });

    return new NextResponse(resBuffer, {
      status: res.status,
      headers: resHeaders,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ detail: `Proxy error: ${message}` }, { status: 503 });
  }
}

export const GET    = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => proxy(req, ctx);
export const POST   = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => proxy(req, ctx);
export const PUT    = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => proxy(req, ctx);
export const PATCH  = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => proxy(req, ctx);
export const DELETE = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => proxy(req, ctx);
