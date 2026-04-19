# FOD OperaSkill — 财务部AI技能作业收集平台

> 小米办公Pro | 财务部FOD部门 | PTP小组 | AI Skill 作业收集与管理平台

## 项目介绍

本平台用于收集 FOD 部门 PTP（Purchase to Payment）环节同学的 AI 技能（Skill）作业提交。提供两大板块：

### 板块一：Skill↔流程节点映射
以 PTP 七大环节（合同管理、主数据管理、预提、对账结算、发票管理、付款、其他）为框架，为各流程节点下的日常任务打上三种标签：
- ★ 纯线下操作（优先在任务二中完成）
- ◆ 涉及跨系统手工工作
- ✕ 手工作业但处于风险等原因不建议AI应用

### 板块二：各团队日常任务 Skill 实战生成
四步顺序工作流：
1. 上传知识库 + 生成子Skill1 + 初步验证（自评准确率）
2. 调优生成子Skill2（**准确率须 ≥ 90%**）
3. 上传对比分析报告（.md）→ **MiMo AI 自动校验完整性**
4. 优化知识库 → 生成子Skill3 → 最终对比报告

## 技术栈

| 技术 | 说明 |
|------|------|
| Next.js 14 (App Router) | 全栈框架 |
| TypeScript + Tailwind CSS | 开发语言与样式 |
| 飞书 OAuth 2.0 | 用户身份认证 |
| 飞书多维表格 (Bitable) | 数据存储 |
| 飞书云盘 | 文件存储 |
| MiMo API | AI 报告校验 |
| iron-session | Cookie Session 管理 |
| Vercel | 部署 |

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.local.example` 为 `.env.local` 并填写：

```env
# MiMo API
MIMO_API_KEY=your_mimo_api_key
MIMO_BASE_URL=https://token-plan-cn.xiaomimimo.com/v1
MIMO_MODEL=mimo-v2-pro

# 飞书自建应用
FEISHU_APP_ID=your_feishu_app_id
FEISHU_APP_SECRET=your_feishu_app_secret

# 飞书云空间文件夹
FEISHU_DRIVE_FOLDER_TOKEN=your_folder_token

# 可选：若 metas/batch_query 未返回 url，用「租户域名 + /file/{token}」拼接链接（与浏览器打开飞书时的域名一致，如 https://mi.feishu.cn）
# FEISHU_DRIVE_FILE_LINK_BASE=https://mi.feishu.cn

# 飞书多维表格（初始化后填入）
FEISHU_BITABLE_APP_TOKEN=
FEISHU_TABLE1_ID=
FEISHU_TABLE2_ID=

# Session 密钥（至少32位）
SESSION_SECRET=your_random_secret_key_min_32_chars
```

### 3. 初始化飞书多维表格

启动开发服务器后，调用初始化接口：

```bash
curl -X POST http://localhost:3000/api/bitable/init
```

将返回的 `FEISHU_BITABLE_APP_TOKEN`、`FEISHU_TABLE1_ID`、`FEISHU_TABLE2_ID` 填入 `.env.local`。

### 4. 配置飞书应用 OAuth 回调

在[飞书开放平台](https://open.feishu.cn/)后台，为应用添加网页应用，并配置重定向 URL：
- 开发环境：`http://localhost:3000/api/auth/feishu/callback`
- 生产环境：`https://your-domain.com/api/auth/feishu/callback`

### 5. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

## 部署到 Vercel

1. 将代码推送到 GitHub Public 仓库
2. 在 [Vercel](https://vercel.com) 导入该仓库
3. 在 Vercel 项目设置中配置所有环境变量（同 `.env.local`）
4. 部署完成后在飞书开放平台添加 Vercel 域名为 OAuth 回调地址
5. 阿里云注册域名，添加 CNAME 记录指向 Vercel 提供的地址

## 内置资源

| 文件 | 说明 |
|------|------|
| `public/mother_framework_v1.1.3.zip` | 母Skill框架（生成子Skill的基础模板） |
| `public/skill-creator.zip` | Claude官方Skill Creator工具 |

## 数据库结构

### 表1：流程节点映射
团队名称 · 提交者（飞书人员） · 流程环节 · 流程节点 · 任务名称 · 标签 · 提交时间

### 表2：Skill实战记录
团队名称 · 提交者 · 关联任务 · 步骤编号 · 内容类型 · 文件链接 · 准确率 · AI校验结果 · 步骤状态 · 提交时间

### 表3：人员 · 归属团队（v2 扩展）
人员 · 团队名称（历史字段） · **归属团队**（v2 新增：该用户实际所在团队） · **角色**（v2 新增：`管理员`/`普通用户`） · **部门**（v2 新增：飞书通讯录自动回填） · **更新时间**（v2 新增）

### 表4：每日提交统计
团队名称 · 日期 · 步骤编号 · 提交条数 等（看板汇总用）

### 表5：主要卡点（v2 扩展）
团队名称 · 卡点标题（沿用原「卡点描述」） · 卡点详情 · 状态（`待解决`/`已解决`）
· **端到端流程** · **环节** · **节点** · **关联任务名** · **步骤编号**（v2 新增 5 项绑定字段）

### 表6：明日关键目标（v2 扩展）
团队名称 · 目标标题（沿用原「目标内容」） · 提交日期
· **关联类型**（v2：`任务步骤`/`环节节点`/`自由文本`）
· **端到端流程** · **环节** · **节点** · **关联任务名** · **步骤编号列表**

---

## v2 升级指南（从旧版本升级时必读）

### Step 1. 本地启动
```bash
npm install
npm run dev
```

### Step 2. 执行 schema 迁移（幂等 · 安全 · 不删老字段）
在另一个终端：
```bash
curl -X POST http://localhost:3000/api/bitable/migrate-v2
```
该接口会在 `Table3 / Table5 / Table6` 里增加若干字段，且自动把已有的 Table3 记录统一打上 `角色=管理员`。反复调用无副作用。

### Step 3. 管理员手动把多维表所有者转让到汪宏毅
飞书开放平台**不支持**通过 API 转让多维表所有者。请按以下步骤手动操作（仅管理员做一次即可）：

1. PC 端打开多维表：
   [https://mi.feishu.cn/base/KeXCbvm47aSMMxsrQmwclFA6nEc](https://mi.feishu.cn/base/KeXCbvm47aSMMxsrQmwclFA6nEc)
2. 右上角 **「...」 → 「协作 / 高级权限」**
3. 点 **「转让文档所有者」**
4. 搜索「**汪宏毅**」→ 发起转让 → 对方接受即可
5. 转让完成后，记得把本自建应用（app_id）继续加为「可管理」协作者，否则接口会报无权限

### Step 4. 全流程自测清单

| # | 操作 | 预期 |
|---|------|------|
| 1 | 首次飞书登录 | 被强制跳到 `/onboarding` 选择归属团队 |
| 2 | 在 `/onboarding` 选团队保存 | 回首页，右上角显示「我的团队 + 部门」 |
| 3 | 进任务一 · 点任意节点「+ 添加」 | 弹框，必须选标签才能「保存」 |
| 4 | 勾选多行任务卡 | 底部出现浮动批量打标工具条 |
| 5 | 切换到别的团队查看 | 任务一/任务二顶部出现「只读」提示，所有提交按钮禁用 |
| 6 | 直接进任务二（不带 task 参数） | 显示本团队 ★纯线下 任务网格引导先选一个 |
| 7 | 点选一个纯线下任务 | 网格隐藏，只剩 4 步步骤条 + 当前步内容 |
| 8 | 当前步底部 | 看到同伴资料流式卡片 + 登记卡点 + 登记明日目标 |
| 9 | 看板 | 无录入表单，列表带「任务/步骤」tag，空态显示「去作业中心」CTA |

