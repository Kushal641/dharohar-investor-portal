import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/activate",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
];

const ROLE_HOME: Record<string, string> = {
  investor: "/dashboard",
  internal: "/internal/investors",
  admin: "/admin/dashboard",
};

// SOP v1.1 §12.3: idle timeout, shorter for the admin session.
const IDLE_LIMIT_MS: Record<string, number> = {
  admin: 30 * 60 * 1000,
  internal: 60 * 60 * 1000,
  investor: 60 * 60 * 1000,
};

const LAST_ACTIVE_COOKIE = "portal_last_active";

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

    // Idle timeout (per role). The cookie tracks last activity; absence means
    // the session just started.
    const lastActiveRaw = request.cookies.get(LAST_ACTIVE_COOKIE)?.value;
    const lastActive = lastActiveRaw ? Number(lastActiveRaw) : null;
    const limit = IDLE_LIMIT_MS[role] ?? IDLE_LIMIT_MS.investor;
    if (lastActive && Number.isFinite(lastActive) && Date.now() - lastActive > limit) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      url.searchParams.set("error", "session_expired");
      const redirect = NextResponse.redirect(url);
      redirect.cookies.delete(LAST_ACTIVE_COOKIE);
      return redirect;
    }

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

    // Admin with an enrolled TOTP factor must have completed the challenge
    // (AAL2) before reaching any /admin screen. aal check is cheap (local JWT).
    if (role === "admin" && path.startsWith("/admin")) {
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

    // Record activity for the idle-timeout check.
    response.cookies.set(LAST_ACTIVE_COOKIE, String(Date.now()), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
