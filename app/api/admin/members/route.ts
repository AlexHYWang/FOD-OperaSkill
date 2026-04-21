/**
 * 成员管理接口（仅 FOD综管 可用）
 *
 *   GET  /api/admin/members
 *     → { success, groupedByTeam: { [team]: UserProfile[] } }
 *
 *   POST /api/admin/members { openId, isLeader }
 *     → 切换某人「是否团队主管」，联动更新「角色V4」
 *
 * 底层实现复用 lib/user-profile.ts 的 listAllMembersByTeam / setTeamLeader。
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  isAdminUser,
  listAllMembersByTeam,
  setTeamLeader,
} from "@/lib/user-profile";

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const isAdmin = await isAdminUser(session.user.open_id);
  if (!isAdmin) {
    return NextResponse.json(
      { error: "仅 FOD综管 可访问成员管理" },
      { status: 403 }
    );
  }
  try {
    const grouped = await listAllMembersByTeam();
    return NextResponse.json({ success: true, groupedByTeam: grouped });
  } catch (err) {
    console.error("[admin/members] GET 失败:", err);
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
        { error: "未找到该成员" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, profile: updated });
  } catch (err) {
    console.error("[admin/members] POST 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
