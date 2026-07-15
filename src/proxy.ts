import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  // Cron/API routes enforce their own auth (Bearer CRON_SECRET or an admin
  // session) — the middleware's cookie-based gate would otherwise block
  // Vercel Cron's request before it ever reaches that check.
  "/api/sync/run",
];

const ROLE_HOME: Record<string, string> = {
  investor: "/dashboard",
  internal: "/internal/investors",
  admin: "/admin/dashboard",
  founder: "/admin/dashboard",
};

function isInvestorSection(path: string) {
  return path.startsWith("/dashboard") || path.startsWith("/vehicles") || path.startsWith("/account");
}

export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
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
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  // Not signed in -> only public auth pages are reachable.
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Signed in but hitting the login screen -> bounce to their home.
  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (user && !isPublic) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role, is_disabled, must_change_password")
      .eq("id", user.id)
      .single();

    if (!profile || profile.is_disabled) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", profile ? "disabled" : "no_profile");
      return NextResponse.redirect(url);
    }

    const role = profile.role;

    if (profile.must_change_password && path !== "/first-login") {
      const url = request.nextUrl.clone();
      url.pathname = "/first-login";
      return NextResponse.redirect(url);
    }

    if (!profile.must_change_password && path === "/first-login") {
      const url = request.nextUrl.clone();
      url.pathname = ROLE_HOME[role] ?? "/login";
      return NextResponse.redirect(url);
    }

    // Admin/founder with an enrolled TOTP factor must have completed the
    // challenge (AAL2) before reaching any /admin screen. aal check is cheap
    // (local JWT).
    if ((role === "admin" || role === "founder") && path.startsWith("/admin")) {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
        const url = request.nextUrl.clone();
        url.pathname = "/login/mfa";
        return NextResponse.redirect(url);
      }
    }

    // Section guarding — defense in depth (RLS is the real boundary; this
    // just avoids showing the wrong role a page it has no data for).
    const home = ROLE_HOME[role] ?? "/login";

    if (role !== "investor" && isInvestorSection(path)) {
      return NextResponse.redirect(new URL(home, request.url));
    }
    if (role === "investor" && (path.startsWith("/internal") || path.startsWith("/admin"))) {
      return NextResponse.redirect(new URL(home, request.url));
    }
    if (role === "internal" && path.startsWith("/admin")) {
      return NextResponse.redirect(new URL(home, request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
