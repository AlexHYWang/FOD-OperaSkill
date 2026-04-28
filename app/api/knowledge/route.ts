import { NextRequest, NextResponse } from "next/server";
import { addRecord, getAllRecords, sendFeishuCardMessage, updateRecord } from "@/lib/feishu";
import { getSession } from "@/lib/session";
import { asBoolean, asString, extractPersonNames, extractUrl, makeBitableFilter } from "@/lib/record-utils";
import { canReviewTeam } from "@/lib/user-profile";
import { normalizeE2EProcessShortName } from "@/lib/constants";

const KNOWLEDGE_TABLE_LINK =
  "https://www.xiaomifod-skill.cn/knowledge";

function formatDateTime(ts: number) {
  if (!Number.isFinite(ts) || ts <= 0) return "-";
  return new Date(ts).toLocaleString("zh-CN", { hour12: false });
}

function getConfig() {
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const tableId = process.env.FEISHU_TABLE7_ID;
  if (!appToken || !tableId) throw new Error("FEISHU_TABLE7_ID 未配置，请先执行 migrate-lifecycle");
  return { appToken, tableId };
}

function mapRecord(record: { record_id: string; fields: Record<string, unknown> }) {
  const f = record.fields;
  return {
    id: record.record_id,
    title: asString(f["条目标题"]),
    team: asString(f["团队名称"]),
    process: normalizeE2EProcessShortName(asString(f["端到端流程"])),
    section: asString(f["流程环节"] || f["环节"]),
    node: asString(f["流程节点"] || f["节点"]),
    scene: asString(f["关联场景名"]),
    materialType: asString(f["资料类型"]),
    source: asString(f["资料来源"]),
    fileName: asString(f["文件名称"]),
    fileUrl: extractUrl(f["文件链接"]),
    fileToken: asString(f["文件Token"]),
    version: asString(f["版本号"]) || "v1.0",
    status: asString(f["状态"]),
    isCurrent: asBoolean(f["是否当前版本"]),
    submitters: extractPersonNames(f["提交者"]),
    reviewers: extractPersonNames(f["审核人"]),
    submittedAt: Number(f["提交时间"] || 0),
    reviewedAt: Number(f["审核时间"] || 0),
    publishedAt: Number(f["发布时间"] || 0),
    rejectReason: asString(f["退回原因"]),
    bindScope: asString(f["绑定范围"]),
    remark: asString(f["备注"]),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { appToken, tableId } = getConfig();
    const sp = req.nextUrl.searchParams;
    const team = sp.get("team") || "";
    const status = sp.get("status") || "";
    const scene = sp.get("scene") || "";
    const process = normalizeE2EProcessShortName(sp.get("process") || "");
    const filter = makeBitableFilter([
      team ? `CurrentValue.[团队名称]="${team}"` : undefined,
      status ? `CurrentValue.[状态]="${status}"` : undefined,
      scene ? `CurrentValue.[关联场景名]="${scene}"` : undefined,
      process ? `CurrentValue.[端到端流程]="${process}"` : undefined,
      sp.get("current") === "1" && `CurrentValue.[是否当前版本]=true`,
    ]);
    const records = await getAllRecords(appToken, tableId, filter);
    const items = records.map(mapRecord).sort((a, b) => b.submittedAt - a.submittedAt);
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
    const { appToken, tableId } = getConfig();
    const body = await req.json();
    const title = asString(body.title);
    const team = asString(body.team);
    const process = normalizeE2EProcessShortName(asString(body.process));
    const bindScope = asString(body.bindScope) || "节点";
    const scene = asString(body.scene);
    if (!title || !team || !process) {
      return NextResponse.json({ error: "条目标题、团队、E2E 流程均不能为空" }, { status: 400 });
    }
    if (!["节点", "场景"].includes(bindScope)) {
      return NextResponse.json({ error: "绑定范围仅支持“节点”或“场景”" }, { status: 400 });
    }
    if (bindScope === "场景" && !scene) {
      return NextResponse.json({ error: "绑定范围为场景时，关联场景名不能为空" }, { status: 400 });
    }
    const now = Date.now();
    const fileUrl = asString(body.fileUrl);
    const fileName = asString(body.fileName) || fileUrl;
    const fields: Record<string, unknown> = {
      条目标题: title,
      团队名称: team,
      端到端流程: process,
      流程环节: asString(body.section),
      流程节点: asString(body.node),
      关联场景名: bindScope === "场景" ? scene : "",
      绑定范围: bindScope,
      资料类型: asString(body.materialType) || "规则",
      资料来源: asString(body.source) || "飞书云文档",
      文件名称: fileName,
      文件Token: asString(body.fileToken),
      版本号: asString(body.version) || "v1.0",
      状态: "待审核",
      是否当前版本: false,
      提交者: [{ id: session.user.open_id }],
      提交人open_id: asString(body.submitterOpenId) || session.user.open_id,
      提交时间: now,
      备注: asString(body.remark),
    };
    if (fileUrl) fields["文件链接"] = { link: fileUrl, text: fileName || fileUrl };
    const record = await addRecord(appToken, tableId, fields);
    return NextResponse.json({ success: true, id: record.record_id });
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
    const { appToken, tableId } = getConfig();
    const body = await req.json();
    const recordId = asString(body.recordId);
    const action = asString(body.action);
    if (!recordId) return NextResponse.json({ error: "recordId 不能为空" }, { status: 400 });

    const current = (await getAllRecords(appToken, tableId)).find((r) => r.record_id === recordId);
    if (!current) return NextResponse.json({ error: "记录不存在" }, { status: 404 });
    const team = asString(current.fields["团队名称"]);
    if (!(await canReviewTeam(session.user.open_id, team))) {
      return NextResponse.json({ error: "仅管理员或本团队主管可审核知识库" }, { status: 403 });
    }

    const now = Date.now();
    const fields: Record<string, unknown> = {
      审核人: [{ id: session.user.open_id }],
      审核时间: now,
    };
    if (action === "publish") {
      fields["状态"] = "已发布";
      fields["是否当前版本"] = true;
      fields["发布时间"] = now;
      const scene = asString(current.fields["关联场景名"]);
      const process = asString(current.fields["端到端流程"]);
      const normalizedProcess = normalizeE2EProcessShortName(process);
      const peers = await getAllRecords(
        appToken,
        tableId,
        makeBitableFilter([
          `CurrentValue.[团队名称]="${team}"`,
          scene && `CurrentValue.[关联场景名]="${scene}"`,
          !scene &&
            process &&
            normalizedProcess &&
            normalizedProcess !== process &&
            `(CurrentValue.[端到端流程]="${process}" OR CurrentValue.[端到端流程]="${normalizedProcess}")`,
          !scene &&
            process &&
            (!normalizedProcess || normalizedProcess === process) &&
            `CurrentValue.[端到端流程]="${process}"`,
        ])
      );
      await Promise.all(
        peers
          .filter((p) => p.record_id !== recordId && asBoolean(p.fields["是否当前版本"]))
          .map((p) => updateRecord(appToken, tableId, p.record_id, { 是否当前版本: false }))
      );
    } else if (action === "reject") {
      fields["状态"] = "已退回";
      fields["退回原因"] = asString(body.rejectReason || body.remark);
    } else if (action === "archive") {
      fields["状态"] = "已归档";
      fields["是否当前版本"] = false;
    } else {
      return NextResponse.json({ error: `未知操作: ${action}` }, { status: 400 });
    }
    await updateRecord(appToken, tableId, recordId, fields);

    // ⑪ 审核后通知提交人（发布 / 退回）
    if (action === "publish" || action === "reject") {
      try {
        const title = asString(current.fields["条目标题"]);
        const version = asString(current.fields["版本号"]) || "v1.0";
        const submitterOpenId = asString(current.fields["提交人open_id"] || current.fields["提交者open_id"] || "");
        const submitterNames = extractPersonNames(current.fields["提交者"]);
        const submitterName = submitterNames[0] || "同学";
        // 若有 person 类型的提交者字段，尝试提取第一个 open_id
        const submitterPersonField = current.fields["提交者"];
        let finalOpenId = submitterOpenId;
        if (!finalOpenId && Array.isArray(submitterPersonField) && submitterPersonField.length > 0) {
          const first = submitterPersonField[0] as { id?: string; open_id?: string };
          finalOpenId = first?.id || first?.open_id || "";
        }
        if (finalOpenId) {
          const resultText = action === "publish" ? "已通过并发布" : "已退回";
          const effectiveText = action === "publish" ? "已生效" : "未生效";
          const card = {
            config: { wide_screen_mode: true, enable_forward: true },
            header: {
              template: action === "publish" ? "green" : "orange",
              title: { tag: "plain_text", content: "FOD OperaSkill｜知识库审核结果" },
            },
            elements: [
              {
                tag: "markdown",
                content: [
                  `👋 **你好**：${submitterName}`,
                  `📚 **你提交的知识库条目**：《${title}》`,
                  `✅ **审核结果**：${resultText}`,
                  `🏷️ **版本**：${version}`,
                  `⚙️ **生效状态**：${effectiveText}`,
                  `🕒 **审核时间**：${formatDateTime(now)}`,
                  action === "reject" ? `📝 **退回原因**：${asString(body.rejectReason || "未说明")}` : "",
                ]
                  .filter(Boolean)
                  .join("\n"),
              },
              { tag: "hr" },
              {
                tag: "action",
                actions: [
                  {
                    tag: "button",
                    text: { tag: "plain_text", content: "查看知识库条目明细" },
                    type: "primary",
                    url: KNOWLEDGE_TABLE_LINK,
                  },
                ],
              },
            ],
          };
          await sendFeishuCardMessage(finalOpenId, card);
        }
      } catch (notifyErr) {
        console.warn("[knowledge] 飞书消息通知失败（不影响主流程）:", notifyErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[knowledge] PATCH 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
