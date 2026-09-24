import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

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
 * Session guards are not here yet. Once the three login flows exist, this is
 * where a `gf_parent` cookie arriving on the admin host gets a 403 rather than
 * a redirect loop.
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

export default async function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const sub = subdomainOf(host);
  const prefix = sub ? HOST_PREFIX[sub] : undefined;

  if (prefix) {
    const url = request.nextUrl.clone();
    if (!url.pathname.startsWith(prefix)) {
      url.pathname = prefix + url.pathname;
      return NextResponse.rewrite(url);
    }
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
