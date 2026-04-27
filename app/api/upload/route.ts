/**
 * 文件上传路由
 * POST /api/upload
 * Content-Type: multipart/form-data
 * 字段：file (File), purpose? = skill | common
 */
import { NextRequest, NextResponse } from "next/server";
import { uploadFileToDrive } from "@/lib/feishu";
import { getSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const folderToken = process.env.FEISHU_DRIVE_FOLDER_TOKEN;
  if (!folderToken) {
    return NextResponse.json(
      { error: "FEISHU_DRIVE_FOLDER_TOKEN 未配置" },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const purpose = String(formData.get("purpose") || "common");

    if (!file) {
      return NextResponse.json({ error: "未收到文件" }, { status: 400 });
    }

    const maxMB = purpose === "skill" ? 200 : 100;
    if (purpose === "skill" && !file.name.toLowerCase().endsWith(".zip")) {
      return NextResponse.json(
        { error: "SKILL 文件只允许上传 ZIP 包" },
        { status: 400 }
      );
    }

    if (file.size > maxMB * 1024 * 1024) {
      return NextResponse.json(
        { error: `文件大小超过 ${maxMB}MB，请压缩后重试` },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = file.type || "application/octet-stream";

    const result = await uploadFileToDrive(
      buffer,
      file.name,
      mimeType,
      folderToken
    );

    return NextResponse.json({
      success: true,
      file_token: result.file_token,
      url: result.url,
      file_name: file.name,
      file_size: file.size,
    });
  } catch (err) {
    console.error("文件上传失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
