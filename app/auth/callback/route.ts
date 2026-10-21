import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function GET(request: NextRequest) {
  if (!getSupabaseConfig()) {
    return NextResponse.redirect(new URL("/login?error=not_configured", request.url));
  }

  const code = request.nextUrl.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.redirect(new URL("/login?error=auth_failed", request.url));
}
