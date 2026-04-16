"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  ClipboardList,
  ArrowRight,
  X,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  TASK_LABELS,
  parseTaskLabelFromFeishu,
  type TaskLabel,
  type E2EProcess,
  type ProcessSection,
  type ProcessNode,
} from "@/lib/constants";

interface TaskRow {
  id: string;
  taskName: string;
  label: TaskLabel | "";
  saved: boolean;
  recordId?: string;
  submittedAt?: number; // 飞书 提交时间（毫秒）
}

interface NodeMappingGridProps {
  team: string;
  userName: string;
  process: E2EProcess;
  onlyManual: boolean;
  onlyHasTasks: boolean;
}

// 进度数据：任务名 → 已完成步骤数 (0-4)
type ProgressMap = Record<string, number>;

// 重复警告弹窗的数据结构
interface DupAlert {
  nodeId: string;
  nodeName: string;
  sectionName: string;
  duplicates: { taskName: string; submittedAt?: number }[];
  newOnes: TaskRow[];
  bulkLabel?: TaskLabel | "";
  isBatch: boolean;
}

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

function formatTs(ms?: number): string {
  if (!ms) return "未知时间";
  return new Date(ms).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NodeMappingGrid({
  team,
  userName,
  process,
  onlyManual,
  onlyHasTasks,
}: NodeMappingGridProps) {
  // nodeId → TaskRow[]
  const [nodeTasksMap, setNodeTasksMap] = useState<Record<string, TaskRow[]>>({});
  const [progressMap, setProgressMap] = useState<ProgressMap>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, "success" | "error" | null>>({});
  const [loading, setLoading] = useState(false);

  // 批量导入状态
  const [batchState, setBatchState] = useState<{
    nodeId: string;
    sectionName: string;
    nodeName: string;
    text: string;
    step: "input" | "label";
    tempTasks: string[];
    bulkLabel: TaskLabel | "";
  } | null>(null);

  // 重复任务警告弹窗
  const [dupAlert, setDupAlert] = useState<DupAlert | null>(null);

  const router = useRouter();
  const batchTextRef = useRef<HTMLTextAreaElement>(null);

  // 加载团队数据（表1 + 表2进度）
  const loadData = useCallback(async () => {
    if (!team) return;
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/bitable/records?table=1&team=${encodeURIComponent(team)}`).then((r) => r.json()),
        fetch(`/api/bitable/records?table=2&team=${encodeURIComponent(team)}`).then((r) => r.json()),
      ]);

      // 构建节点名称 → nodeId 映射（当前流程）
      const nodeNameToId: Record<string, string> = {};
      const sectionNameToId: Record<string, string> = {};
      for (const sec of process.sections) {
        sectionNameToId[sec.name] = sec.id;
        for (const node of sec.nodes) {
          nodeNameToId[node.name] = node.id;
        }
      }

      // 表1：填入任务
      const map: Record<string, TaskRow[]> = {};
      if (r1.success) {
        for (const record of r1.records) {
          const nodeName = record.fields["流程节点"] as string;
          const sectionName = record.fields["流程环节"] as string;
          const taskName = record.fields["任务名称"] as string;
          const labelRaw = record.fields["标签"] as string | undefined;
          const submittedAt = record.fields["提交时间"] as number | undefined;
          const e2eField = record.fields["端到端流程"] as string | undefined;

          // 如果记录有「端到端流程」字段，精确匹配当前流程；否则回落到节点名匹配
          if (e2eField && e2eField !== process.shortName && e2eField !== process.name && e2eField !== process.id) {
            continue;
          }

          const nodeId = nodeNameToId[nodeName];
          if (!nodeId) continue;
          if (!e2eField && sectionName && sectionNameToId[sectionName] === undefined) continue;

          const label = parseTaskLabelFromFeishu(labelRaw);

          if (!map[nodeId]) map[nodeId] = [];
          map[nodeId].push({
            id: generateId(),
            taskName: taskName || "",
            label,
            saved: true,
            recordId: record.id,
            submittedAt,
          });
        }
      }
      setNodeTasksMap(map);

      // 表2：计算每个任务的进度
      const prog: ProgressMap = {};
      if (r2.success) {
        const stepsPerTask: Record<string, Set<number>> = {};
        for (const record of r2.records) {
          const taskName = record.fields["关联任务"] as string;
          const step = record.fields["步骤编号"] as number;
          const status = record.fields["步骤状态"] as string;
          if (!taskName || status !== "已完成") continue;
          if (!stepsPerTask[taskName]) stepsPerTask[taskName] = new Set();
          stepsPerTask[taskName].add(step);
        }
        for (const [name, steps] of Object.entries(stepsPerTask)) {
          prog[name] = steps.size;
        }
      }
      setProgressMap(prog);
    } catch (err) {
      console.error("加载失败:", err);
    } finally {
      setLoading(false);
    }
  }, [team, process]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 添加空任务行
  const addTask = (nodeId: string) => {
    setNodeTasksMap((prev) => ({
      ...prev,
      [nodeId]: [
        ...(prev[nodeId] || []),
        { id: generateId(), taskName: "", label: "", saved: false },
      ],
    }));
  };

  const updateTask = (nodeId: string, taskId: string, updates: Partial<TaskRow>) => {
    setNodeTasksMap((prev) => ({
      ...prev,
      [nodeId]: (prev[nodeId] || []).map((t) =>
        t.id === taskId ? { ...t, ...updates, saved: false } : t
      ),
    }));
  };

  const removeTask = (nodeId: string, taskId: string) => {
    setNodeTasksMap((prev) => ({
      ...prev,
      [nodeId]: (prev[nodeId] || []).filter((t) => t.id !== taskId),
    }));
  };

  // 实际写入飞书（重复检测后调用）
  const doSaveTasks = async (
    nodeId: string,
    nodeName: string,
    sectionName: string,
    tasksToSave: TaskRow[],
    labelOverride?: TaskLabel | ""
  ) => {
    setSaving((prev) => ({ ...prev, [nodeId]: true }));
    setSaveStatus((prev) => ({ ...prev, [nodeId]: null }));
    try {
      for (const task of tasksToSave) {
        const effectiveLabel = labelOverride !== undefined ? labelOverride : task.label;
        const labelOpt = TASK_LABELS.find((l) => l.value === effectiveLabel);
        const labelText = labelOpt ? `${labelOpt.icon} ${labelOpt.label}` : "";
        await fetch("/api/bitable/records", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            table: "1",
            fields: {
              团队名称: team,
              端到端流程: process.shortName,
              流程环节: sectionName,
              流程节点: nodeName,
              任务名称: task.taskName.trim(),
              标签: labelText,
            },
          }),
        });
      }
      setNodeTasksMap((prev) => ({
        ...prev,
        [nodeId]: (prev[nodeId] || []).map((t) => {
          const isSaved = tasksToSave.find((u) => u.id === t.id);
          if (isSaved) {
            return { ...t, saved: true, label: labelOverride !== undefined ? (labelOverride as TaskLabel) : t.label };
          }
          return t;
        }),
      }));
      setSaveStatus((prev) => ({ ...prev, [nodeId]: "success" }));
      setTimeout(() => setSaveStatus((prev) => ({ ...prev, [nodeId]: null })), 3000);
    } catch {
      setSaveStatus((prev) => ({ ...prev, [nodeId]: "error" }));
    } finally {
      setSaving((prev) => ({ ...prev, [nodeId]: false }));
    }
  };

  // 保存某个节点的未保存任务（含重复检测）
  const saveNodeTasks = async (
    nodeId: string,
    nodeName: string,
    sectionName: string
  ) => {
    const tasks = nodeTasksMap[nodeId] || [];
    const unsaved = tasks.filter((t) => !t.saved && t.taskName.trim() && t.label);
    if (unsaved.length === 0) return;

    const savedNames = new Set(
      tasks.filter((t) => t.saved).map((t) => t.taskName.trim())
    );
    const duplicates = unsaved
      .filter((t) => savedNames.has(t.taskName.trim()))
      .map((t) => ({
        taskName: t.taskName.trim(),
        submittedAt: tasks.find((s) => s.saved && s.taskName.trim() === t.taskName.trim())?.submittedAt,
      }));
    const newOnes = unsaved.filter((t) => !savedNames.has(t.taskName.trim()));

    if (duplicates.length > 0) {
      setDupAlert({ nodeId, nodeName, sectionName, duplicates, newOnes, isBatch: false });
      return;
    }

    await doSaveTasks(nodeId, nodeName, sectionName, newOnes);
  };

  // 批量导入确认（第一步：解析文本）
  const confirmBatchText = () => {
    if (!batchState) return;
    const lines = batchState.text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    setBatchState((prev) => prev && { ...prev, step: "label", tempTasks: lines, bulkLabel: "" });
  };

  // 批量导入保存（第二步：打标签后保存，含重复检测）
  const saveBatchImport = async () => {
    if (!batchState || batchState.step !== "label" || !batchState.bulkLabel) return;
    const { nodeId, sectionName, nodeName, tempTasks, bulkLabel } = batchState;

    const existingTasks = nodeTasksMap[nodeId] || [];
    const savedNames = new Set(existingTasks.filter((t) => t.saved).map((t) => t.taskName.trim()));

    const duplicateNames = tempTasks.filter((name) => savedNames.has(name.trim()));
    const newNames = tempTasks.filter((name) => !savedNames.has(name.trim()));

    if (duplicateNames.length > 0) {
      const duplicates = duplicateNames.map((name) => ({
        taskName: name,
        submittedAt: existingTasks.find((t) => t.saved && t.taskName.trim() === name.trim())?.submittedAt,
      }));
      const newOnes = newNames.map((name) => ({
        id: generateId(),
        taskName: name,
        label: bulkLabel,
        saved: false,
      }));
      setBatchState(null);
      setDupAlert({ nodeId, nodeName, sectionName, duplicates, newOnes, bulkLabel, isBatch: true });
      return;
    }

    setBatchState(null);
    const newOnes = newNames.map((name) => ({
      id: generateId(),
      taskName: name,
      label: bulkLabel,
      saved: false,
    }));
    await commitBatchRows(nodeId, nodeName, sectionName, newOnes, bulkLabel);
  };

  // 实际写入批量导入的行
  const commitBatchRows = async (
    nodeId: string,
    nodeName: string,
    sectionName: string,
    rows: TaskRow[],
    bulkLabel: TaskLabel | ""
  ) => {
    if (rows.length === 0) return;
    const labelOpt = TASK_LABELS.find((l) => l.value === bulkLabel);
    const labelText = labelOpt ? `${labelOpt.icon} ${labelOpt.label}` : "";
    setSaving((prev) => ({ ...prev, [nodeId]: true }));
    try {
      const newRows: TaskRow[] = [];
      for (const row of rows) {
        await fetch("/api/bitable/records", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            table: "1",
            fields: {
              团队名称: team,
              端到端流程: process.shortName,
              流程环节: sectionName,
              流程节点: nodeName,
              任务名称: row.taskName.trim(),
              标签: labelText,
            },
          }),
        });
        newRows.push({ ...row, label: bulkLabel as TaskLabel, saved: true });
      }
      setNodeTasksMap((prev) => ({
        ...prev,
        [nodeId]: [...(prev[nodeId] || []), ...newRows],
      }));
      setSaveStatus((prev) => ({ ...prev, [nodeId]: "success" }));
      setTimeout(() => setSaveStatus((prev) => ({ ...prev, [nodeId]: null })), 3000);
    } catch {
      setSaveStatus((prev) => ({ ...prev, [nodeId]: "error" }));
    } finally {
      setSaving((prev) => ({ ...prev, [nodeId]: false }));
    }
  };

  // 重复弹窗：继续保存新任务（跳过重复）
  const handleDupContinue = async () => {
    if (!dupAlert) return;
    const { nodeId, nodeName, sectionName, newOnes, bulkLabel, isBatch } = dupAlert;
    setDupAlert(null);
    if (newOnes.length === 0) return;
    if (isBatch && bulkLabel !== undefined) {
      await commitBatchRows(nodeId, nodeName, sectionName, newOnes, bulkLabel);
    } else {
      await doSaveTasks(nodeId, nodeName, sectionName, newOnes);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-3" />
        正在加载 {team} 的历史数据...
      </div>
    );
  }

  return (
    <div className="relative">
      {/* 图例 */}
      <div className="flex flex-wrap gap-2 px-4 pt-3 pb-2 bg-gray-50 border-b">
        <span className="text-xs text-gray-400 self-center mr-1">图例：</span>
        {TASK_LABELS.map((l) => (
          <span
            key={l.value}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border",
              l.color, l.bgColor, l.borderColor
            )}
          >
            {l.icon} {l.label}
          </span>
        ))}
        <span className="text-xs text-gray-400 self-center ml-2">
          · 提交者：{userName}
        </span>
      </div>

      {/* 二维看板（横向滚动） */}
      <div className="overflow-x-auto">
        <div className="flex min-w-max">
          {process.sections.map((section, sIdx) => {
            // onlyHasTasks：有已保存任务；若同时 onlyManual，则只认「已保存且纯线下」
            if (onlyHasTasks) {
              const hasAny = section.nodes.some((n) => {
                const saved = (nodeTasksMap[n.id] || []).filter((t) => t.saved);
                if (onlyManual) {
                  return saved.some((t) => t.label === "pure_manual");
                }
                return saved.length > 0;
              });
              if (!hasAny) return null;
            }
            return (
              <SectionGroup
                key={section.id}
                section={section}
                sectionIndex={sIdx}
                processColor={process.color}
                nodeTasksMap={nodeTasksMap}
                progressMap={progressMap}
                saving={saving}
                saveStatus={saveStatus}
                onlyManual={onlyManual}
                onlyHasTasks={onlyHasTasks}
                onAddTask={addTask}
                onUpdateTask={updateTask}
                onRemoveTask={removeTask}
                onSaveNode={saveNodeTasks}
                onOpenBatch={(nodeId, sectionName, nodeName) => {
                  setBatchState({
                    nodeId,
                    sectionName,
                    nodeName,
                    text: "",
                    step: "input",
                    tempTasks: [],
                    bulkLabel: "",
                  });
                  setTimeout(() => batchTextRef.current?.focus(), 50);
                }}
                onNavigateToTask={(taskName) =>
                  router.push(`/section2?task=${encodeURIComponent(taskName)}`)
                }
              />
            );
          })}
        </div>
      </div>

      {/* 批量导入弹层 */}
      {batchState && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-gray-900">批量导入任务</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  节点：{batchState.nodeName}（{batchState.sectionName}）
                </div>
              </div>
              <button onClick={() => setBatchState(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            {batchState.step === "input" ? (
              <>
                <div className="text-sm text-gray-600">
                  每行输入一个任务名称，系统自动识别为多条任务：
                </div>
                <textarea
                  ref={batchTextRef}
                  value={batchState.text}
                  onChange={(e) =>
                    setBatchState((prev) => prev && { ...prev, text: e.target.value })
                  }
                  rows={8}
                  placeholder={"任务名称1\n任务名称2\n任务名称3\n..."}
                  className="w-full text-sm border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none font-mono"
                />
                <div className="text-xs text-gray-400">
                  已识别 {batchState.text.split("\n").filter((l) => l.trim()).length} 条任务
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setBatchState(null)}>取消</Button>
                  <Button
                    onClick={confirmBatchText}
                    disabled={!batchState.text.split("\n").filter((l) => l.trim()).length}
                  >
                    下一步：批量打标签 →
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="text-sm text-gray-700">
                  即将导入 <strong>{batchState.tempTasks.length}</strong> 条任务，请为它们选择统一标签：
                </div>
                <div className="max-h-32 overflow-y-auto border rounded-lg p-2 bg-gray-50">
                  {batchState.tempTasks.map((t, i) => (
                    <div key={i} className="text-xs text-gray-700 py-0.5 border-b last:border-b-0">
                      {i + 1}. {t}
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {TASK_LABELS.map((label) => (
                    <button
                      key={label.value}
                      onClick={() =>
                        setBatchState((prev) => prev && { ...prev, bulkLabel: label.value })
                      }
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all",
                        batchState.bulkLabel === label.value
                          ? cn(label.color, label.bgColor, label.borderColor, "ring-2 ring-offset-1")
                          : "text-gray-500 border-gray-300 hover:border-gray-400"
                      )}
                    >
                      {label.icon} {label.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 justify-between">
                  <Button variant="outline" onClick={() => setBatchState((prev) => prev && { ...prev, step: "input" })}>
                    ← 返回修改
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setBatchState(null)}>取消</Button>
                    <Button onClick={saveBatchImport} disabled={!batchState.bulkLabel}>
                      <Save size={14} className="mr-1" />
                      保存 {batchState.tempTasks.length} 条任务
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 重复任务警告弹层 */}
      {dupAlert && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-100">
                <AlertTriangle size={20} className="text-amber-600" />
              </div>
              <div>
                <div className="font-bold text-gray-900">发现重复任务</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  节点：{dupAlert.nodeName}（{dupAlert.sectionName}）
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-gray-700 font-medium">
                以下 {dupAlert.duplicates.length} 条任务已提交过，将被跳过：
              </div>
              <div className="max-h-40 overflow-y-auto border border-amber-200 rounded-lg divide-y divide-amber-100 bg-amber-50">
                {dupAlert.duplicates.map((d, i) => (
                  <div key={i} className="px-3 py-2 text-xs">
                    <span className="font-medium text-amber-900">{d.taskName}</span>
                    <span className="text-amber-600 ml-2">
                      （提交于 {formatTs(d.submittedAt)}）
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {dupAlert.newOnes.length > 0 ? (
              <div className="space-y-2">
                <div className="text-sm text-gray-700 font-medium">
                  以下 {dupAlert.newOnes.length} 条任务是新增的，将被保存：
                </div>
                <div className="max-h-32 overflow-y-auto border border-green-200 rounded-lg divide-y divide-green-100 bg-green-50">
                  {dupAlert.newOnes.map((t, i) => (
                    <div key={i} className="px-3 py-2 text-xs text-green-900 font-medium">
                      {t.taskName}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600 text-center">
                所有任务均已存在，无新内容需要保存。
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDupAlert(null)}>取消</Button>
              {dupAlert.newOnes.length > 0 && (
                <Button onClick={handleDupContinue}>
                  <Save size={14} className="mr-1" />
                  跳过重复，保存新任务
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 环节组（包含该环节下所有节点列） ───
function SectionGroup({
  section,
  sectionIndex,
  processColor,
  nodeTasksMap,
  progressMap,
  saving,
  saveStatus,
  onlyManual,
  onlyHasTasks,
  onAddTask,
  onUpdateTask,
  onRemoveTask,
  onSaveNode,
  onOpenBatch,
  onNavigateToTask,
}: {
  section: ProcessSection;
  sectionIndex: number;
  processColor: string;
  nodeTasksMap: Record<string, TaskRow[]>;
  progressMap: ProgressMap;
  saving: Record<string, boolean>;
  saveStatus: Record<string, "success" | "error" | null>;
  onlyManual: boolean;
  onlyHasTasks: boolean;
  onAddTask: (nodeId: string) => void;
  onUpdateTask: (nodeId: string, taskId: string, updates: Partial<TaskRow>) => void;
  onRemoveTask: (nodeId: string, taskId: string) => void;
  onSaveNode: (nodeId: string, nodeName: string, sectionName: string) => Promise<void>;
  onOpenBatch: (nodeId: string, sectionName: string, nodeName: string) => void;
  onNavigateToTask: (taskName: string) => void;
}) {
  const headerColors: Record<string, string> = {
    blue: "from-blue-600 to-blue-500",
    green: "from-green-600 to-green-500",
    purple: "from-purple-600 to-purple-500",
    orange: "from-orange-600 to-orange-500",
    red: "from-red-600 to-red-500",
  };

  // onlyHasTasks：有已保存任务；若同时 onlyManual，则只认「已保存且纯线下」
  const visibleNodes = onlyHasTasks
    ? section.nodes.filter((n) => {
        const saved = (nodeTasksMap[n.id] || []).filter((t) => t.saved);
        if (onlyManual) {
          return saved.some((t) => t.label === "pure_manual");
        }
        return saved.length > 0;
      })
    : section.nodes;

  if (visibleNodes.length === 0) return null;

  return (
    <div className={cn("flex flex-col border-r border-gray-200", sectionIndex === 0 && "border-l")}>
      {/* 环节标题 */}
      <div
        className={cn(
          "px-3 py-2 text-white text-sm font-semibold text-center bg-gradient-to-r",
          headerColors[processColor] || "from-blue-600 to-blue-500"
        )}
        style={{ minWidth: `${visibleNodes.length * 220}px` }}
      >
        {section.name}
        <span className="ml-2 text-xs font-normal opacity-80">
          {visibleNodes.length} 个节点
        </span>
      </div>

      {/* 节点列组 */}
      <div className="flex flex-1">
        {visibleNodes.map((node, nIdx) => (
          <NodeColumn
            key={node.id}
            node={node}
            sectionName={section.name}
            isLastInSection={nIdx === visibleNodes.length - 1}
            tasks={nodeTasksMap[node.id] || []}
            progressMap={progressMap}
            isSaving={saving[node.id] || false}
            saveStatus={saveStatus[node.id] || null}
            onlyManual={onlyManual}
            onAddTask={() => onAddTask(node.id)}
            onUpdateTask={(taskId, updates) => onUpdateTask(node.id, taskId, updates)}
            onRemoveTask={(taskId) => onRemoveTask(node.id, taskId)}
            onSave={() => onSaveNode(node.id, node.name, section.name)}
            onOpenBatch={() => onOpenBatch(node.id, section.name, node.name)}
            onNavigateToTask={onNavigateToTask}
          />
        ))}
      </div>
    </div>
  );
}

// ─── 节点列 ───
function NodeColumn({
  node,
  sectionName,
  isLastInSection,
  tasks,
  progressMap,
  isSaving,
  saveStatus,
  onlyManual,
  onAddTask,
  onUpdateTask,
  onRemoveTask,
  onSave,
  onOpenBatch,
  onNavigateToTask,
}: {
  node: ProcessNode;
  sectionName: string;
  isLastInSection: boolean;
  tasks: TaskRow[];
  progressMap: ProgressMap;
  isSaving: boolean;
  saveStatus: "success" | "error" | null;
  onlyManual: boolean;
  onAddTask: () => void;
  onUpdateTask: (taskId: string, updates: Partial<TaskRow>) => void;
  onRemoveTask: (taskId: string) => void;
  onSave: () => void;
  onOpenBatch: () => void;
  onNavigateToTask: (taskName: string) => void;
}) {
  const visibleTasks = onlyManual
    ? tasks.filter((t) => t.label === "pure_manual")
    : tasks;

  const manualTaskCount = tasks.filter((t) => t.label === "pure_manual").length;
  const headerTaskCount = onlyManual ? manualTaskCount : tasks.length;

  const hasUnsaved = tasks.some((t) => !t.saved && t.taskName.trim() && t.label);

  return (
    <div
      className={cn(
        "w-[220px] flex-shrink-0 flex flex-col border-r border-gray-100",
        isLastInSection && "border-r border-gray-200"
      )}
      style={{ minHeight: "320px" }}
    >
      {/* 节点标题 */}
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700 truncate">{node.name}</span>
        <span className="text-xs text-gray-400 flex-shrink-0 ml-1">{headerTaskCount}</span>
      </div>

      {/* 保存状态提示 */}
      {saveStatus === "success" && (
        <div className="flex items-center gap-1 px-3 py-1 bg-green-50 text-xs text-green-600 border-b border-green-100">
          <CheckCircle2 size={11} /> 已保存
        </div>
      )}
      {saveStatus === "error" && (
        <div className="flex items-center gap-1 px-3 py-1 bg-red-50 text-xs text-red-600 border-b border-red-100">
          <AlertCircle size={11} /> 保存失败
        </div>
      )}

      {/* 任务卡片区 */}
      <div className="flex-1 p-2 space-y-1.5 overflow-y-auto max-h-[480px]">
        {visibleTasks.length === 0 && !onlyManual && (
          <div
            onClick={onAddTask}
            className="flex flex-col items-center justify-center py-6 text-xs text-gray-400 border-2 border-dashed rounded-lg cursor-pointer hover:border-blue-300 hover:text-blue-400 transition-colors"
          >
            <Plus size={14} className="mb-1" />
            点击添加任务
          </div>
        )}
        {onlyManual && visibleTasks.length === 0 && (
          <div className="text-center py-4 text-xs text-gray-400">暂无纯线下任务</div>
        )}
        {visibleTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            progress={task.saved ? (progressMap[task.taskName] ?? 0) : undefined}
            onUpdate={(updates) => onUpdateTask(task.id, updates)}
            onRemove={() => onRemoveTask(task.id)}
            onNavigate={() => onNavigateToTask(task.taskName)}
          />
        ))}
      </div>

      {/* 底部操作区 */}
      <div className="p-2 border-t border-gray-100 space-y-1">
        {hasUnsaved && (
          <Button size="sm" className="w-full h-7 text-xs" disabled={isSaving} onClick={onSave}>
            <Save size={11} className="mr-1" />
            {isSaving ? "保存中..." : "保存到飞书"}
          </Button>
        )}
        <div className="flex gap-1">
          <button
            onClick={onAddTask}
            className="flex-1 flex items-center justify-center gap-0.5 h-7 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors"
          >
            <Plus size={11} /> 添加
          </button>
          <button
            onClick={onOpenBatch}
            title={`批量导入：${sectionName} > ${node.name}`}
            className="flex-1 flex items-center justify-center gap-0.5 h-7 text-xs text-gray-600 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 transition-colors"
          >
            <ClipboardList size={11} /> 批量导入
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 任务卡片 ───
function TaskCard({
  task,
  progress,
  onUpdate,
  onRemove,
  onNavigate,
}: {
  task: TaskRow;
  progress?: number;
  onUpdate: (updates: Partial<TaskRow>) => void;
  onRemove: () => void;
  onNavigate: () => void;
}) {
  const labelOpt = TASK_LABELS.find((l) => l.value === task.label);
  const isPureManual = task.label === "pure_manual";

  if (task.saved) {
    return (
      <div
        className={cn(
          "rounded-lg border p-2 text-xs transition-all",
          isPureManual ? "border-orange-300 bg-orange-50 shadow-sm" : "border-gray-200 bg-white"
        )}
      >
        <div className="flex items-start justify-between gap-1 mb-1.5">
          <span
            className={cn(
              "leading-tight break-words flex-1",
              isPureManual ? "text-orange-900 font-medium" : "text-gray-800"
            )}
          >
            {task.taskName}
          </span>
          {progress !== undefined && (
            <span
              className={cn(
                "flex-shrink-0 text-xs font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap",
                progress === 4
                  ? "bg-green-100 text-green-700 border border-green-200"
                  : progress > 0
                  ? "bg-blue-100 text-blue-700 border border-blue-200"
                  : "bg-gray-100 text-gray-500 border border-gray-200"
              )}
            >
              {progress}/4
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-1">
          {labelOpt && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium border",
                labelOpt.color, labelOpt.bgColor, labelOpt.borderColor
              )}
            >
              {labelOpt.icon} {labelOpt.label}
            </span>
          )}
        </div>
        {isPureManual && task.saved && (
          <button
            type="button"
            onClick={onNavigate}
            title="打开任务二，继续该日常任务的 Skill 实战"
            className={cn(
              "mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg py-2 px-2",
              "text-xs font-semibold text-white shadow-sm border border-orange-700",
              "bg-orange-600 hover:bg-orange-700 active:bg-orange-800",
              "transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-1"
            )}
          >
            <span>任务二 · Skill 实战</span>
            <ArrowRight size={16} strokeWidth={2.5} className="flex-shrink-0" aria-hidden />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-2 space-y-1.5">
      <input
        autoFocus
        value={task.taskName}
        onChange={(e) => onUpdate({ taskName: e.target.value })}
        placeholder="输入任务名称..."
        className="w-full text-xs px-2 py-1 rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
      />
      <div className="flex flex-wrap gap-1">
        {TASK_LABELS.map((label) => (
          <button
            key={label.value}
            onClick={() =>
              onUpdate({ label: task.label === label.value ? "" : label.value })
            }
            title={label.description}
            className={cn(
              "px-1.5 py-0.5 rounded text-xs font-medium border transition-all",
              task.label === label.value
                ? cn(label.color, label.bgColor, label.borderColor, "ring-1")
                : "text-gray-400 border-gray-200 hover:border-gray-400"
            )}
          >
            {label.icon}
          </button>
        ))}
        <button
          onClick={onRemove}
          className="ml-auto text-gray-300 hover:text-red-500 transition-colors"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}
