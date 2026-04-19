/**
 * 当前登录用户的画像读写（归属团队 / 角色 / 部门）
 *   GET  /api/user/profile          返回 { team, role, department, isBootstrapped }
 *   POST /api/user/profile { team } 保存归属团队，自动回填部门
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getUserProfile, upsertUserTeam } from "@/lib/user-profile";

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  try {
    const profile = await getUserProfile(
      session.user.open_id,
      session.user.name
    );
    return NextResponse.json({ success: true, profile });
  } catch (err) {
    console.error("[profile] GET 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const team = typeof body?.team === "string" ? body.team.trim() : "";
    if (!team) {
      return NextResponse.json(
        { error: "归属团队不能为空" },
        { status: 400 }
      );
    }
    const profile = await upsertUserTeam(session.user.open_id, team);
    return NextResponse.json({ success: true, profile });
  } catch (err) {
    console.error("[profile] POST 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
