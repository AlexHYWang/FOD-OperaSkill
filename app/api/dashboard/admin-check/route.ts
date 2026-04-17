/**
 * 管理员身份校验
 * GET /api/dashboard/admin-check
 * 读取 Table3（管理员名单），判断当前登录用户是否在「人员」字段中
 */
import { NextResponse } from "next/server";
import { getAllRecords } from "@/lib/feishu";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json({ isAdmin: false });
  }

  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const table3Id = process.env.FEISHU_TABLE3_ID;

  if (!appToken || !table3Id) {
    return NextResponse.json({ isAdmin: false });
  }

  try {
    const records = await getAllRecords(appToken, table3Id);
    const currentOpenId = session.user.open_id;

    const isAdmin = records.some((r) => {
      const 人员 = r.fields["人员"];
      if (!人员) return false;
      // 飞书 PERSON 字段存储为数组 [{ id: open_id, ... }]
      if (Array.isArray(人员)) {
        return 人员.some(
          (p) =>
            (typeof p === "object" && p !== null && (p as Record<string,string>).id === currentOpenId) ||
            p === currentOpenId
        );
      }
      return false;
    });

    return NextResponse.json({ isAdmin });
  } catch (err) {
    console.error("管理员校验失败:", err);
    return NextResponse.json({ isAdmin: false });
  }
}
