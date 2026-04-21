/**
 * Skill 注册中心（Table8）API
 *   GET   /api/skills?team=XXX[&status=YYY]  列表
 *   POST  /api/skills                         新建 Skill（默认状态=训练中）
 *   PATCH /api/skills { recordId, action, ... }
 *        action 取值：
 *          - advance-to-eval      训练中 → 评测中
 *          - advance-to-debug     评测中 → 生产调试中
 *          - release              生产调试中 → 已发布（填 上线时间）
 *          - offline              已发布 → 已下线
 *          - revert               回退到上一步
 *          - update-accuracy      更新最新准确率(%)
 *          - update-version       更新当前版本
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { addRecord, getAllRecords, updateRecord } from "@/lib/feishu";

const STATUS_ORDER = [
  "训练中",
  "评测中",
  "生产调试中",
  "已发布",
  "已下线",
] as const;

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v))
    return v
      .map((x) =>
        typeof x === "string"
          ? x
          : x && typeof x === "object" && "text" in x
          ? (x as { text?: string }).text || ""
          : ""
      )
      .filter(Boolean)
      .join("");
  if (v && typeof v === "object" && "text" in (v as object))
    return (v as { text?: string }).text || "";
  return "";
}
function asNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
function extractPersonNames(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((p) =>
      typeof p === "string"
        ? p
        : p && typeof p === "object"
        ? ((p as { name?: string }).name || "")
        : ""
    )
    .filter(Boolean);
}

function getT8() {
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const tableId = process.env.FEISHU_TABLE8_ID;
  if (!appToken || !tableId) {
    throw new Error("FEISHU_TABLE8_ID 未配置，请先执行 migrate-v4");
  }
  return { appToken, tableId };
}

export async function GET(req: NextRequest) {
  try {
    const { appToken, tableId } = getT8();
    const team = req.nextUrl.searchParams.get("team") || "";
    const status = req.nextUrl.searchParams.get("status") || "";
    const filters: string[] = [];
    if (team) filters.push(`CurrentValue.[团队名称]="${team}"`);
    if (status) filters.push(`CurrentValue.[状态]="${status}"`);
    const filter = filters.length
      ? filters.length === 1
        ? filters[0]
        : `AND(${filters.join(",")})`
      : undefined;
    const all = await getAllRecords(appToken, tableId, filter);
    const items = all
      .map((r) => ({
        recordId: r.record_id,
        name: asString(r.fields["Skill名称"]),
        team: asString(r.fields["团队名称"]),
        e2e: asString(r.fields["端到端流程"]),
        stage: asString(r.fields["环节"]),
        node: asString(r.fields["节点"]),
        scene: asString(r.fields["关联场景名"]),
        knowledgeRef: asString(r.fields["关联知识库条目"]),
        version: asString(r.fields["当前版本"]) || "v1.0",
        status: asString(r.fields["状态"]) || "训练中",
        ownerNames: extractPersonNames(r.fields["负责人"]),
        accuracy: asNumber(r.fields["最新准确率(%)"]),
        createdAt: asNumber(r.fields["创建时间"]),
        launchedAt: asNumber(r.fields["上线时间"]),
        updatedAt: asNumber(r.fields["更新时间"]),
        remark: asString(r.fields["备注"]),
      }))
      .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
    return NextResponse.json({ success: true, items });
  } catch (err) {
    console.error("[skills] GET 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  try {
    const { appToken, tableId } = getT8();
    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json(
        { error: "Skill 名称不能为空" },
        { status: 400 }
      );
    }
    const now = Date.now();
    const fields: Record<string, unknown> = {
      Skill名称: name,
      团队名称: String(body?.team || ""),
      端到端流程: String(body?.e2e || ""),
      环节: String(body?.stage || ""),
      节点: String(body?.node || ""),
      关联场景名: String(body?.scene || ""),
      关联知识库条目: String(body?.knowledgeRef || ""),
      当前版本: String(body?.version || "v1.0"),
      状态: "训练中",
      负责人: [{ id: session.user.open_id }],
      最新准确率: 0,
      创建时间: now,
      更新时间: now,
      备注: String(body?.remark || ""),
    };
    // feishu 多维表的数字字段里"最新准确率(%)"名字带括号，这里显式写完整 key
    fields["最新准确率(%)"] = 0;
    delete fields["最新准确率"];
    const rec = await addRecord(appToken, tableId, fields);
    return NextResponse.json({ success: true, recordId: rec.record_id });
  } catch (err) {
    console.error("[skills] POST 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  try {
    const { appToken, tableId } = getT8();
    const body = await req.json();
    const recordId =
      typeof body?.recordId === "string" ? body.recordId.trim() : "";
    const action = String(body?.action || "");
    if (!recordId) {
      return NextResponse.json(
        { error: "recordId 不能为空" },
        { status: 400 }
      );
    }
    const now = Date.now();
    const fields: Record<string, unknown> = { 更新时间: now };
    const currentStatus = String(body?.currentStatus || "");
    const idx = STATUS_ORDER.indexOf(currentStatus as (typeof STATUS_ORDER)[number]);

    switch (action) {
      case "advance-to-eval":
        fields["状态"] = "评测中";
        break;
      case "advance-to-debug":
        fields["状态"] = "生产调试中";
        break;
      case "release":
        fields["状态"] = "已发布";
        fields["上线时间"] = now;
        break;
      case "offline":
        fields["状态"] = "已下线";
        break;
      case "revert":
        if (idx <= 0) {
          return NextResponse.json(
            { error: "已经是最初状态，无法回退" },
            { status: 400 }
          );
        }
        fields["状态"] = STATUS_ORDER[idx - 1];
        break;
      case "update-accuracy": {
        const acc = Number(body?.accuracy);
        if (!Number.isFinite(acc)) {
          return NextResponse.json(
            { error: "accuracy 必须是数字" },
            { status: 400 }
          );
        }
        fields["最新准确率(%)"] = acc;
        break;
      }
      case "update-version": {
        const ver = String(body?.version || "").trim();
        if (!ver) {
          return NextResponse.json(
            { error: "version 不能为空" },
            { status: 400 }
          );
        }
        fields["当前版本"] = ver;
        break;
      }
      default:
        return NextResponse.json(
          { error: `未知 action: ${action}` },
          { status: 400 }
        );
    }

    await updateRecord(appToken, tableId, recordId, fields);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[skills] PATCH 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
