"use client";

/**
 * 单步聊焦视图的"同伴 / 卡点 / 目标"扩展区
 *   - TeamPeerFiles   同团队其他成员当前步骤已上传文件流式卡片
 *   - InlineBlockerForm  登记本步骤卡点（写入 Table5）
 *   - InlineGoalForm     登记明日关键目标（写入 Table6）
 */

import { useCallback, useEffect, useState } from "react";
import {
  Users,
  AlertOctagon,
  Target,
  RefreshCw,
  FileText,
  ExternalLink,
  Loader2,
  Save,
  X,
  Plus,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PeerFile {
  contentType: string;
  fileName: string;
  url: string;
  submittedAt?: number;
  submitter?: string;
}

interface FieldLinkValue {
  link?: string;
  text?: string;
}

type AttachmentItem = {
  url?: string;
  name?: string;
  file_name?: string;
  tmp_url?: string;
};

interface FeishuRecordFields {
  [key: string]: unknown;
}

interface FeishuRecord {
  id: string;
  fields: FeishuRecordFields;
}

function extractFileLink(raw: unknown): { url: string; fileName: string } | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    if (raw.startsWith("http")) return { url: raw, fileName: raw };
    return null;
  }
  if (typeof raw === "object") {
    const obj = raw as FieldLinkValue & { url?: string; text?: string };
    const url = obj.link || obj.url || "";
    const name = obj.text || "";
    if (url) return { url, fileName: name || url };
  }
  return null;
}

function extractAttachments(raw: unknown): Array<{ url: string; fileName: string }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ url: string; fileName: string }> = [];
  for (const item of raw as AttachmentItem[]) {
    if (!item) continue;
    const url = item.url || item.tmp_url || "";
    const name = item.name || item.file_name || "附件";
    if (url) out.push({ url, fileName: name });
  }
  return out;
}

function extractName(raw: unknown): string {
  if (!raw) return "";
  if (Array.isArray(raw)) {
    return (raw as Array<{ name?: string }>)
      .map((x) => x?.name || "")
      .filter(Boolean)
      .join("、");
  }
  if (typeof raw === "object") {
    const obj = raw as { name?: string; text?: string };
    return obj.name || obj.text || "";
  }
  return String(raw);
}

function formatTime(ms?: number): string {
  if (!ms) return "";
  return new Date(ms).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TeamPeerFiles({
  team,
  taskName,
  step,
}: {
  team: string;
  taskName: string;
  step: number;
}) {
  const [files, setFiles] = useState<PeerFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const load = useCallback(async () => {
    if (!team || !taskName) return;
    setLoading(true);
    try {
      const r = await fetch(
        `/api/bitable/records?table=2&team=${encodeURIComponent(team)}&task=${encodeURIComponent(taskName)}`
      );
      const d = await r.json();
      if (!d.success) return;
      const list: PeerFile[] = [];
      for (const rec of d.records as FeishuRecord[]) {
        const stepNum = Number(rec.fields["步骤编号"]);
        if (stepNum !== step) continue;

        const contentType = String(rec.fields["内容类型"] || "");
        const fileName = String(rec.fields["文件名称"] || "");
        const submittedAt = Number(rec.fields["提交时间"]) || undefined;
        const submitter = extractName(rec.fields["提交者"]);

        const link = extractFileLink(rec.fields["文件链接"]);
        if (link) {
          list.push({
            contentType,
            fileName: link.fileName || fileName || "附件",
            url: link.url,
            submittedAt,
            submitter,
          });
        }

        const attachments = extractAttachments(rec.fields["附件"]);
        for (const a of attachments) {
          list.push({
            contentType,
            fileName: a.fileName,
            url: a.url,
            submittedAt,
            submitter,
          });
        }
      }
      list.sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
      setFiles(list);
    } catch (err) {
      console.error("加载团队文件流失败:", err);
    } finally {
      setLoading(false);
    }
  }, [team, taskName, step]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
          <Users size={14} className="text-slate-500" />
          本团队第 {step} 步共享资料
          <span className="text-xs text-slate-400">({files.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              load();
            }}
            className="text-slate-400 hover:text-slate-600"
            title="刷新"
          >
            <RefreshCw size={12} className={cn(loading && "animate-spin")} />
          </button>
          <ChevronDown
            size={14}
            className={cn(
              "text-slate-400 transition-transform",
              expanded && "rotate-180"
            )}
          />
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          {loading && files.length === 0 ? (
            <div className="text-xs text-slate-400 py-3 text-center">加载中...</div>
          ) : files.length === 0 ? (
            <div className="text-xs text-slate-400 py-3 text-center">
              还没有同伴提交过这一步的资料
            </div>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {files.map((f, i) => (
                <a
                  key={i}
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group shrink-0 w-52 bg-white border border-slate-200 rounded-lg p-2.5 hover:border-blue-400 hover:shadow-md transition-all"
                >
                  <div className="flex items-start gap-1.5 mb-1">
                    <div className="w-7 h-7 rounded bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <FileText size={13} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-slate-400 font-medium truncate">
                        {f.contentType || "附件"}
                      </div>
                      <div
                        className="text-xs font-semibold text-slate-800 truncate"
                        title={f.fileName}
                      >
                        {f.fileName}
                      </div>
                    </div>
                    <ExternalLink
                      size={11}
                      className="text-slate-300 group-hover:text-blue-500 shrink-0 mt-0.5"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="truncate max-w-[80px]">{f.submitter || ""}</span>
                    <span>{formatTime(f.submittedAt)}</span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 登记卡点（Table5） ─────────────────────────────
export function InlineBlockerForm({
  team,
  processShortName,
  sectionName,
  nodeName,
  taskName,
  step,
  readOnly = false,
}: {
  team: string;
  processShortName: string;
  sectionName: string;
  nodeName: string;
  taskName: string;
  step: number;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const submit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const r = await fetch("/api/bitable/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: "5",
          fields: {
            团队名称: team,
            卡点标题: title.trim(),
            卡点详情: detail.trim(),
            状态: "待解决",
            端到端流程: processShortName,
            环节: sectionName,
            节点: nodeName,
            关联任务名: taskName,
            关联场景名: taskName,
            步骤编号: step,
          },
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || "保存失败");
      setTitle("");
      setDetail("");
      setSavedMsg("已登记。去【看板】可查看。");
      setTimeout(() => setSavedMsg(""), 3000);
      setOpen(false);
    } catch (err) {
      setSavedMsg(`保存失败：${err}`);
    } finally {
      setSaving(false);
    }
  };

  if (readOnly) return null;

  return (
    <div className="rounded-xl border border-red-200 bg-red-50/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-red-50 transition-colors"
      >
        <div className="flex items-center gap-1.5 text-sm font-medium text-red-700">
          <AlertOctagon size={14} />
          这一步卡住了？登记主要卡点
        </div>
        <div className="flex items-center gap-2">
          {savedMsg && (
            <span className="text-xs text-emerald-600 font-medium">{savedMsg}</span>
          )}
          {open ? (
            <X size={14} className="text-red-400" />
          ) : (
            <Plus size={14} className="text-red-400" />
          )}
        </div>
      </button>
      {open && (
        <div className="p-3 pt-0 space-y-2 border-t border-red-100 bg-white/80">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="卡点标题（例如：调优数据源不齐）"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300"
          />
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            rows={3}
            placeholder="详细描述：哪个环节被卡住？需要谁的支持？"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
          />
          <div className="text-[10px] text-gray-500 bg-gray-50 border border-gray-200 px-2 py-1.5 rounded">
            将自动关联：{processShortName} · {sectionName} / {nodeName} · {taskName} · 第
            {step}步
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button
              size="sm"
              onClick={submit}
              disabled={!title.trim() || saving}
              className="bg-red-600 hover:bg-red-700"
            >
              {saving ? (
                <>
                  <Loader2 size={12} className="animate-spin mr-1" /> 保存中
                </>
              ) : (
                <>
                  <Save size={12} className="mr-1" /> 登记
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 登记明日关键目标（Table6） ─────────────────────────────
export type GoalBindType = "任务步骤" | "环节节点" | "自由文本";

export function InlineGoalForm({
  team,
  processShortName,
  sectionName,
  nodeName,
  taskName,
  step,
  readOnly = false,
}: {
  team: string;
  processShortName: string;
  sectionName: string;
  nodeName: string;
  taskName: string;
  step: number;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [bindType, setBindType] = useState<GoalBindType>("任务步骤");
  const [title, setTitle] = useState("");
  const [stepList, setStepList] = useState<number[]>([step]);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const toggleStep = (s: number) => {
    setStepList((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s].sort()
    );
  };

  const submit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const fields: Record<string, unknown> = {
        团队名称: team,
        目标标题: title.trim(),
        关联类型: bindType,
      };

      if (bindType === "任务步骤") {
        fields["端到端流程"] = processShortName;
        fields["环节"] = sectionName;
        fields["节点"] = nodeName;
        fields["关联任务名"] = taskName;
        fields["关联场景名"] = taskName;
        fields["步骤编号列表"] = stepList.join(",");
      } else if (bindType === "环节节点") {
        fields["端到端流程"] = processShortName;
        fields["环节"] = sectionName;
        fields["节点"] = nodeName;
      }

      const r = await fetch("/api/bitable/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: "6", fields }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || "保存失败");
      setTitle("");
      setStepList([step]);
      setBindType("任务步骤");
      setSavedMsg("已登记。去【看板】查看。");
      setTimeout(() => setSavedMsg(""), 3000);
      setOpen(false);
    } catch (err) {
      setSavedMsg(`保存失败：${err}`);
    } finally {
      setSaving(false);
    }
  };

  if (readOnly) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-amber-50 transition-colors"
      >
        <div className="flex items-center gap-1.5 text-sm font-medium text-amber-700">
          <Target size={14} />
          登记明日关键目标
        </div>
        <div className="flex items-center gap-2">
          {savedMsg && (
            <span className="text-xs text-emerald-600 font-medium">{savedMsg}</span>
          )}
          {open ? (
            <X size={14} className="text-amber-400" />
          ) : (
            <Plus size={14} className="text-amber-400" />
          )}
        </div>
      </button>
      {open && (
        <div className="p-3 pt-0 space-y-2 border-t border-amber-100 bg-white/80">
          <div className="grid grid-cols-3 gap-1">
            {(["任务步骤", "环节节点", "自由文本"] as GoalBindType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setBindType(t)}
                className={cn(
                  "px-2 py-1 text-xs rounded border transition-all",
                  bindType === t
                    ? "border-amber-500 bg-amber-100 text-amber-800 font-semibold"
                    : "border-gray-200 bg-white text-gray-600 hover:border-amber-300"
                )}
              >
                {t === "任务步骤" ? "场景步骤" : t}
              </button>
            ))}
          </div>

          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="目标描述（例如：完成子Skill2 调优到 100%）"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
          />

          {bindType === "任务步骤" && (
            <div className="space-y-1.5">
              <div className="text-[10px] text-gray-500">勾选要完成的步骤（多选）：</div>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4].map((s) => (
                  <label
                    key={s}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1 border rounded cursor-pointer text-xs",
                      stepList.includes(s)
                        ? "border-amber-500 bg-amber-100 text-amber-800"
                        : "border-gray-200 bg-white text-gray-500 hover:border-amber-300"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={stepList.includes(s)}
                      onChange={() => toggleStep(s)}
                      className="accent-amber-500"
                    />
                    第{s}步
                  </label>
                ))}
              </div>
              <div className="text-[10px] text-gray-500 bg-gray-50 border border-gray-200 px-2 py-1.5 rounded">
                将绑定到：{processShortName} · {sectionName} / {nodeName} · {taskName}
              </div>
            </div>
          )}

          {bindType === "环节节点" && (
            <div className="text-[10px] text-gray-500 bg-gray-50 border border-gray-200 px-2 py-1.5 rounded">
              将绑定到环节/节点：{processShortName} · {sectionName} / {nodeName}
              （表示该节点下的所有场景）
            </div>
          )}

          {bindType === "自由文本" && (
            <div className="text-[10px] text-gray-500 bg-gray-50 border border-gray-200 px-2 py-1.5 rounded">
              不绑定具体场景/节点，仅作为纯文字目标。
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button
              size="sm"
              onClick={submit}
              disabled={!title.trim() || saving}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {saving ? (
                <>
                  <Loader2 size={12} className="animate-spin mr-1" /> 保存中
                </>
              ) : (
                <>
                  <Save size={12} className="mr-1" /> 登记
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function StepExtras({
  team,
  task,
  step,
  readOnly = false,
}: {
  team: string;
  task: {
    taskName: string;
    sectionName: string;
    nodeName: string;
    processShortName: string;
  };
  step: number;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-3 pt-3 border-t border-slate-200">
      <TeamPeerFiles team={team} taskName={task.taskName} step={step} />
      <div className="grid sm:grid-cols-2 gap-3">
        <InlineBlockerForm
          team={team}
          processShortName={task.processShortName}
          sectionName={task.sectionName}
          nodeName={task.nodeName}
          taskName={task.taskName}
          step={step}
          readOnly={readOnly}
        />
        <InlineGoalForm
          team={team}
          processShortName={task.processShortName}
          sectionName={task.sectionName}
          nodeName={task.nodeName}
          taskName={task.taskName}
          step={step}
          readOnly={readOnly}
        />
      </div>
    </div>
  );
}
