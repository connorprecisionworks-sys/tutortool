import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { intendedRole } from "@/lib/auth/user";

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
  "/join",
  "/book",
  "/t",
  "/auth",
  "/about",
  "/privacy",
  "/terms",
  "/api/webhooks",
  "/api/cron",
  // Fetched by third-party calendar apps (Google/Apple/Outlook) polling
  // unattended — never carries a Supabase session cookie, same reasoning
  // as the webhook/cron prefixes above. Authorization is the secret token
  // in the path itself (get_ical_feed), not a user session.
  "/api/ical",
  // next.config.ts rewrites this to PostHog's ingest/asset origins so
  // posthog-js's own requests (config.js, session recording, event
  // capture) never carry a Supabase session cookie either — without this,
  // every logged-out page (starting with the landing page) got these
  // requests silently redirected to /login, and posthog-js choked trying
  // to JSON.parse the login page's HTML back as a PostHog response.
  "/ingest",
];

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => matchesPrefix(pathname, p));
}

// NextResponse.redirect() builds a brand-new response, so any Supabase
// session-cookie refresh already written onto `response` by the setAll()
// callback below would otherwise be silently dropped on every redirect —
// carry it over explicitly.
function redirectWithCookies(url: URL, response: NextResponse) {
  const redirect = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

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
    return redirectWithCookies(url, response);
  }

  const isAuthRedirectPage = pathname === "/login" || pathname.startsWith("/signup");
  const isRoot = pathname === "/";
  const isParentShell = matchesPrefix(pathname, "/parent");
  const isTutorShell = matchesPrefix(pathname, "/tutor");

  // One role lookup, reused by both the post-login redirect and the
  // cross-shell guard below (previously each did its own identical query).
  // Falls back to the intended role captured at signup (user_metadata) when
  // no `users` row exists yet — e.g. a parent mid-email-confirmation who
  // hasn't been backfilled — rather than defaulting to "tutor", which would
  // permanently mis-provision them the moment requireTutor() runs.
  if (user && (isAuthRedirectPage || isRoot || isParentShell || isTutorShell)) {
    const { data: userRow } = await supabase
      .from("users")
      .select("role")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    const role = userRow?.role ?? intendedRole(user);

    // Logged-in visitors never see the marketing landing page — bounce
    // straight to their shell, same target as the post-login redirect.
    if (isAuthRedirectPage || isRoot) {
      const url = request.nextUrl.clone();
      url.pathname = role === "parent" ? "/parent" : "/tutor";
      return redirectWithCookies(url, response);
    }

    // Cross-shell guard: a tutor hitting /parent/* or a parent hitting
    // /tutor/* gets bounced to their own shell. requireTutor()/
    // requireParent() also enforce this server-side; this just avoids the
    // extra round-trip for the common case.
    if (role === "parent" && !isParentShell) {
      const url = request.nextUrl.clone();
      url.pathname = "/parent";
      return redirectWithCookies(url, response);
    }
    if (role !== "parent" && isParentShell) {
      const url = request.nextUrl.clone();
      url.pathname = "/tutor";
      return redirectWithCookies(url, response);
    }
  }

  return response;
}
