/**
 * 当前用户角色读取 + 管理员指派主管
 *   GET  /api/user/role                     → 返回当前登录用户的 FODRole
 *   POST /api/user/role { openId, isLeader } → 仅 FOD综管 可用；切换某人「是否团队主管」
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  getUserProfile,
  setTeamLeader,
  isAdminUser,
} from "@/lib/user-profile";

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  try {
    const p = await getUserProfile(session.user.open_id, session.user.name);
    return NextResponse.json({
      success: true,
      role: p.roleV4,
      legacyRole: p.role,
      isTeamLeader: p.isTeamLeader,
      team: p.team,
    });
  } catch (err) {
    console.error("[user/role] GET 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const isAdmin = await isAdminUser(session.user.open_id);
  if (!isAdmin) {
    return NextResponse.json(
      { error: "仅 FOD综管 可执行该操作" },
      { status: 403 }
    );
  }
  try {
    const body = await req.json();
    const openId =
      typeof body?.openId === "string" ? body.openId.trim() : "";
    const isLeader = !!body?.isLeader;
    if (!openId) {
      return NextResponse.json(
        { error: "openId 不能为空" },
        { status: 400 }
      );
    }
    const updated = await setTeamLeader(openId, isLeader);
    if (!updated) {
      return NextResponse.json(
        { error: "未在 Table3 中找到该用户" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, profile: updated });
  } catch (err) {
    console.error("[user/role] POST 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
