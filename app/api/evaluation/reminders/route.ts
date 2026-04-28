import { NextRequest, NextResponse } from "next/server";
import { addRecord, getAllRecords, sendFeishuCardMessage } from "@/lib/feishu";
import { getSession } from "@/lib/session";
import { asString, makeBitableFilter } from "@/lib/record-utils";
import { canReviewTeam, getAllUserProfiles } from "@/lib/user-profile";

const EVALUATION_TABLE_LINK =
  "https://www.xiaomifod-skill.cn/evaluation";

function formatDateTime(ts: number) {
  if (!Number.isFinite(ts) || ts <= 0) return "-";
  return new Date(ts).toLocaleString("zh-CN", { hour12: false });
}

function config() {
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const tableId = process.env.FEISHU_TABLE10_ID;
  if (!appToken || !tableId) throw new Error("FEISHU_TABLE10_ID 未配置，请先执行 migrate-lifecycle");
  return { appToken, tableId };
}

export async function GET(req: NextRequest) {
  try {
    const { appToken, tableId } = config();
    const team = req.nextUrl.searchParams.get("team") || "";
    const records = await getAllRecords(
      appToken,
      tableId,
      makeBitableFilter([team && `CurrentValue.[团队名称]="${team}"`])
    );
    return NextResponse.json({
      success: true,
      items: records.map((r) => ({ id: r.record_id, fields: r.fields })),
      members: await getAllUserProfiles(),
    });
  } catch (err) {
    console.error("[evaluation/reminders] GET 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  try {
    const { appToken, tableId } = config();
    const body = await req.json();
    const team = asString(body.team);
    const targetOpenId = asString(body.targetOpenId);
    const scene = asString(body.scene);
    const coverage = asString(body.coverage);
    if (!team || !targetOpenId || !scene || !coverage) {
      return NextResponse.json({ error: "团队、被催办人、场景、覆盖范围要求均不能为空" }, { status: 400 });
    }
    if (!(await canReviewTeam(session.user.open_id, team))) {
      return NextResponse.json({ error: "仅管理员或本团队主管可发起催办" }, { status: 403 });
    }

    let messageStatus = "已发送";
    const link = process.env.HTTP_LINK || "";
    const senderName = asString(session.user.name) || "系统用户";
    const now = Date.now();
    try {
      const card = {
        config: { wide_screen_mode: true, enable_forward: true },
        header: {
          template: "blue",
          title: { tag: "plain_text", content: "FOD OperaSkill｜评测集催办" },
        },
        elements: [
          {
            tag: "markdown",
            content: [
              `📌 **请补充场景**：${scene} 的评测集资料`,
              `🧭 **覆盖范围**：${coverage}`,
              `🙋 **发起人**：${senderName}`,
              `🕒 **发起时间**：${formatDateTime(now)}`,
            ].join("\n"),
          },
          { tag: "hr" },
          {
            tag: "action",
            actions: [
              {
                tag: "button",
                text: { tag: "plain_text", content: "去补充评测集资料" },
                type: "primary",
                url: EVALUATION_TABLE_LINK,
              },
            ],
          },
          link
            ? { tag: "note", elements: [{ tag: "plain_text", content: `系统入口：${link}` }] }
            : null,
        ].filter(Boolean),
      };
      await sendFeishuCardMessage(targetOpenId, card as Record<string, unknown>);
    } catch (err) {
      console.warn("[evaluation/reminders] 飞书消息发送失败，仅记录:", err);
      messageStatus = "发送失败";
    }

    const record = await addRecord(appToken, tableId, {
      被催办人: [{ id: targetOpenId }],
      发起人: [{ id: session.user.open_id }],
      团队名称: team,
      关联场景名: scene,
      覆盖范围要求: coverage,
      消息状态: messageStatus,
      发起时间: now,
      备注: asString(body.remark),
      提交者: [{ id: session.user.open_id }],
      提交时间: now,
    });
    return NextResponse.json({ success: true, id: record.record_id, messageStatus });
  } catch (err) {
    console.error("[evaluation/reminders] POST 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
