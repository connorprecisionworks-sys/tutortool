import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

// Only these two /api prefixes are public at the proxy layer: webhook
// routes (Stripe) carry no Supabase session cookie, and the cron route
// authenticates itself via CRON_SECRET, not a user session.
// Deliberately scoped to exact prefixes, not all of /api — every other API
// route still gets the default-deny session gate for free, same as pages.
// If a new route needs to be public, add its exact prefix here explicitly;
// don't widen this to a blanket "/api".
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup/tutor",
  "/signup/parent",
  "/auth",
  "/api/webhooks",
  "/api/cron",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// TODO(connor): this is the P0-P5 single-role (tutor-only) version — it sends
// every signed-in user to /tutor. P6 adds the `users` table with `role` and
// this gets a role lookup so parents land on /parent instead. See the P6
// commit for the updated version.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname.startsWith("/signup"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/tutor";
    return NextResponse.redirect(url);
  }

  return response;
}
