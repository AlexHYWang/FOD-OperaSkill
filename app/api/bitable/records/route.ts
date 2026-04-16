/**
 * Bitable 记录 CRUD
 * GET  /api/bitable/records?table=1&team=北京-互联网组
 * POST /api/bitable/records  { table: 1|2, fields: {...} }
 */
import { NextRequest, NextResponse } from "next/server";
import { addRecord, getAllRecords } from "@/lib/feishu";
import { getSession } from "@/lib/session";

function getTableConfig(tableNum: string) {
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  if (!appToken)
    throw new Error("FEISHU_BITABLE_APP_TOKEN 未配置，请先运行 /api/bitable/init");

  const tableId =
    tableNum === "1"
      ? process.env.FEISHU_TABLE1_ID
      : process.env.FEISHU_TABLE2_ID;
  if (!tableId)
    throw new Error(
      `FEISHU_TABLE${tableNum}_ID 未配置，请先运行 /api/bitable/init`
    );

  return { appToken, tableId };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tableNum = searchParams.get("table") || "1";
  const team = searchParams.get("team");
  const taskName = searchParams.get("task");

  try {
    const { appToken, tableId } = getTableConfig(tableNum);

    let filter: string | undefined;
    if (team && tableNum === "1") {
      filter = `CurrentValue.[团队名称]="${team}"`;
    } else if (team && taskName && tableNum === "2") {
      filter = `AND(CurrentValue.[团队名称]="${team}",CurrentValue.[关联任务]="${taskName}")`;
    } else if (team && tableNum === "2") {
      filter = `CurrentValue.[团队名称]="${team}"`;
    }

    const records = await getAllRecords(appToken, tableId, filter);

    return NextResponse.json({
      success: true,
      records: records.map((r) => ({ id: r.record_id, fields: r.fields })),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { table, fields } = body as {
      table: string;
      fields: Record<string, unknown>;
    };

    const { appToken, tableId } = getTableConfig(table);

    // 注入提交者信息
    const enrichedFields = {
      ...fields,
      提交者: [{ id: session.user.open_id }],
      提交时间: Date.now(),
    };

    const record = await addRecord(appToken, tableId, enrichedFields);
    return NextResponse.json({ success: true, record });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
