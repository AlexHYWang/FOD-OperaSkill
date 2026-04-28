import fs from "node:fs";
import path from "node:path";

function loadEnv(filePath) {
  const env = {};
  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line
      .slice(idx + 1)
      .replace(/\s+#.*$/, "")
      .trim();
    env[key] = value;
  }
  return env;
}

async function feishuFetch(url, init) {
  const res = await fetch(url, init);
  const raw = await res.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`${url} => HTTP ${res.status}: ${raw}`);
  }
  if (data.code !== 0) {
    throw new Error(`${url} => ${data.code}: ${data.msg}`);
  }
  return data;
}

const root = process.cwd();
const envPath = path.join(root, ".env.local");
const env = loadEnv(envPath);

const appId = env.FEISHU_APP_ID;
const appSecret = env.FEISHU_APP_SECRET;
const appToken = env.FEISHU_BITABLE_APP_TOKEN;

if (!appId || !appSecret || !appToken) {
  throw new Error("缺少 FEISHU_APP_ID / FEISHU_APP_SECRET / FEISHU_BITABLE_APP_TOKEN");
}

const renames = [
  { table: env.FEISHU_TABLE2_ID, from: "环节", to: "流程环节" },
  { table: env.FEISHU_TABLE2_ID, from: "节点", to: "流程节点" },
  { table: env.FEISHU_TABLE5_ID, from: "环节", to: "流程环节" },
  { table: env.FEISHU_TABLE5_ID, from: "节点", to: "流程节点" },
  { table: env.FEISHU_TABLE6_ID, from: "环节", to: "流程环节" },
  { table: env.FEISHU_TABLE6_ID, from: "节点", to: "流程节点" },
  { table: env.FEISHU_TABLE7_ID, from: "环节", to: "流程环节" },
  { table: env.FEISHU_TABLE7_ID, from: "节点", to: "流程节点" },
  { table: env.FEISHU_TABLE8_ID, from: "环节", to: "流程环节" },
  { table: env.FEISHU_TABLE8_ID, from: "节点", to: "流程节点" },
  { table: env.FEISHU_TABLE8_ID, from: "所属场景", to: "关联场景名" },
  { table: env.FEISHU_TABLE9_ID, from: "所属场景", to: "关联场景名" },
  { table: env.FEISHU_TABLE10_ID, from: "所属场景", to: "关联场景名" },
  { table: env.FEISHU_TABLE11_ID, from: "所属场景", to: "关联场景名" },
].filter((r) => !!r.table);

const tokenResp = await feishuFetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
});
const tenantToken = tokenResp.tenant_access_token;

const headers = {
  Authorization: `Bearer ${tenantToken}`,
  "Content-Type": "application/json; charset=utf-8",
};

for (const item of renames) {
  try {
    const tableId = item.table;
    const list = await feishuFetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/fields?page_size=500`,
      { headers }
    );
    const fields = list.data.items || [];
    const targetExists = fields.some((f) => f.field_name === item.to);
    const source = fields.find((f) => f.field_name === item.from);

    if (targetExists) {
      console.log(`[SKIP] ${tableId}: ${item.from} -> ${item.to}（目标字段已存在）`);
      continue;
    }
    if (!source) {
      console.log(`[SKIP] ${tableId}: ${item.from} 不存在`);
      continue;
    }

    await feishuFetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/fields/${source.field_id}`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({ field_name: item.to, type: source.type }),
      }
    );
    console.log(`[OK] ${tableId}: ${item.from} -> ${item.to}`);
  } catch (err) {
    console.log(`[ERR] ${item.table}: ${item.from} -> ${item.to} 失败: ${String(err)}`);
  }
}

console.log("字段改名执行完成。");
