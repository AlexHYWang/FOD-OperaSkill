/**
 * v4：Table1 增加多选列「归属范式」+ 6 个预置选项（幂等，不覆写历史记录）。
 * POST /api/bitable/migrate-v4
 *
 * 建议：升级包含本字段的前端前在目标环境执行一次本接口。
 */
import { NextResponse } from "next/server";
import { ensureField } from "@/lib/feishu";
import { getTable1ParadigmBitableField } from "@/lib/bitable-table1-paradigm";

export async function POST() {
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  if (!appToken) {
    return NextResponse.json(
      { error: "FEISHU_BITABLE_APP_TOKEN 未配置" },
      { status: 500 }
    );
  }

  const table1Id = process.env.FEISHU_TABLE1_ID;
  if (!table1Id) {
    return NextResponse.json(
      { error: "FEISHU_TABLE1_ID 未配置" },
      { status: 500 }
    );
  }

  try {
    const field = getTable1ParadigmBitableField();
    const created = await ensureField(appToken, table1Id, field);
    return NextResponse.json({
      success: true,
      message: created
        ? "已创建「归属范式」字段与 6 个选项，历史行可为空，由前端/用户后续补全"
        : "「归属范式」字段已存在，已跳过创建",
      table: "Table1 · 流程节点映射",
      tableId: table1Id,
      createdField: created,
    });
  } catch (err) {
    console.error("migrate-v4 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
