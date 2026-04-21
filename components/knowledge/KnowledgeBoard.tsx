"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  GitMerge,
  ScrollText,
  Loader2,
  Plus,
  FileText,
  ExternalLink,
  Check,
  Archive,
  Undo2,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import { cn } from "@/lib/utils";
import { E2E_PROCESSES } from "@/lib/constants";
import type { FODRole } from "@/lib/roles";

type ViewMode = "extract" | "govern" | "consolidate";

interface KnowledgeItem {
  recordId: string;
  title: string;
  team: string;
  process: string;
  section: string;
  node: string;
  scene: string;
  fileUrl: string;
  extractorNames: string[];
  governorNames: string[];
  consolidatorNames: string[];
  status: "已提取" | "治理中" | "已整合" | "已归档" | "";
  version: string;
  extractedAt: number;
  governedAt: number;
  consolidatedAt: number;
  updatedAt: number;
  remark: string;
}

interface Props {
  mode: ViewMode;
}

const MODE_CONFIG: Record<
  ViewMode,
  {
    title: string;
    subtitle: string;
    ownerRole: FODRole;
    statusFilter: KnowledgeItem["status"];
    icon: React.ReactNode;
    emptyText: string;
    /** 列表上"操作按钮"行为 */
    actionLabel: string;
    actionIntent: "govern" | "consolidate" | "archive";
    /** 下一状态展示 */
    nextStatus: string;
  }
> = {
  extract: {
    title: "知识库 · 提取",
    subtitle:
      "从线下材料、飞书文档、SOP 等抽取可用于 Skill 训练的素材条目。提交后自动进入「治理」环节。",
    ownerRole: "FOD一线操作",
    statusFilter: "已提取",
    icon: <BookOpen size={22} />,
    emptyText: "暂无提取中的条目，点击右上角「新增条目」开始",
    actionLabel: "交给治理",
    actionIntent: "govern",
    nextStatus: "治理中",
  },
  govern: {
    title: "知识库 · 治理",
    subtitle:
      "由团队 AI 管理（主管）对已提取的条目做审核、清洗、补充标签，通过后进入「整合」环节。",
    ownerRole: "FOD一线AI管理",
    statusFilter: "已提取",
    icon: <GitMerge size={22} />,
    emptyText: "暂无待治理条目 · 等待一线操作提取",
    actionLabel: "完成治理",
    actionIntent: "consolidate",
    nextStatus: "已整合",
  },
  consolidate: {
    title: "知识库 · 整合",
    subtitle:
      "由 FOD 综管最终归档整合后的知识库条目，下发给 Skill 训练使用。",
    ownerRole: "FOD综管",
    statusFilter: "治理中",
    icon: <ScrollText size={22} />,
    emptyText: "暂无待整合条目 · 等待一线 AI 管理治理",
    actionLabel: "确认整合",
    actionIntent: "archive",
    nextStatus: "已归档",
  },
};

export function KnowledgeBoard({ mode }: Props) {
  const cfg = MODE_CONFIG[mode];
  const { user, team, setTeam, profile } = useAuth();
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (mode === "extract") {
        // 展示团队内"已提取 + 治理中 + 已整合" 三态，便于一线操作看进度
      } else {
        params.set("status", cfg.statusFilter);
      }
      if (team) params.set("team", team);
      const r = await fetch(`/api/knowledge?${params}`);
      const d = await r.json();
      if (d.success) setItems(d.items || []);
      else setItems([]);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [mode, cfg.statusFilter, team]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredByMode = useMemo(() => {
    if (mode === "extract") return items;
    return items.filter((x) => x.status === cfg.statusFilter);
  }, [items, mode, cfg.statusFilter]);

  const handleAdvance = async (item: KnowledgeItem) => {
    const r = await fetch("/api/knowledge", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recordId: item.recordId,
        action: cfg.actionIntent,
      }),
    });
    if (r.ok) load();
  };

  const handleRevert = async (item: KnowledgeItem) => {
    const r = await fetch("/api/knowledge", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recordId: item.recordId,
        action: "revert-to-extracted",
      }),
    });
    if (r.ok) load();
  };

  return (
    <AppLayout team={team} onTeamChange={setTeam} user={user}>
      <div className="p-4 md:p-6 max-w-[1200px] mx-auto">
        <PageHeader
          icon={cfg.icon}
          title={cfg.title}
          subtitle={cfg.subtitle}
          ownerRole={cfg.ownerRole}
          actions={
            mode === "extract" && (
              <Button
                onClick={() => setShowForm(true)}
                className="bg-blue-600 hover:bg-blue-700 gap-1"
              >
                <Plus size={14} /> 新增条目
              </Button>
            )
          }
          badges={
            <span className="text-[11px] text-gray-400">
              共 {filteredByMode.length} 条 · 团队：
              {team || "全部"}
            </span>
          }
        />

        {showForm && (
          <ExtractForm
            team={profile.team || team || ""}
            onCancel={() => setShowForm(false)}
            onSubmitted={() => {
              setShowForm(false);
              load();
            }}
          />
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
            <Loader2 size={16} className="animate-spin" /> 加载知识库条目…
          </div>
        ) : filteredByMode.length === 0 ? (
          <EmptyState text={cfg.emptyText} />
        ) : (
          <div className="grid gap-2.5">
            {filteredByMode.map((it) => (
              <ItemRow
                key={it.recordId}
                item={it}
                mode={mode}
                onAdvance={() => handleAdvance(it)}
                onRevert={() => handleRevert(it)}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="border-2 border-dashed rounded-xl p-16 text-center text-gray-400 text-sm">
      <FileText size={32} className="mx-auto mb-2 opacity-40" />
      {text}
    </div>
  );
}

function StatusPill({ status }: { status: KnowledgeItem["status"] }) {
  const map: Record<string, string> = {
    已提取: "bg-blue-50 text-blue-700 border-blue-200",
    治理中: "bg-amber-50 text-amber-700 border-amber-200",
    已整合: "bg-emerald-50 text-emerald-700 border-emerald-200",
    已归档: "bg-gray-100 text-gray-600 border-gray-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border",
        map[status] || "bg-gray-50 text-gray-500 border-gray-200"
      )}
    >
      {status || "未知"}
    </span>
  );
}

function ItemRow({
  item,
  mode,
  onAdvance,
  onRevert,
}: {
  item: KnowledgeItem;
  mode: ViewMode;
  onAdvance: () => void;
  onRevert: () => void;
}) {
  const when =
    item.updatedAt > 0 ? new Date(item.updatedAt).toLocaleString("zh-CN") : "";
  const showAdvance =
    (mode === "extract" && item.status === "已提取") ||
    (mode === "govern" && item.status === "已提取") ||
    (mode === "consolidate" && item.status === "治理中");

  const cfg = MODE_CONFIG[mode];

  return (
    <div className="rounded-xl border bg-white p-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <StatusPill status={item.status} />
            <span className="text-[13px] font-semibold text-gray-900 truncate">
              {item.title}
            </span>
            {item.version && (
              <span className="text-[10px] text-gray-400">
                {item.version}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500 flex-wrap">
            {item.process && (
              <span className="px-1.5 py-0.5 bg-gray-50 rounded">
                {item.process}
              </span>
            )}
            {item.section && (
              <span className="px-1.5 py-0.5 bg-gray-50 rounded">
                {item.section}
              </span>
            )}
            {item.node && (
              <span className="px-1.5 py-0.5 bg-gray-50 rounded">
                {item.node}
              </span>
            )}
            {item.scene && (
              <span className="text-gray-600">· 场景：{item.scene}</span>
            )}
            <span className="ml-auto text-gray-400">{when}</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-1 flex-wrap">
            {item.extractorNames.length > 0 && (
              <span>提取：{item.extractorNames.join("、")}</span>
            )}
            {item.governorNames.length > 0 && (
              <span>治理：{item.governorNames.join("、")}</span>
            )}
            {item.consolidatorNames.length > 0 && (
              <span>整合：{item.consolidatorNames.join("、")}</span>
            )}
            {item.fileUrl && (
              <a
                href={item.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-blue-600 hover:underline"
              >
                查看文件 <ExternalLink size={10} />
              </a>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {mode === "consolidate" && item.status === "治理中" && (
            <Button
              size="sm"
              variant="outline"
              onClick={onRevert}
              className="h-7 text-[11px] gap-1"
              title="打回给一线操作修改"
            >
              <Undo2 size={11} /> 打回
            </Button>
          )}
          {showAdvance && (
            <Button
              size="sm"
              onClick={onAdvance}
              className={cn(
                "h-7 text-[11px] gap-1",
                cfg.actionIntent === "archive"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-blue-600 hover:bg-blue-700"
              )}
            >
              {cfg.actionIntent === "archive" ? (
                <Archive size={11} />
              ) : (
                <Check size={11} />
              )}
              {cfg.actionLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// 新增条目表单（仅 extract 视图）
// ──────────────────────────────────────────────
function ExtractForm({
  team,
  onCancel,
  onSubmitted,
}: {
  team: string;
  onCancel: () => void;
  onSubmitted: () => void;
}) {
  const [title, setTitle] = useState("");
  const [processId, setProcessId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [nodeId, setNodeId] = useState("");
  const [scene, setScene] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);

  const process = E2E_PROCESSES.find((p) => p.id === processId);
  const section = process?.sections.find((s) => s.id === sectionId);

  const submit = async () => {
    if (!title.trim()) {
      alert("条目标题不能为空");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          team,
          process: process?.shortName || "",
          section: section?.name || "",
          node:
            section?.nodes.find((n) => n.id === nodeId)?.name || "",
          scene: scene.trim(),
          fileUrl: fileUrl.trim(),
          version: "v1.0",
          remark,
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) {
        alert(d.error || "保存失败");
        return;
      }
      onSubmitted();
    } catch (err) {
      alert(`保存失败：${err}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border bg-blue-50/40 border-blue-200 p-4 mb-4">
      <div className="text-sm font-semibold text-blue-900 mb-3">
        新增知识库条目（提交后自动进入「治理」环节）
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <Label>条目标题 *</Label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例：合同审核 - 关键字段清单 v1"
            className={inputCls}
          />
        </div>
        <div>
          <Label>归属团队</Label>
          <input value={team} readOnly className={cn(inputCls, "bg-gray-50")} />
        </div>
        <div>
          <Label>端到端流程</Label>
          <select
            value={processId}
            onChange={(e) => {
              setProcessId(e.target.value);
              setSectionId("");
              setNodeId("");
            }}
            className={inputCls}
          >
            <option value="">— 选择 —</option>
            {E2E_PROCESSES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>环节</Label>
          <select
            value={sectionId}
            onChange={(e) => {
              setSectionId(e.target.value);
              setNodeId("");
            }}
            disabled={!process}
            className={inputCls}
          >
            <option value="">— 选择 —</option>
            {process?.sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>节点</Label>
          <select
            value={nodeId}
            onChange={(e) => setNodeId(e.target.value)}
            disabled={!section}
            className={inputCls}
          >
            <option value="">— 选择 —</option>
            {section?.nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>关联场景名</Label>
          <input
            value={scene}
            onChange={(e) => setScene(e.target.value)}
            placeholder="可选 · 如：合同审核"
            className={inputCls}
          />
        </div>
        <div className="md:col-span-2">
          <Label>素材文件链接（飞书云文档/附件 URL）</Label>
          <input
            value={fileUrl}
            onChange={(e) => setFileUrl(e.target.value)}
            placeholder="https://..."
            className={inputCls}
          />
        </div>
        <div className="md:col-span-2">
          <Label>备注</Label>
          <textarea
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            rows={2}
            placeholder="可选，补充说明该条目的用法、注意事项"
            className={cn(inputCls, "resize-none")}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          取消
        </Button>
        <Button
          onClick={submit}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {saving ? "提交中…" : "提交条目"}
        </Button>
      </div>
    </div>
  );
}

const inputCls =
  "w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-medium text-gray-600 mb-1">
      {children}
    </label>
  );
}
