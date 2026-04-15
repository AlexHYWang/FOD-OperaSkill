"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Save,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  PTP_SECTIONS,
  TASK_LABELS,
  type TaskLabel,
} from "@/lib/constants";

interface TaskRow {
  id: string;
  taskName: string;
  label: TaskLabel | "";
  saved: boolean;
  recordId?: string;
}

interface NodeData {
  nodeId: string;
  nodeName: string;
  tasks: TaskRow[];
}

interface SectionData {
  sectionId: string;
  expanded: boolean;
  nodes: NodeData[];
}

interface NodeMappingGridProps {
  team: string;
  userName: string;
}

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export function NodeMappingGrid({ team, userName }: NodeMappingGridProps) {
  const [sections, setSections] = useState<SectionData[]>(() =>
    PTP_SECTIONS.map((s) => ({
      sectionId: s.id,
      expanded: true,
      nodes: s.nodes.map((n) => ({
        nodeId: n.id,
        nodeName: n.name,
        tasks: [],
      })),
    }))
  );
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saveStatus, setSaveStatus] = useState<
    Record<string, "success" | "error" | null>
  >({});
  const [loading, setLoading] = useState(false);

  // 加载团队已有记录
  const loadTeamRecords = useCallback(async () => {
    if (!team) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/bitable/records?table=1&team=${encodeURIComponent(team)}`
      );
      const data = await res.json();
      if (!data.success) return;

      // 按节点归类已有记录
      const recordsByNode: Record<string, TaskRow[]> = {};
      for (const record of data.records) {
        const nodeName = record.fields["流程节点"] as string;
        const taskName = record.fields["任务名称"] as string;
        const labelRaw = record.fields["标签"] as string | undefined;

        // 标签映射
        let label: TaskLabel | "" = "";
        if (labelRaw?.includes("纯手工")) label = "pure_manual";
        else if (labelRaw?.includes("跨系统")) label = "cross_system";
        else if (labelRaw?.includes("不建议")) label = "not_recommended";

        if (!recordsByNode[nodeName]) recordsByNode[nodeName] = [];
        recordsByNode[nodeName].push({
          id: generateId(),
          taskName: taskName || "",
          label,
          saved: true,
          recordId: record.id,
        });
      }

      setSections((prev) =>
        prev.map((sec) => ({
          ...sec,
          nodes: sec.nodes.map((node) => ({
            ...node,
            tasks:
              recordsByNode[node.nodeName]?.length > 0
                ? recordsByNode[node.nodeName]
                : [],
          })),
        }))
      );
    } catch (err) {
      console.error("加载团队记录失败:", err);
    } finally {
      setLoading(false);
    }
  }, [team]);

  useEffect(() => {
    loadTeamRecords();
  }, [loadTeamRecords]);

  const toggleSection = (sectionId: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.sectionId === sectionId ? { ...s, expanded: !s.expanded } : s
      )
    );
  };

  const addTask = (sectionId: string, nodeId: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.sectionId === sectionId
          ? {
              ...s,
              nodes: s.nodes.map((n) =>
                n.nodeId === nodeId
                  ? {
                      ...n,
                      tasks: [
                        ...n.tasks,
                        {
                          id: generateId(),
                          taskName: "",
                          label: "" as const,
                          saved: false,
                        },
                      ],
                    }
                  : n
              ),
            }
          : s
      )
    );
  };

  const updateTask = (
    sectionId: string,
    nodeId: string,
    taskId: string,
    updates: Partial<TaskRow>
  ) => {
    setSections((prev) =>
      prev.map((s) =>
        s.sectionId === sectionId
          ? {
              ...s,
              nodes: s.nodes.map((n) =>
                n.nodeId === nodeId
                  ? {
                      ...n,
                      tasks: n.tasks.map((t) =>
                        t.id === taskId
                          ? { ...t, ...updates, saved: false }
                          : t
                      ),
                    }
                  : n
              ),
            }
          : s
      )
    );
  };

  const removeTask = (sectionId: string, nodeId: string, taskId: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.sectionId === sectionId
          ? {
              ...s,
              nodes: s.nodes.map((n) =>
                n.nodeId === nodeId
                  ? { ...n, tasks: n.tasks.filter((t) => t.id !== taskId) }
                  : n
              ),
            }
          : s
      )
    );
  };

  const saveNodeTasks = async (
    sectionId: string,
    nodeId: string,
    nodeName: string,
    sectionName: string
  ) => {
    const key = `${sectionId}-${nodeId}`;
    const section = sections.find((s) => s.sectionId === sectionId);
    const node = section?.nodes.find((n) => n.nodeId === nodeId);
    if (!node) return;

    const unsavedTasks = node.tasks.filter(
      (t) => !t.saved && t.taskName.trim() && t.label
    );
    if (unsavedTasks.length === 0) return;

    setSaving((prev) => ({ ...prev, [key]: true }));
    setSaveStatus((prev) => ({ ...prev, [key]: null }));

    try {
      for (const task of unsavedTasks) {
        const labelOption = TASK_LABELS.find((l) => l.value === task.label);
        const labelText = labelOption
          ? `${labelOption.icon} ${labelOption.label}`
          : "";

        await fetch("/api/bitable/records", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            table: "1",
            fields: {
              团队名称: team,
              流程环节: sectionName,
              流程节点: nodeName,
              任务名称: task.taskName.trim(),
              标签: labelText,
            },
          }),
        });
      }

      // 标记为已保存
      setSections((prev) =>
        prev.map((s) =>
          s.sectionId === sectionId
            ? {
                ...s,
                nodes: s.nodes.map((n) =>
                  n.nodeId === nodeId
                    ? {
                        ...n,
                        tasks: n.tasks.map((t) =>
                          unsavedTasks.find((u) => u.id === t.id)
                            ? { ...t, saved: true }
                            : t
                        ),
                      }
                    : n
                ),
              }
            : s
        )
      );

      setSaveStatus((prev) => ({ ...prev, [key]: "success" }));
      setTimeout(
        () => setSaveStatus((prev) => ({ ...prev, [key]: null })),
        3000
      );
    } catch (err) {
      console.error("保存失败:", err);
      setSaveStatus((prev) => ({ ...prev, [key]: "error" }));
    } finally {
      setSaving((prev) => ({ ...prev, [key]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-3" />
        正在加载 {team} 的历史数据...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 图例说明 */}
      <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg border">
        <span className="text-xs text-gray-500 self-center mr-1">图例：</span>
        {TASK_LABELS.map((l) => (
          <span
            key={l.value}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border",
              l.color,
              l.bgColor,
              l.borderColor
            )}
          >
            {l.icon} {l.label}
            <span className="hidden sm:inline text-opacity-70">
              — {l.description}
            </span>
          </span>
        ))}
      </div>

      {/* 流程环节列表 */}
      {PTP_SECTIONS.map((section, sIdx) => {
        const sectionData = sections[sIdx];
        return (
          <div key={section.id} className="border rounded-xl overflow-hidden">
            {/* 环节标题 */}
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-700 hover:to-blue-600 transition-colors"
            >
              <span className="font-semibold flex items-center gap-2">
                <span className="text-blue-200 text-sm">
                  {String(sIdx + 1).padStart(2, "0")}
                </span>
                {section.name}
                <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">
                  {section.nodes.length} 个节点
                </span>
              </span>
              {sectionData?.expanded ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </button>

            {/* 节点列表 */}
            {sectionData?.expanded && (
              <div className="divide-y">
                {section.nodes.map((node) => {
                  const nodeData = sectionData.nodes.find(
                    (n) => n.nodeId === node.id
                  );
                  const key = `${section.id}-${node.id}`;
                  const isSaving = saving[key];
                  const status = saveStatus[key];
                  const hasUnsaved =
                    nodeData?.tasks.some(
                      (t) => !t.saved && t.taskName.trim() && t.label
                    ) ?? false;

                  return (
                    <div key={node.id} className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                            {node.name}
                          </span>
                          <span className="text-xs text-gray-400">
                            {nodeData?.tasks.length || 0} 个任务
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {status === "success" && (
                            <span className="flex items-center gap-1 text-xs text-green-600">
                              <CheckCircle2 size={14} /> 已保存
                            </span>
                          )}
                          {status === "error" && (
                            <span className="flex items-center gap-1 text-xs text-red-600">
                              <AlertCircle size={14} /> 保存失败
                            </span>
                          )}
                          {hasUnsaved && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-blue-400 text-blue-600 hover:bg-blue-50"
                              disabled={isSaving}
                              onClick={() =>
                                saveNodeTasks(
                                  section.id,
                                  node.id,
                                  node.name,
                                  section.name
                                )
                              }
                            >
                              <Save size={12} className="mr-1" />
                              {isSaving ? "保存中..." : "保存到飞书"}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-blue-600 hover:bg-blue-50"
                            onClick={() => addTask(section.id, node.id)}
                          >
                            <Plus size={12} className="mr-1" />
                            添加任务
                          </Button>
                        </div>
                      </div>

                      {/* 任务列表 */}
                      {nodeData?.tasks.length === 0 ? (
                        <div
                          className="text-center py-4 text-xs text-gray-400 border-2 border-dashed rounded-lg cursor-pointer hover:border-blue-300 hover:text-blue-400 transition-colors"
                          onClick={() => addTask(section.id, node.id)}
                        >
                          <Plus size={16} className="mx-auto mb-1" />
                          点击添加该节点下的日常任务
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {nodeData?.tasks.map((task) => (
                            <TaskRow
                              key={task.id}
                              task={task}
                              onUpdate={(updates) =>
                                updateTask(
                                  section.id,
                                  node.id,
                                  task.id,
                                  updates
                                )
                              }
                              onRemove={() =>
                                removeTask(section.id, node.id, task.id)
                              }
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <p className="text-xs text-gray-400 text-center pt-2">
        提交者：{userName} · 团队：{team}
      </p>
    </div>
  );
}

// ─── 单行任务组件 ───
interface TaskRowProps {
  task: TaskRow;
  onUpdate: (updates: Partial<TaskRow>) => void;
  onRemove: () => void;
}

function TaskRow({ task, onUpdate, onRemove }: TaskRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 p-2 rounded-lg border transition-colors",
        task.saved
          ? "bg-green-50 border-green-200"
          : "bg-white border-gray-200 hover:border-blue-300"
      )}
    >
      {/* 任务名称输入 */}
      <input
        value={task.taskName}
        onChange={(e) => onUpdate({ taskName: e.target.value })}
        placeholder="输入日常任务名称..."
        disabled={task.saved}
        className={cn(
          "flex-1 text-sm px-2 py-1 rounded border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-transparent",
          task.saved && "text-gray-600 cursor-default"
        )}
      />

      {/* 标签选择 */}
      <div className="flex items-center gap-1">
        {TASK_LABELS.map((label) => (
          <button
            key={label.value}
            disabled={task.saved}
            onClick={() =>
              !task.saved &&
              onUpdate({ label: task.label === label.value ? "" : label.value })
            }
            title={label.description}
            className={cn(
              "px-2 py-1 rounded text-xs font-medium border transition-all",
              task.label === label.value
                ? cn(label.color, label.bgColor, label.borderColor, "ring-1")
                : "text-gray-400 border-gray-200 hover:border-gray-400",
              task.saved && "cursor-default"
            )}
          >
            {label.icon} {label.label}
          </button>
        ))}
      </div>

      {/* 状态/删除 */}
      {task.saved ? (
        <span className="text-xs text-green-600 flex items-center gap-1 flex-shrink-0">
          <CheckCircle2 size={12} /> 已同步
        </span>
      ) : (
        <button
          onClick={onRemove}
          className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
          title="删除此任务"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}
