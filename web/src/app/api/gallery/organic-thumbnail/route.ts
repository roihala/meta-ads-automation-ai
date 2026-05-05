import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Proxy for Facebook/Instagram CDN thumbnails. Reasons we need this:
 * (1) FB CDN URLs are short-lived signed URLs that sometimes 403 when fetched
 *     by the browser with a referer header.
 * (2) IG `scontent.cdninstagram.com` URLs occasionally block cross-origin
 *     loads from random domains.
 * Proxying server-side strips the referer and gives us a stable cache window.
 *
 * URL allowlist is enforced — never proxy arbitrary URLs.
 */

const ALLOWED_HOST_SUFFIXES = [
  ".fbcdn.net",
  ".cdninstagram.com",
  ".facebook.com",
  ".instagram.com",
];

function hostAllowed(url: URL): boolean {
  const h = url.hostname.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some((s) => h === s.slice(1) || h.endsWith(s));
}

export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const target = u.searchParams.get("url");
  if (!target) {
    return NextResponse.json({ error: "missing_url" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  }
  if (parsed.protocol !== "https:") {
    return NextResponse.json({ error: "non_https" }, { status: 400 });
  }
  if (!hostAllowed(parsed)) {
    return NextResponse.json({ error: "host_not_allowed", host: parsed.hostname }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(parsed.toString(), {
      cache: "no-store",
      redirect: "follow",
      headers: {
        "user-agent": "Campaigner/1.0 (+thumbnail-proxy)",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch_failed";
    return NextResponse.json({ error: "upstream_fetch_failed", detail: msg }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: "upstream_status", status: upstream.status },
      { status: upstream.status === 404 ? 404 : 502 },
    );
  }

  const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
  if (!contentType.startsWith("image/")) {
    return NextResponse.json({ error: "non_image_response", content_type: contentType }, { status: 502 });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "content-type": contentType,
      // Short cache — these URLs rotate frequently. 5 min is enough to keep
      // navigation snappy without serving deeply stale CDN URLs.
      "cache-control": "private, max-age=300",
    },
  });
}
