import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { downloadFileFromDrive, getAllRecords } from "@/lib/feishu";
import { asString, extractUrl, makeBitableFilter } from "@/lib/record-utils";

function env() {
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const table1 = process.env.FEISHU_TABLE1_ID;
  const table2 = process.env.FEISHU_TABLE2_ID;
  const table8 = process.env.FEISHU_TABLE8_ID;
  const table7 = process.env.FEISHU_TABLE7_ID;
  const table9 = process.env.FEISHU_TABLE9_ID;
  const table11 = process.env.FEISHU_TABLE11_ID;
  if (!appToken || !table1 || !table2 || !table7 || !table8 || !table9 || !table11) {
    throw new Error("生命周期表环境变量未完整配置，请先执行 migrate-lifecycle");
  }
  return { appToken, table1, table2, table7, table8, table9, table11 };
}

function safeName(name: string) {
  return (name || "未命名").replace(/[\\/:*?"<>|]/g, "_").slice(0, 80);
}

function normalizeMatchValue(value: unknown) {
  return asString(value).trim();
}

function buildLinkNotePath(path: string, title: string) {
  const idx = path.lastIndexOf("/");
  const folder = idx >= 0 ? path.slice(0, idx + 1) : "";
  const baseTitle = safeName(title || "未命名条目");
  return `${folder}${baseTitle}_请用记事本打开查看文件链接.txt`;
}

async function addFile(zip: JSZip, path: string, token: string, url: string, titleForLink: string) {
  if (token) {
    try {
      const file = await downloadFileFromDrive(token);
      zip.file(path, file.buffer);
      return;
    } catch (err) {
      if (url) {
        const notePath = buildLinkNotePath(path, titleForLink);
        zip.file(notePath, `${url}\n下载失败：${String(err)}`);
      } else {
        zip.file(`${path}.download-error.txt`, `下载失败：${String(err)}`);
      }
      return;
    }
  }
  if (url) {
    const notePath = buildLinkNotePath(path, titleForLink);
    zip.file(notePath, url);
  }
}

export async function GET(req: NextRequest) {
  try {
    const { appToken, table1, table2, table7, table8, table9, table11 } = env();
    const sp = req.nextUrl.searchParams;
    const team = sp.get("team") || "";
    const scene = sp.get("scene") || "";
    if (!team || !scene) {
      return NextResponse.json({ error: "team 和 scene 不能为空" }, { status: 400 });
    }

    const [mappings, skills, allKnowledge, datasets, allMaterials, allRuns] = await Promise.all([
      getAllRecords(appToken, table1, makeBitableFilter([
        `CurrentValue.[团队名称]="${team}"`,
        `CurrentValue.[场景名称]="${scene}"`,
      ])),
      getAllRecords(appToken, table2, makeBitableFilter([
        `CurrentValue.[团队名称]="${team}"`,
        `CurrentValue.[所属场景]="${scene}"`,
      ])),
      getAllRecords(appToken, table7, makeBitableFilter([
        `CurrentValue.[团队名称]="${team}"`,
        `CurrentValue.[状态]="已发布"`,
      ])),
      getAllRecords(appToken, table8, makeBitableFilter([
        `CurrentValue.[团队名称]="${team}"`,
      ])),
      getAllRecords(appToken, table9, `CurrentValue.[团队名称]="${team}"`),
      getAllRecords(appToken, table11, `CurrentValue.[团队名称]="${team}"`),
    ]);

    const zip = new JSZip();
    const root = safeName(scene);
    zip.folder(`${root}/SKILL`);
    zip.folder(`${root}/知识库`);
    zip.folder(`${root}/评测集`);
    zip.folder(`${root}/评测记录/机器输出C结果`);
    zip.folder(`${root}/评测记录/对比分析报告`);
    zip.folder(`${root}/测试说明`);
    const normalizedScene = normalizeMatchValue(scene);

    const fallbackMappings =
      mappings.length > 0
        ? mappings
        : await getAllRecords(
            appToken,
            table1,
            makeBitableFilter([
              `CurrentValue.[团队名称]="${team}"`,
              `CurrentValue.[任务名称]="${scene}"`,
            ])
          );
    const mappedNode = normalizeMatchValue(
      fallbackMappings[0]?.fields["流程节点"] || fallbackMappings[0]?.fields["节点"] || ""
    );

    const scopedDatasets = datasets.filter((rec) => {
      const recScene = normalizeMatchValue(rec.fields["关联场景名"] || rec.fields["所属场景"]);
      return recScene === normalizedScene;
    });

    const datasetIds = new Set<string>();
    const datasetNodeCandidates = new Set<string>();
    for (const rec of scopedDatasets) {
      datasetIds.add(asString(rec.record_id));
      const node = normalizeMatchValue(rec.fields["流程节点"] || rec.fields["节点"] || "");
      if (node) datasetNodeCandidates.add(node);
    }
    const targetNode = mappedNode || Array.from(datasetNodeCandidates)[0] || "";

    const currentKnowledge = allKnowledge.filter((rec) => {
      const raw = rec.fields["是否当前版本"];
      return raw === true || String(raw).toLowerCase() === "true";
    });
    const byScene = currentKnowledge.filter(
      (rec) => normalizeMatchValue(rec.fields["关联场景名"]) === normalizedScene
    );
    const byNode = targetNode
      ? currentKnowledge.filter((rec) => {
          const recNode = normalizeMatchValue(
            rec.fields["流程节点"] || rec.fields["节点"] || rec.fields["关联节点"] || ""
          );
          return recNode === targetNode;
        })
      : [];
    const knowledgeMap = new Map<string, (typeof allKnowledge)[number]>();
    for (const rec of byScene) knowledgeMap.set(rec.record_id, rec);
    for (const rec of byNode) knowledgeMap.set(rec.record_id, rec);
    const knowledge = Array.from(knowledgeMap.values());

    const materials = allMaterials.filter((rec) => {
      const datasetId = asString(rec.fields["评测集ID"]);
      return datasetId && datasetIds.has(datasetId);
    });

    const runs = allRuns.filter((rec) => {
      const recordScene = asString(rec.fields["关联场景名"] || rec.fields["所属场景"]);
      if (recordScene && normalizeMatchValue(recordScene) === normalizedScene) return true;
      const datasetId = asString(rec.fields["评测集ID"]);
      return datasetId && datasetIds.has(datasetId);
    });

    for (const rec of skills) {
      const f = rec.fields;
      const displayName = asString(f["SKILL文件名"] || f["文件名称"] || "skill.zip");
      await addFile(
        zip,
        `${root}/SKILL/${safeName(displayName)}`,
        asString(f["SKILL文件Token"]),
        extractUrl(f["SKILL文件链接"]) || extractUrl(f["文件链接"]),
        displayName
      );
    }
    for (const rec of knowledge) {
      const f = rec.fields;
      const displayName = asString(f["条目标题"] || f["文件名称"] || "未命名条目");
      await addFile(
        zip,
        `${root}/知识库/${safeName(asString(f["资料类型"]) || "资料")}/${safeName(asString(f["文件名称"] || f["条目标题"]))}`,
        asString(f["文件Token"]),
        extractUrl(f["文件链接"]),
        displayName
      );
    }
    for (const rec of materials) {
      const f = rec.fields;
      const displayName = asString(f["文件名称"] || "未命名条目");
      await addFile(
        zip,
        `${root}/评测集/${safeName(asString(f["资料板块"]) || "资料")}/${safeName(displayName)}`,
        asString(f["文件Token"]),
        extractUrl(f["文件链接"]),
        displayName
      );
    }
    for (const rec of runs) {
      const f = rec.fields;
      const outputName = asString(f["机器输出C结果文件名"]) || `${rec.record_id}.txt`;
      await addFile(
        zip,
        `${root}/评测记录/机器输出C结果/${safeName(outputName)}`,
        "",
        extractUrl(f["机器输出C结果链接"]),
        outputName
      );
      const reportName = asString(f["对比分析报告文件名"]) || `${rec.record_id}.txt`;
      await addFile(
        zip,
        `${root}/评测记录/对比分析报告/${safeName(reportName)}`,
        "",
        extractUrl(f["对比分析报告链接"]),
        reportName
      );
    }

    zip.file(
      `${root}/测试说明/财多多测试指引.md`,
      [
        "# 财多多线下测试指引",
        "",
        "1. 解压本资料包。",
        "2. 在财多多本地 Agent APP 中加载 `SKILL/` 下文件。",
        "3. 导入 `知识库/` 下规则、字典、模版资料。",
        "4. 使用 `评测集/` 下资料完成线下测试。",
        "5. 历史测试结果可在 `评测记录/` 目录中查看。",
      ].join("\n")
    );
    zip.file(
      `${root}/测试说明/结果回传字段说明.md`,
      "必填：机器输出C结果、对比分析报告、准确率。建议补充：测试备注、异常样本说明。"
    );

    zip.file(
      `${root}/README.txt`,
      `导出团队：${team}\n导出场景：${scene}\n知识库：${knowledge.length} 条\nSKILL：${skills.length} 条\n评测集资料：${materials.length} 条\n评测记录：${runs.length} 条\n`
    );
    console.info("[dashboard/export] complete", {
      team,
      scene,
      datasetCount: datasetIds.size,
      materialCount: materials.length,
      runCount: runs.length,
      sceneMatchCount: byScene.length,
      nodeMatchCount: byNode.length,
      knowledgeUnionCount: knowledge.length,
      targetNode,
    });

    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    const fileName = encodeURIComponent(`${scene}_资产包.zip`);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename*=UTF-8''${fileName}`,
      },
    });
  } catch (err) {
    console.error("[dashboard/export] 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
