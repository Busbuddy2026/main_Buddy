import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 renamed the `middleware` file convention to `proxy`.
 *
 * Host-based routing gives each product its own origin — and so its own cookie
 * scope — while sharing one codebase (README §3). Locally, `admin.localhost`,
 * `parents.localhost` and `crew.localhost` all resolve to 127.0.0.1 in modern
 * browsers, so no hosts-file edit is needed; the `/admin`, `/parent` and
 * `/crew` paths also work directly on plain `localhost`, where the root serves
 * the Bus Buddy marketing site.
 *
 * Sessions are not checked here. Each app's cookie (`gf_admin`, `gf_parent`,
 * `gf_crew`) is host-only, so on the real subdomains another app's cookie
 * never arrives at all. The API enforces the rule that matters: a request to
 * `/api/<app>/*` carrying only another app's cookie gets 403 WRONG_APP, in
 * src/server/auth/session.ts. Pages render their own sign-in screen when the
 * layout finds no session.
 */

/** Subdomain prefix → path prefix. The root is the marketing site. */
const HOST_PREFIX: Record<string, string> = {
  parents: "/parent",
  crew: "/crew",
  admin: "/admin",
};

function subdomainOf(host: string): string | undefined {
  const name = host.split(":")[0];
  const [first, ...rest] = name.split(".");
  // A bare `localhost` or apex domain has no product subdomain.
  return rest.length ? first : undefined;
}

export default function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const sub = subdomainOf(host);
  const prefix = sub ? HOST_PREFIX[sub] : undefined;
  const { pathname } = request.nextUrl;

  // The API is shared by all three hosts and lives at /api on each of them.
  if (prefix && !pathname.startsWith(prefix) && !pathname.startsWith("/api/")) {
    const url = request.nextUrl.clone();
    url.pathname = prefix + pathname;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
