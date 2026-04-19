/**
 * 管理员身份校验
 * GET /api/dashboard/admin-check
 * 判断当前登录用户是否在 Table3 中且「角色」= 管理员
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isAdminUser } from "@/lib/user-profile";

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json({ isAdmin: false });
  }

  try {
    const isAdmin = await isAdminUser(session.user.open_id);
    return NextResponse.json({ isAdmin });
  } catch (err) {
    console.error("管理员校验失败:", err);
    return NextResponse.json({ isAdmin: false });
  }
}
