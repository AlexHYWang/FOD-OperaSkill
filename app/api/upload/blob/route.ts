import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getSession } from "@/lib/session";

const MAX_BYTES = 100 * 1024 * 1024;

/** 评测集等资料上传：客户端直传 Blob，换票请求体很小，不经 Serverless 读整文件 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as HandleUploadBody;

    const jsonResponse = await handleUpload({
      request,
      body,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async () => {
        const session = await getSession();
        if (!session.isLoggedIn || !session.user) {
          throw new Error("请先登录");
        }
        return {
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ openId: session.user.open_id }),
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (err) {
    const msg = String(err);
    if (msg.includes("请先登录")) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: "未配置 BLOB_READ_WRITE_TOKEN，无法使用 Blob 直传" },
        { status: 503 }
      );
    }
    console.error("[upload/blob] handleUpload 失败:", err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
