import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const host = request.headers.get("host") || "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const redirectUri = `${protocol}://${host}/api/auth/feishu/callback`;

  const state = Math.random().toString(36).substring(2);

  const params = new URLSearchParams({
    client_id: process.env.FEISHU_APP_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "contact:user.base:readonly",
    state,
  });

  const authUrl = `https://open.feishu.cn/open-apis/authen/v1/index?${params}`;
  return NextResponse.redirect(authUrl);
}
