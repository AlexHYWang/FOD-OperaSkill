/**
 * 飞书 API 客户端
 * 封装 tenant_access_token 获取、Bitable CRUD、云盘上传、OAuth 2.0
 */

const FEISHU_BASE = "https://open.feishu.cn/open-apis";

// ─────────────────────────────────────────────
// Token 管理（带缓存，过期前 5 分钟刷新）
// ─────────────────────────────────────────────
let cachedToken: string | null = null;
let tokenExpiry = 0;

export async function getTenantAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const res = await fetch(
    `${FEISHU_BASE}/auth/v3/tenant_access_token/internal`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: process.env.FEISHU_APP_ID,
        app_secret: process.env.FEISHU_APP_SECRET,
      }),
    }
  );
  const data = await res.json();
  if (data.code !== 0) throw new Error(`飞书 Token 获取失败: ${data.msg}`);

  cachedToken = data.tenant_access_token as string;
  tokenExpiry = Date.now() + (data.expire - 300) * 1000;
  return cachedToken;
}

async function feishuFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getTenantAccessToken();
  return fetch(`${FEISHU_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
}

// ─────────────────────────────────────────────
// 用户信息
// ─────────────────────────────────────────────
export async function getUserInfo(userAccessToken: string) {
  const res = await fetch(`${FEISHU_BASE}/authen/v1/user_info`, {
    headers: { Authorization: `Bearer ${userAccessToken}` },
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(`获取用户信息失败: ${data.msg}`);
  return data.data as {
    name: string;
    open_id: string;
    union_id: string;
    user_id: string;
    avatar_url: string;
    email: string;
  };
}

// ─────────────────────────────────────────────
// OAuth 2.0
// ─────────────────────────────────────────────
export function getOAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.FEISHU_APP_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "contact:user.base:readonly",
    state,
  });
  return `https://open.feishu.cn/open-apis/authen/v1/index?${params}`;
}

export async function exchangeCode(
  code: string,
  redirectUri: string
): Promise<{ access_token: string; refresh_token: string; open_id: string; name: string }> {
  const res = await fetch(`${FEISHU_BASE}/authen/v1/oidc/access_token`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await getTenantAccessToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(`OAuth 换 token 失败: ${data.msg}`);
  return {
    access_token: data.data.access_token,
    refresh_token: data.data.refresh_token,
    open_id: data.data.open_id,
    name: data.data.name,
  };
}

// ─────────────────────────────────────────────
// 云盘：在指定文件夹下创建多维表格
// ─────────────────────────────────────────────
export async function createBitableApp(
  name: string,
  folderToken: string
): Promise<{ app_token: string; name: string }> {
  const res = await feishuFetch("/bitable/v1/apps", {
    method: "POST",
    body: JSON.stringify({ name, folder_token: folderToken }),
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(`创建多维表格失败: ${data.msg}`);
  return { app_token: data.data.app.app_token, name: data.data.app.name };
}

// ─────────────────────────────────────────────
// Bitable 数据表管理
// ─────────────────────────────────────────────
export async function listTables(appToken: string) {
  const res = await feishuFetch(`/bitable/v1/apps/${appToken}/tables`);
  const data = await res.json();
  if (data.code !== 0) throw new Error(`获取数据表列表失败: ${data.msg}`);
  return data.data.items as Array<{ table_id: string; name: string }>;
}

export async function createTable(
  appToken: string,
  tableName: string
): Promise<string> {
  const res = await feishuFetch(`/bitable/v1/apps/${appToken}/tables`, {
    method: "POST",
    body: JSON.stringify({ table: { name: tableName } }),
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(`创建数据表失败: ${data.msg}`);
  return data.data.table_id as string;
}

export async function createField(
  appToken: string,
  tableId: string,
  field: {
    field_name: string;
    type: number;
    property?: Record<string, unknown>;
  }
) {
  const res = await feishuFetch(
    `/bitable/v1/apps/${appToken}/tables/${tableId}/fields`,
    {
      method: "POST",
      body: JSON.stringify(field),
    }
  );
  const data = await res.json();
  if (data.code !== 0) {
    console.warn(`创建字段 ${field.field_name} 失败: ${data.msg}`);
  }
  return data;
}

// ─────────────────────────────────────────────
// Bitable 记录 CRUD
// ─────────────────────────────────────────────
export async function addRecord(
  appToken: string,
  tableId: string,
  fields: Record<string, unknown>
) {
  const res = await feishuFetch(
    `/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
    {
      method: "POST",
      body: JSON.stringify({ fields }),
    }
  );
  const data = await res.json();
  if (data.code !== 0) throw new Error(`写入记录失败: ${data.msg}`);
  return data.data.record;
}

export async function batchAddRecords(
  appToken: string,
  tableId: string,
  records: Array<{ fields: Record<string, unknown> }>
) {
  const res = await feishuFetch(
    `/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_create`,
    {
      method: "POST",
      body: JSON.stringify({ records }),
    }
  );
  const data = await res.json();
  if (data.code !== 0) throw new Error(`批量写入记录失败: ${data.msg}`);
  return data.data.records;
}

export interface BitableRecord {
  record_id: string;
  fields: Record<string, unknown>;
}

export async function listRecords(
  appToken: string,
  tableId: string,
  params?: {
    filter?: string;
    page_size?: number;
    page_token?: string;
    field_names?: string[];
  }
): Promise<{ items: BitableRecord[]; has_more: boolean; page_token?: string }> {
  const query = new URLSearchParams();
  if (params?.filter) query.set("filter", params.filter);
  if (params?.page_size) query.set("page_size", String(params.page_size));
  if (params?.page_token) query.set("page_token", params.page_token);
  if (params?.field_names)
    query.set("field_names", JSON.stringify(params.field_names));

  const url = `/bitable/v1/apps/${appToken}/tables/${tableId}/records${query.toString() ? "?" + query : ""}`;
  const res = await feishuFetch(url);
  const data = await res.json();
  if (data.code !== 0) throw new Error(`查询记录失败: ${data.msg}`);
  return {
    items: data.data.items || [],
    has_more: data.data.has_more,
    page_token: data.data.page_token,
  };
}

export async function updateRecord(
  appToken: string,
  tableId: string,
  recordId: string,
  fields: Record<string, unknown>
) {
  const res = await feishuFetch(
    `/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`,
    {
      method: "PUT",
      body: JSON.stringify({ fields }),
    }
  );
  const data = await res.json();
  if (data.code !== 0) throw new Error(`更新记录失败: ${data.msg}`);
  return data.data.record;
}

// ─────────────────────────────────────────────
// 云盘文件上传
// ─────────────────────────────────────────────
export async function uploadFileToDrive(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  folderToken: string
): Promise<{ file_token: string; url: string }> {
  const token = await getTenantAccessToken();

  // 分片上传：先初始化
  const initRes = await fetch(
    `${FEISHU_BASE}/drive/v1/files/upload_prepare`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file_name: fileName,
        parent_type: "explorer",
        parent_node: folderToken,
        size: fileBuffer.length,
      }),
    }
  );
  const initData = await initRes.json();
  if (initData.code !== 0) throw new Error(`上传初始化失败: ${initData.msg}`);

  const { upload_id, block_size, block_num } = initData.data;

  // 逐块上传
  for (let i = 0; i < block_num; i++) {
    const start = i * block_size;
    const end = Math.min(start + block_size, fileBuffer.length);
    const chunk = fileBuffer.slice(start, end);

    const formData = new FormData();
    formData.append("upload_id", upload_id);
    formData.append("seq", String(i));
    formData.append("size", String(chunk.length));
    formData.append(
      "file",
      new Blob([chunk], { type: mimeType }),
      fileName
    );

    const partRes = await fetch(
      `${FEISHU_BASE}/drive/v1/files/upload_part`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      }
    );
    const partData = await partRes.json();
    if (partData.code !== 0)
      throw new Error(`上传分片 ${i} 失败: ${partData.msg}`);
  }

  // 完成上传
  const finishRes = await fetch(
    `${FEISHU_BASE}/drive/v1/files/upload_finish`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ upload_id, block_num }),
    }
  );
  const finishData = await finishRes.json();
  if (finishData.code !== 0)
    throw new Error(`完成上传失败: ${finishData.msg}`);

  const fileToken = finishData.data.file_token as string;
  const fileUrl = `https://open.feishu.cn/open-apis/drive/v1/files/${fileToken}/download`;
  return { file_token: fileToken, url: fileUrl };
}

// ─────────────────────────────────────────────
// 获取所有记录（自动分页）
// ─────────────────────────────────────────────
export async function getAllRecords(
  appToken: string,
  tableId: string,
  filter?: string
): Promise<BitableRecord[]> {
  const all: BitableRecord[] = [];
  let pageToken: string | undefined;
  do {
    const result = await listRecords(appToken, tableId, {
      filter,
      page_size: 500,
      page_token: pageToken,
    });
    all.push(...result.items);
    pageToken = result.has_more ? result.page_token : undefined;
  } while (pageToken);
  return all;
}
