/**
 * 获取所有已存在的团队名称列表
 * GET /api/bitable/teams
 */
import { NextResponse } from "next/server";
import { getAllRecords } from "@/lib/feishu";
import { PRESET_TEAMS } from "@/lib/constants";

export async function GET() {
  try {
    const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
    const tableId = process.env.FEISHU_TABLE1_ID;

    if (!appToken || !tableId) {
      // Bitable 未初始化，返回预置团队
      return NextResponse.json({ teams: PRESET_TEAMS });
    }

    const records = await getAllRecords(appToken, tableId);
    const teamSet = new Set<string>(PRESET_TEAMS);

    for (const r of records) {
      const name = r.fields["团队名称"];
      if (typeof name === "string" && name.trim()) {
        teamSet.add(name.trim());
      }
    }

    return NextResponse.json({ teams: Array.from(teamSet) });
  } catch (err) {
    console.error("获取团队列表失败:", err);
    return NextResponse.json({ teams: PRESET_TEAMS });
  }
}
