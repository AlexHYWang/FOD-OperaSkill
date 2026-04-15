---
name: FOD OperaSkill 平台
overview: 从零构建并部署「FOD部门AI技能作业收集平台」——一个 Next.js 全栈 Web 应用，使用飞书 Bitable 作为数据库、飞书云盘存储文件、飞书 OAuth 认证用户身份，通过 GitHub 托管后部署至 Vercel，并绑定阿里云域名实现国内可访问。
todos:
  - id: init-nextjs
    content: 初始化 Next.js 14 项目（TypeScript + Tailwind + shadcn/ui），配置 .gitignore 排除 .env.local
    status: completed
  - id: feishu-lib
    content: 实现 lib/feishu.ts：封装 tenant_access_token 获取、Bitable CRUD、云盘上传、OAuth 2.0 完整流程
    status: completed
  - id: auth-routes
    content: 创建飞书 OAuth 路由 /api/auth/feishu 和 /api/auth/feishu/callback，用 iron-session 管理 cookie 登录态
    status: completed
  - id: bitable-init
    content: 通过飞书 API 在指定云空间文件夹创建多维表格，建立「流程节点映射」和「Skill实战记录」两张数据表及字段结构
    status: completed
  - id: constants
    content: 在 lib/constants.ts 中定义完整 PTP 七大环节及所有子节点、三种图例标签
    status: completed
  - id: section1-ui
    content: 开发板块一：团队选择器 + PTP 节点映射表格（可添加任务行 + 打标签 + 自动加载团队已有记录 + 保存至 Bitable）
    status: completed
  - id: section2-ui
    content: 开发板块二：4步顺序上传向导（步骤锁定逻辑、准确率≥90%校验、母Skill/skill-creator 下载卡片、团队进度看板）
    status: completed
  - id: file-upload-api
    content: 实现 /api/upload 路由：接收文件流 → 上传至飞书云盘指定文件夹 → 返回文件 URL 写入 Bitable
    status: completed
  - id: mimo-validation
    content: 实现 lib/mimo.ts + /api/validate-report：读取 .md 报告内容，用 MiMo API 判断是否包含三个必要分析维度，返回校验结果
    status: completed
  - id: github-repo
    content: 调用 GitHub MCP create_repository 创建 Public 仓库 FOD-OperaSkill，推送全部代码
    status: in_progress
  - id: vercel-deploy
    content: 在 Vercel 导入 GitHub 仓库并配置所有环境变量完成部署，输出部署 URL
    status: pending
  - id: domain-guide
    content: 提供阿里云域名注册 + DNS CNAME 配置 + Vercel 自定义域名绑定的完整操作指引
    status: pending
isProject: false
---

# FOD OperaSkill 平台建设方案

## 技术选型

- **框架**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **数据库**: 飞书多维表格 Bitable（2张数据表）
- **文件存储**: 飞书云盘（指定 folder token 下）
- **认证**: 飞书 OAuth 2.0（获取 user_id 写入人员字段）
- **AI 校验**: MiMo API（OpenAI-compatible，校验对比报告）
- **部署**: Vercel（关联 GitHub Public 仓库）
- **域名**: 阿里云注册 + CNAME 指向 Vercel

---

## 工程目录结构

```
FOD-OperaSkill/
├── app/
│   ├── layout.tsx                  # 全局布局，含左侧导航栏
│   ├── page.tsx                    # 首页：飞书登录 + 团队选择
│   ├── section1/page.tsx           # 板块一：Skill↔流程节点映射
│   ├── section2/page.tsx           # 板块二：Skill实战生成（4步工作流）
│   └── api/
│       ├── auth/feishu/route.ts            # 发起 OAuth 跳转
│       ├── auth/feishu/callback/route.ts   # OAuth 回调，写 session cookie
│       ├── bitable/records/route.ts        # Bitable 增/查记录
│       ├── upload/route.ts                 # 文件上传至飞书云盘
│       └── validate-report/route.ts        # MiMo AI 校验 .md 报告
├── components/
│   ├── TeamSelector.tsx            # 团队选择器（含新增团队）
│   ├── NodeMappingGrid.tsx         # PTP 节点映射表格组件
│   ├── TaskLabelCard.tsx           # 任务打标卡片
│   ├── SkillStepWizard.tsx         # 4步上传向导
│   ├── ProgressDashboard.tsx       # 团队进度看板
│   └── DownloadCard.tsx            # 母Skill/skill-creator 下载卡片
├── lib/
│   ├── feishu.ts                   # 飞书 API 客户端（auth/bitable/drive）
│   ├── mimo.ts                     # MiMo API 客户端
│   └── constants.ts                # PTP 流程结构常量 + 图例定义
├── public/
│   ├── mother_framework_v1.1.3.zip
│   └── skill-creator.zip
├── .env.local                      # 已有（不提交 Git）
├── .gitignore
├── next.config.ts
└── package.json
```

---

## 飞书 Bitable 数据表设计

### 数据表1：流程节点映射

| 字段名 | 字段类型 | 说明 |
|--------|---------|------|
| 团队名称 | 文本 | 团队选择器输入值 |
| 提交者 | 人员 | 飞书 user_id |
| 流程环节 | 单选 | 合同管理/主数据管理/预提/对账结算/发票管理/付款/其他 |
| 流程节点 | 文本 | 具体节点名称 |
| 任务名称 | 文本 | 用户填写的日常任务 |
| 标签 | 单选 | 纯手工★ / 跨系统◆ / 不建议AI✕ |
| 提交时间 | 日期 | 自动填入 |

### 数据表2：Skill实战记录

| 字段名 | 字段类型 | 说明 |
|--------|---------|------|
| 团队名称 | 文本 | |
| 提交者 | 人员 | 飞书 user_id |
| 关联任务 | 文本 | 来自表1的任务名称 |
| 步骤编号 | 数字 | 1/2/3/4 |
| 内容类型 | 文本 | 知识库/子Skill1/准确率 等 |
| 文件链接 | 超链接 | 飞书云盘文件 URL |
| 准确率 | 数字 | % |
| AI校验结果 | 文本 | MiMo 返回的校验说明 |
| 步骤状态 | 单选 | 待完成/进行中/已完成 |
| 提交时间 | 日期 | 自动填入 |

---

## 核心业务流程

```mermaid
flowchart TD
    A[用户访问平台] --> B[飞书OAuth登录]
    B --> C[获取user_id + 选择团队]
    C --> D{选择板块}

    D --> E[板块一：节点映射]
    E --> E1[加载本团队已有记录]
    E1 --> E2[填写各节点日常任务 + 打标签]
    E2 --> E3[保存至Bitable 数据表1]

    D --> F[板块二：Skill实战]
    F --> F1[选择已完成节点中的某个日常任务]
    F1 --> F2[第一步：上传知识库/子Skill1/数据源/输出/准确率]
    F2 --> F3[第二步：调优上传子Skill2，准确率需≥90%]
    F3 --> F4[第三步：上传.md对比报告]
    F4 --> G{MiMo AI校验}
    G -->|不符合要求| H[提示用户重新生成报告]
    G -->|通过| F5[第四步：上传调优知识库/子Skill3/对比报告]
    F5 --> F6[保存至Bitable 数据表2]
```

---

## 实施步骤

### Step 1：初始化 Next.js 项目
- `npx create-next-app@latest` 创建项目，配置 TypeScript + Tailwind + App Router
- 安装 shadcn/ui 组件库
- 配置 `.gitignore`（排除 `.env.local`）

### Step 2：飞书集成基础层
- `lib/feishu.ts`：封装 `tenant_access_token` 获取、Bitable CRUD、云盘上传、OAuth 流程
- 创建 `/api/auth/feishu` 和 `/api/auth/feishu/callback` 路由
- Session 管理：使用 `iron-session` 或 JWT cookie 存储用户 user_id

### Step 3：Bitable 数据表初始化
- 调用飞书 API 在 `FEISHU_DRIVE_FOLDER_TOKEN` 目录下创建多维表格
- 建立两张数据表及字段结构（在 agent 模式下执行一次性初始化脚本）

### Step 4：板块一 UI + API
- `constants.ts` 中定义 PTP 七大环节及所有子节点数组
- `NodeMappingGrid.tsx`：多列可折叠的表格，每个节点下可添加多条任务行并打标签
- `TeamSelector.tsx`：下拉选择+新增输入，选中后从 Bitable 加载本团队历史数据
- `/api/bitable/records`：读写数据表1

### Step 5：板块二 UI + API（4步向导）
- `SkillStepWizard.tsx`：分步骤展示，步骤间有锁定逻辑（前步未完不可进入后步）
- 文件上传：`/api/upload` 接收文件 → 上传至飞书云盘 → 返回文件链接
- 第二步准确率验证（90% 门槛前端+后端双重校验）
- 第三/四步报告 `.md` 上传时：读取文件内容 → 调用 `/api/validate-report` → MiMo AI 判断是否包含三个必要分析点

### Step 6：进度看板
- `ProgressDashboard.tsx`：查询 Bitable 表2，统计团队各任务完成情况，显示总进度条

### Step 7：GitHub 仓库创建 + 推送
- 调用 GitHub MCP `create_repository`（Public，名称 `FOD-OperaSkill`）
- 初始化 commit 推送所有代码（`push_files` 或 git push）

### Step 8：Vercel 部署 + 域名配置
- 在 Vercel 导入 GitHub 仓库，配置所有环境变量
- 阿里云注册域名 → 在 Vercel 添加自定义域名 → 阿里云 DNS 添加 CNAME 记录指向 Vercel

---

## 注意事项

- **`.env.local` 绝对不提交 Git**（飞书/MiMo 密钥），仅在 Vercel 环境变量中配置
- **飞书 OAuth 需要**：在飞书开放平台后台为 `cli_a73764b8de38d063` 应用开启「网页应用」并配置回调域名（Vercel 域名或自定义域名）
- **母Skill 和 skill-creator.zip** 作为静态文件放在 `public/` 目录，供用户下载
- **Vercel 在中国大陆访问不稳定**，自定义域名后需在阿里云开启 HTTPS + 确认 DNS 正常解析即可（Vercel 免费 SSL）