import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json({ isLoggedIn: false });
  }
  return NextResponse.json({ isLoggedIn: true, user: session.user });
}
