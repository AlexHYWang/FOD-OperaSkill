/**
 * GET /api/scene/milestone?team=XXX&process=PTP
 *
 * 批量返回该团队指定流程下所有场景的四步里程碑完成情况：
 * {
 *   success: true,
 *   milestones: {
 *     "场景名称A": [true, false, true, false],  // [知识库, 评测集, SKILL, 评测结果100%]
 *     "场景名称B": [true, true, true, true],
 *   }
 * }
 *
 * 四步说明：
 * Step1: Table7（知识库条目）有该团队+该场景名或所属节点的记录
 * Step2: Table8（评测集组合）有该团队+关联场景名=该场景 的记录
 * Step3: Table2（Skill实战记录）有该团队+所属场景=该场景+步骤状态=已完成 的记录
 * Step4: Table11（评测记录）有该团队+关联场景名=该场景+准确率(%)=100 的记录
 */
import { NextResponse } from "next/server";
import { getAllRecords } from "@/lib/feishu";
import { getSession } from "@/lib/session";
import { getUserProfile } from "@/lib/user-profile";
import { normalizeE2EProcessShortName } from "@/lib/constants";

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v))
    return v
      .map((x) =>
        typeof x === "string" ? x :
        x && typeof x === "object" && "text" in x ? ((x as { text?: string }).text || "") : ""
      )
      .filter(Boolean)
      .join("");
  if (v && typeof v === "object" && "text" in (v as object))
    return ((v as { text?: string }).text || "");
  return "";
}

function normalizeText(v: unknown): string {
  return asString(v).replace(/\s+/g, " ").trim();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teamParam = searchParams.get("team");
  const processParam = normalizeE2EProcessShortName(searchParams.get("process") || "");

  const session = await getSession();
  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
  }

  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const table1Id = process.env.FEISHU_TABLE1_ID;
  const table2Id = process.env.FEISHU_TABLE2_ID;
  const table7Id = process.env.FEISHU_TABLE7_ID;
  const table8Id = process.env.FEISHU_TABLE8_ID;
  const table11Id = process.env.FEISHU_TABLE11_ID;

  if (!appToken || !table1Id || !table2Id) {
    return NextResponse.json({ success: false, error: "Bitable 未初始化" }, { status: 500 });
  }

  try {
    const profile = await getUserProfile(session.user.open_id, session.user.name);
    const team = teamParam || profile.team;

    if (!team) {
      return NextResponse.json({ success: true, milestones: {} });
    }

    const teamFilter = `CurrentValue.[团队名称]="${team}"`;

    const [t1Records, t2Records, t7Records, t8Records, t11Records] = await Promise.all([
      getAllRecords(appToken, table1Id, teamFilter),
      teamFilter ? getAllRecords(appToken, table2Id, teamFilter) : Promise.resolve([]),
      table7Id ? getAllRecords(appToken, table7Id, teamFilter) : Promise.resolve([]),
      table8Id ? getAllRecords(appToken, table8Id, teamFilter) : Promise.resolve([]),
      table11Id ? getAllRecords(appToken, table11Id, teamFilter) : Promise.resolve([]),
    ]);

    // 提取场景名集合（Table1）并统一 key，避免空格/全角差异导致不命中
    const allSceneKeys = new Set<string>();
    const sceneKeyToName = new Map<string, string>(); // normalized scene -> original name
    const sceneToNode = new Map<string, string>(); // normalized scene -> normalized node
    for (const r of t1Records) {
      const tableProcess = normalizeE2EProcessShortName(
        normalizeText(r.fields["端到端流程"])
      );
      if (processParam && tableProcess !== processParam) continue;
      const name = normalizeText(r.fields["场景名称"] || r.fields["任务名称"]);
      if (!name) continue;
      const sceneKey = name;
      allSceneKeys.add(sceneKey);
      sceneKeyToName.set(sceneKey, name);
      const node = normalizeText(r.fields["流程节点"]);
      if (node) sceneToNode.set(sceneKey, node);
    }

    // Step1: 知识库绑定 - Table7 中有该场景名或所属节点
    const step1Scenes = new Set<string>(); // normalized scene
    for (const r of t7Records) {
      const relScene = normalizeText(r.fields["关联场景名"] || r.fields["所属场景"]);
      const relNode = normalizeText(r.fields["流程节点"] || r.fields["所属节点"]);
      if (relScene && allSceneKeys.has(relScene)) {
        step1Scenes.add(relScene);
      }
      // 如果知识库绑定了该节点，该节点下所有场景视为完成 step1
      if (relNode) {
        for (const [sceneKey, node] of sceneToNode.entries()) {
          if (node === relNode) step1Scenes.add(sceneKey);
        }
      }
    }

    // Step2: 评测集绑定 - Table8 中有关联场景名匹配
    const step2Scenes = new Set<string>();
    for (const r of t8Records) {
      const relScene = normalizeText(r.fields["关联场景名"] || r.fields["所属场景"]);
      if (relScene && allSceneKeys.has(relScene)) {
        step2Scenes.add(relScene);
      }
    }

    // Step3: SKILL 上传 - Table2 中有步骤状态=已完成
    const step3Scenes = new Set<string>();
    for (const r of t2Records) {
      const status = normalizeText(r.fields["步骤状态"]);
      if (status !== "已完成") continue;
      const scene = normalizeText(r.fields["所属场景"]);
      if (scene && allSceneKeys.has(scene)) {
        step3Scenes.add(scene);
      }
    }

    // Step4: 评测结果达标 - Table11 中有准确率=100
    const step4Scenes = new Set<string>();
    for (const r of t11Records) {
      const accuracy = Number(r.fields["准确率(%)"] || 0);
      if (accuracy < 100) continue;
      const scene = normalizeText(r.fields["关联场景名"] || r.fields["所属场景"]);
      if (scene && allSceneKeys.has(scene)) {
        step4Scenes.add(scene);
      }
    }

    // 组装结果
    const milestones: Record<string, [boolean, boolean, boolean, boolean]> = {};
    for (const sceneKey of allSceneKeys) {
      const sceneName = sceneKeyToName.get(sceneKey) || sceneKey;
      milestones[sceneName] = [
        step1Scenes.has(sceneKey),
        step2Scenes.has(sceneKey),
        step3Scenes.has(sceneKey),
        step4Scenes.has(sceneKey),
      ];
    }

    console.info("[scene/milestone] computed", {
      team,
      process: processParam || "ALL",
      scenes: allSceneKeys.size,
      step1: step1Scenes.size,
      step2: step2Scenes.size,
      step3: step3Scenes.size,
      step4: step4Scenes.size,
    });

    return NextResponse.json({ success: true, milestones });
  } catch (err) {
    console.error("[scene/milestone]", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
