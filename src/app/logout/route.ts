import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase-server";

export async function POST(req: Request) {
  const supabase = await getServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", req.url));
}
