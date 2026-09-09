import { type NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL ?? "https://kelana-ai-06269263.fastapicloud.dev";

// params is a Promise in this Next.js version — must await before reading
async function proxy(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const url = `${BACKEND}/api/${path.join("/")}${req.nextUrl.search}`;

  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("content-length");
  headers.delete("transfer-encoding");

  try {
    const res = await fetch(url, {
      method: req.method,
      headers,
      body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
      // @ts-expect-error — Next.js 16 requires this to stream the request body
      duplex: "half",
    });

    const responseHeaders = new Headers();
    res.headers.forEach((value, key) => {
      // Skip headers that Vercel/Next.js manages itself
      if (["transfer-encoding", "connection", "keep-alive"].includes(key.toLowerCase())) return;
      responseHeaders.set(key, value);
    });

    return new NextResponse(res.body, {
      status: res.status,
      headers: responseHeaders,
    });
  } catch (err) {
    // Backend is unreachable (not started, wrong port, etc.)
    const message =
      err instanceof Error && err.message.includes("ECONNREFUSED")
        ? `Cannot reach backend at ${BACKEND}.`
        : `Proxy error: ${err instanceof Error ? err.message : String(err)}`;

    return NextResponse.json({ detail: message }, { status: 503 });
  }
}

export const GET    = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => proxy(req, ctx);
export const POST   = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => proxy(req, ctx);
export const PUT    = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => proxy(req, ctx);
export const PATCH  = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => proxy(req, ctx);
export const DELETE = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => proxy(req, ctx);
