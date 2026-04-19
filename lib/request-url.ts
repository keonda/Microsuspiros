import type { NextRequest } from "next/server";

export function publicUrl(request: NextRequest | Request, path: string) {
  const fallback = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const host = forwardedHost || request.headers.get("host") || fallback.host;
  const proto = forwardedProto || fallback.protocol.replace(":", "") || "https";

  return new URL(path, `${proto}://${host}`);
}
