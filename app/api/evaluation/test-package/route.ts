import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { downloadFileFromDrive, getAllRecords } from "@/lib/feishu";
import { asString, extractUrl, makeBitableFilter } from "@/lib/record-utils";

function requiredEnv() {
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const table2 = process.env.FEISHU_TABLE2_ID;
  const table7 = process.env.FEISHU_TABLE7_ID;
  const table9 = process.env.FEISHU_TABLE9_ID;
  if (!appToken || !table2 || !table7 || !table9) {
    throw new Error("FEISHU_TABLE2_ID / FEISHU_TABLE7_ID / FEISHU_TABLE9_ID 未完整配置");
  }
  return { appToken, table2, table7, table9 };
}

function safeName(name: string) {
  return (name || "未命名").replace(/[\\/:*?"<>|]/g, "_").slice(0, 80);
}

async function addDriveFileOrLink(
  zip: JSZip,
  folder: string,
  fileName: string,
  fileToken: string,
  fileUrl: string
) {
  const target = `${folder}/${safeName(fileName || fileToken || "资料")}`;
  if (fileToken) {
    try {
      const file = await downloadFileFromDrive(fileToken);
      zip.file(target, file.buffer);
      return;
    } catch (err) {
      zip.file(`${target}.download-error.txt`, `飞书文件下载失败，请手动打开链接：${fileUrl}\n${String(err)}`);
      return;
    }
  }
  if (fileUrl) {
    zip.file(`${target}.url.txt`, fileUrl);
  }
}

export async function GET(req: NextRequest) {
  try {
    const { appToken, table2, table7, table9 } = requiredEnv();
    const sp = req.nextUrl.searchParams;
    const team = sp.get("team") || "";
    const scene = sp.get("scene") || "";
    const datasetId = sp.get("datasetId") || "";
    if (!team || !scene || !datasetId) {
      return NextResponse.json({ error: "team、scene、datasetId 不能为空" }, { status: 400 });
    }

    const [skills, knowledge, materials] = await Promise.all([
      getAllRecords(appToken, table2, makeBitableFilter([
        `CurrentValue.[团队名称]="${team}"`,
        `CurrentValue.[所属场景]="${scene}"`,
      ])),
      getAllRecords(appToken, table7, makeBitableFilter([
        `CurrentValue.[团队名称]="${team}"`,
        `CurrentValue.[状态]="已发布"`,
        `CurrentValue.[是否当前版本]=true`,
      ])),
      getAllRecords(appToken, table9, `CurrentValue.[评测集ID]="${datasetId}"`),
    ]);

    const zip = new JSZip();
    const root = `${safeName(scene)}_线下测试包`;
    const latestSkill = skills
      .slice()
      .sort((a, b) => Number(b.fields["提交时间"] || 0) - Number(a.fields["提交时间"] || 0))[0];

    if (latestSkill) {
      await addDriveFileOrLink(
        zip,
        `${root}/SKILL`,
        asString(latestSkill.fields["SKILL文件名"] || latestSkill.fields["文件名称"] || "skill.zip"),
        asString(latestSkill.fields["SKILL文件Token"]),
        extractUrl(latestSkill.fields["SKILL文件链接"]) || extractUrl(latestSkill.fields["文件链接"])
      );
    }

    for (const rec of knowledge) {
      const f = rec.fields;
      const type = asString(f["资料类型"]) || "规则";
      await addDriveFileOrLink(
        zip,
        `${root}/知识库/${safeName(type)}`,
        asString(f["文件名称"] || f["条目标题"]),
        asString(f["文件Token"]),
        extractUrl(f["文件链接"])
      );
    }

    for (const rec of materials) {
      const f = rec.fields;
      const panel = asString(f["资料板块"]) || "评测集资料";
      await addDriveFileOrLink(
        zip,
        `${root}/评测集/${safeName(panel)}`,
        asString(f["文件名称"]),
        asString(f["文件Token"]),
        extractUrl(f["文件链接"])
      );
    }

    zip.file(
      `${root}/测试说明/财多多测试指引.md`,
      [
        "# 财多多线下测试指引",
        "",
        "1. 解压本资料包。",
        "2. 在财多多本地 Agent APP 中加载 `SKILL/skill.zip`。",
        "3. 导入 `知识库/` 下规则、字典、模版资料。",
        "4. 使用 `评测集/输入A样本/` 作为输入运行测试。",
        "5. 将财多多生成的机器输出 C 结果与 `评测集/人工输出C结果/` 对比。",
        "6. 回到 FOD OperaSkill 的“评测集测试”页面，上传机器输出 C 结果、对比分析报告，并填写准确率。",
      ].join("\n")
    );
    zip.file(
      `${root}/测试说明/结果回传字段说明.md`,
      "必填：机器输出C结果、对比分析报告、准确率。建议补充：测试备注、异常样本说明。"
    );

    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    const fileName = encodeURIComponent(`${scene}_线下测试包.zip`);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename*=UTF-8''${fileName}`,
      },
    });
  } catch (err) {
    console.error("[evaluation/test-package] 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
