import { type NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8000";

async function proxy(req: NextRequest, params: { path: string[] }) {
  const { path } = await params;
  const url = `${BACKEND}/api/${path.join("/")}${req.nextUrl.search}`;

  const headers = new Headers(req.headers);
  headers.delete("host");

  const res = await fetch(url, {
    method: req.method,
    headers,
    body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
    // @ts-expect-error — Next.js 16 requires this to stream the request body
    duplex: "half",
  });

  return new NextResponse(res.body, {
    status: res.status,
    headers: res.headers,
  });
}

export const GET     = (req: NextRequest, { params }: { params: { path: string[] } }) => proxy(req, params);
export const POST    = (req: NextRequest, { params }: { params: { path: string[] } }) => proxy(req, params);
export const PUT     = (req: NextRequest, { params }: { params: { path: string[] } }) => proxy(req, params);
export const DELETE  = (req: NextRequest, { params }: { params: { path: string[] } }) => proxy(req, params);
