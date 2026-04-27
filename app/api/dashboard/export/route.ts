import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { downloadFileFromDrive, getAllRecords } from "@/lib/feishu";
import { asString, extractUrl, makeBitableFilter } from "@/lib/record-utils";

function env() {
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const table2 = process.env.FEISHU_TABLE2_ID;
  const table7 = process.env.FEISHU_TABLE7_ID;
  const table9 = process.env.FEISHU_TABLE9_ID;
  const table11 = process.env.FEISHU_TABLE11_ID;
  if (!appToken || !table2 || !table7 || !table9 || !table11) {
    throw new Error("生命周期表环境变量未完整配置，请先执行 migrate-lifecycle");
  }
  return { appToken, table2, table7, table9, table11 };
}

function safeName(name: string) {
  return (name || "未命名").replace(/[\\/:*?"<>|]/g, "_").slice(0, 80);
}

async function addFile(zip: JSZip, path: string, token: string, url: string) {
  if (token) {
    try {
      const file = await downloadFileFromDrive(token);
      zip.file(path, file.buffer);
      return;
    } catch (err) {
      zip.file(`${path}.download-error.txt`, `下载失败：${String(err)}\n${url}`);
      return;
    }
  }
  if (url) zip.file(`${path}.url.txt`, url);
}

export async function GET(req: NextRequest) {
  try {
    const { appToken, table2, table7, table9, table11 } = env();
    const sp = req.nextUrl.searchParams;
    const team = sp.get("team") || "";
    const scene = sp.get("scene") || "";
    if (!team || !scene) {
      return NextResponse.json({ error: "team 和 scene 不能为空" }, { status: 400 });
    }

    const [skills, knowledge, materials, runs] = await Promise.all([
      getAllRecords(appToken, table2, makeBitableFilter([
        `CurrentValue.[团队名称]="${team}"`,
        `CurrentValue.[所属场景]="${scene}"`,
      ])),
      getAllRecords(appToken, table7, makeBitableFilter([
        `CurrentValue.[团队名称]="${team}"`,
        `CurrentValue.[关联场景名]="${scene}"`,
      ])),
      getAllRecords(appToken, table9, makeBitableFilter([
        `CurrentValue.[团队名称]="${team}"`,
        `CurrentValue.[所属场景]="${scene}"`,
      ])),
      getAllRecords(appToken, table11, makeBitableFilter([
        `CurrentValue.[团队名称]="${team}"`,
        `CurrentValue.[所属场景]="${scene}"`,
      ])),
    ]);

    const zip = new JSZip();
    const root = safeName(scene);

    for (const rec of skills) {
      const f = rec.fields;
      await addFile(
        zip,
        `${root}/SKILL/${safeName(asString(f["SKILL文件名"] || f["文件名称"] || "skill.zip"))}`,
        asString(f["SKILL文件Token"]),
        extractUrl(f["SKILL文件链接"]) || extractUrl(f["文件链接"])
      );
    }
    for (const rec of knowledge) {
      const f = rec.fields;
      await addFile(
        zip,
        `${root}/知识库/${safeName(asString(f["资料类型"]) || "资料")}/${safeName(asString(f["文件名称"] || f["条目标题"]))}`,
        asString(f["文件Token"]),
        extractUrl(f["文件链接"])
      );
    }
    for (const rec of materials) {
      const f = rec.fields;
      await addFile(
        zip,
        `${root}/评测集/${safeName(asString(f["资料板块"]) || "资料")}/${safeName(asString(f["文件名称"]))}`,
        asString(f["文件Token"]),
        extractUrl(f["文件链接"])
      );
    }
    for (const rec of runs) {
      const f = rec.fields;
      await addFile(
        zip,
        `${root}/评测记录/机器输出C结果/${safeName(asString(f["机器输出C结果文件名"]) || `${rec.record_id}.txt`)}`,
        "",
        extractUrl(f["机器输出C结果链接"])
      );
      await addFile(
        zip,
        `${root}/评测记录/对比分析报告/${safeName(asString(f["对比分析报告文件名"]) || `${rec.record_id}.txt`)}`,
        "",
        extractUrl(f["对比分析报告链接"])
      );
    }

    zip.file(
      `${root}/README.txt`,
      `导出团队：${team}\n导出场景：${scene}\n知识库：${knowledge.length} 条\nSKILL：${skills.length} 条\n评测集资料：${materials.length} 条\n评测记录：${runs.length} 条\n`
    );

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
