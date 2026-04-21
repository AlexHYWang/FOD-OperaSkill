/**
 * 知识库条目 CRUD（Table7）· prd_mock v2 统一管理中心
 *   GET  /api/knowledge?status=已提取&team=XXX&process=XXX&section=XXX&node=XXX&scene=XXX
 *   POST /api/knowledge         → 一线操作 创建条目（状态=已提取）
 *   PATCH /api/knowledge { recordId, action } →
 *      action=govern           → FOD一线AI管理 把 已提取 推到 治理中
 *      action=consolidate      → FOD综管 把 治理中 推到 已整合
 *      action=publish          → FOD综管/一线AI管理 把 治理中/已整合 推到 已发布（写版本号 + 是否当前版本=true）
 *      action=archive          → 归档
 *      action=revert-to-extracted → 退回
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  getAllRecords,
  addRecord,
  updateRecord,
} from "@/lib/feishu";

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    return v
      .map((x) => {
        if (typeof x === "string") return x;
        if (x && typeof x === "object" && "text" in x)
          return (x as { text?: string }).text || "";
        return "";
      })
      .filter(Boolean)
      .join("");
  }
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
    .map((p) => {
      if (typeof p === "string") return p;
      if (p && typeof p === "object") {
        const o = p as Record<string, unknown>;
        return (o.name as string) || "";
      }
      return "";
    })
    .filter(Boolean);
}

export interface KnowledgeItem {
  recordId: string;
  title: string;
  team: string;
  process: string;
  section: string;
  node: string;
  scene: string;
  fileUrl: string;
  extractorNames: string[];
  governorNames: string[];
  consolidatorNames: string[];
  status: "已提取" | "治理中" | "已整合" | "已发布" | "已归档" | "";
  version: string;
  /** 是否当前上线版本（发布后真理性字段） */
  isCurrent: boolean;
  extractedAt: number;
  governedAt: number;
  consolidatedAt: number;
  updatedAt: number;
  remark: string;
}

function mapRecord(r: { record_id: string; fields: Record<string, unknown> }): KnowledgeItem {
  const f = r.fields;
  return {
    recordId: r.record_id,
    title: asString(f["条目标题"]),
    team: asString(f["团队名称"]),
    process: asString(f["端到端流程"]),
    section: asString(f["环节"]),
    node: asString(f["节点"]),
    scene: asString(f["关联场景名"]),
    fileUrl:
      asString(f["文件链接"]) ||
      (typeof f["文件链接"] === "object" && f["文件链接"] !== null
        ? ((f["文件链接"] as { link?: string }).link || "")
        : ""),
    extractorNames: extractPersonNames(f["提取人"]),
    governorNames: extractPersonNames(f["治理人"]),
    consolidatorNames: extractPersonNames(f["整合人"]),
    status: (asString(f["状态"]) || "") as KnowledgeItem["status"],
    version: asString(f["版本号"]),
    isCurrent:
      f["是否当前版本"] === true ||
      f["是否当前版本"] === 1 ||
      f["是否当前版本"] === "true",
    extractedAt: asNumber(f["提取时间"]),
    governedAt: asNumber(f["治理时间"]),
    consolidatedAt: asNumber(f["整合时间"]),
    updatedAt: asNumber(f["更新时间"]),
    remark: asString(f["备注"]),
  };
}

function getTable7() {
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const tableId = process.env.FEISHU_TABLE7_ID;
  if (!appToken || !tableId) {
    throw new Error(
      "FEISHU_TABLE7_ID 未配置，请先执行 POST /api/bitable/migrate-v4 并把返回的 tableId 写入 .env.local"
    );
  }
  return { appToken, tableId };
}

export async function GET(req: NextRequest) {
  try {
    const { appToken, tableId } = getTable7();
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status") || "";
    const team = sp.get("team") || "";
    const process = sp.get("process") || "";
    const section = sp.get("section") || "";
    const node = sp.get("node") || "";
    const scene = sp.get("scene") || "";
    const submitter = sp.get("submitter") || "";
    const current = sp.get("current") || "";

    const filters: string[] = [];
    if (status) filters.push(`CurrentValue.[状态]="${status}"`);
    if (team) filters.push(`CurrentValue.[团队名称]="${team}"`);
    if (process) filters.push(`CurrentValue.[端到端流程]="${process}"`);
    if (section) filters.push(`CurrentValue.[环节]="${section}"`);
    if (node) filters.push(`CurrentValue.[节点]="${node}"`);
    if (scene) filters.push(`CurrentValue.[关联场景名]="${scene}"`);
    const filter = filters.length
      ? filters.length === 1
        ? filters[0]
        : `AND(${filters.join(",")})`
      : undefined;

    const all = await getAllRecords(appToken, tableId, filter);
    let items = all
      .map(mapRecord)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    if (submitter) {
      items = items.filter((it) => it.extractorNames.includes(submitter));
    }
    if (current === "1") {
      items = items.filter((it) => it.isCurrent);
    }
    return NextResponse.json({ success: true, items });
  } catch (err) {
    console.error("[knowledge] GET 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  try {
    const { appToken, tableId } = getTable7();
    const body = await req.json();
    const title =
      typeof body?.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json(
        { error: "条目标题不能为空" },
        { status: 400 }
      );
    }
    const now = Date.now();
    const fields: Record<string, unknown> = {
      条目标题: title,
      团队名称: String(body?.team || ""),
      端到端流程: String(body?.process || ""),
      环节: String(body?.section || ""),
      节点: String(body?.node || ""),
      关联场景名: String(body?.scene || ""),
      提取人: [{ id: session.user.open_id }],
      状态: "已提取",
      版本号: String(body?.version || "v1.0"),
      是否当前版本: false,
      提取时间: now,
      更新时间: now,
      备注: String(body?.remark || ""),
    };
    const fileUrl =
      typeof body?.fileUrl === "string" ? body.fileUrl.trim() : "";
    if (fileUrl) {
      fields["文件链接"] = { link: fileUrl, text: fileUrl };
    }
    const rec = await addRecord(appToken, tableId, fields);
    return NextResponse.json({ success: true, recordId: rec.record_id });
  } catch (err) {
    console.error("[knowledge] POST 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  try {
    const { appToken, tableId } = getTable7();
    const body = await req.json();
    const recordId =
      typeof body?.recordId === "string" ? body.recordId.trim() : "";
    const action = String(body?.action || "");
    const remark = typeof body?.remark === "string" ? body.remark : undefined;
    if (!recordId) {
      return NextResponse.json(
        { error: "recordId 不能为空" },
        { status: 400 }
      );
    }

    const now = Date.now();
    const fields: Record<string, unknown> = { 更新时间: now };
    if (remark !== undefined) fields["备注"] = remark;

    switch (action) {
      case "govern":
        fields["状态"] = "治理中";
        fields["治理人"] = [{ id: session.user.open_id }];
        fields["治理时间"] = now;
        break;
      case "consolidate":
        fields["状态"] = "已整合";
        fields["整合人"] = [{ id: session.user.open_id }];
        fields["整合时间"] = now;
        break;
      case "publish": {
        // 发布：把该 process/section/node/scene 的旧当前版本置 false，新版本置 true
        fields["状态"] = "已发布";
        fields["整合人"] = [{ id: session.user.open_id }];
        fields["整合时间"] = now;
        const version = String(body?.version || "").trim();
        if (version) fields["版本号"] = version;
        fields["是否当前版本"] = true;
        // 把同一 scene/node/section/process 下的其他已发布记录置 false
        try {
          const currentRecord = await getAllRecords(appToken, tableId).then(
            (rs) => rs.find((r) => r.record_id === recordId)
          );
          if (currentRecord) {
            const cf = currentRecord.fields;
            const scope = {
              process: asString(cf["端到端流程"]),
              section: asString(cf["环节"]),
              node: asString(cf["节点"]),
              scene: asString(cf["关联场景名"]),
            };
            const filters = [
              scope.scene && `CurrentValue.[关联场景名]="${scope.scene}"`,
              scope.node && `CurrentValue.[节点]="${scope.node}"`,
              scope.section && `CurrentValue.[环节]="${scope.section}"`,
              scope.process && `CurrentValue.[端到端流程]="${scope.process}"`,
            ].filter(Boolean) as string[];
            const f =
              filters.length > 1 ? `AND(${filters.join(",")})` : filters[0];
            if (f) {
              const peers = await getAllRecords(appToken, tableId, f);
              await Promise.all(
                peers
                  .filter(
                    (p) =>
                      p.record_id !== recordId &&
                      (p.fields["是否当前版本"] === true ||
                        p.fields["是否当前版本"] === 1)
                  )
                  .map((p) =>
                    updateRecord(appToken, tableId, p.record_id, {
                      是否当前版本: false,
                      更新时间: now,
                    })
                  )
              );
            }
          }
        } catch (err) {
          console.warn("[knowledge] publish 旧版本降级失败：", err);
        }
        break;
      }
      case "archive":
        fields["状态"] = "已归档";
        fields["整合人"] = [{ id: session.user.open_id }];
        fields["是否当前版本"] = false;
        break;
      case "revert-to-extracted":
        fields["状态"] = "已提取";
        break;
      default:
        return NextResponse.json(
          { error: `未知 action: ${action}` },
          { status: 400 }
        );
    }

    await updateRecord(appToken, tableId, recordId, fields);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[knowledge] PATCH 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
