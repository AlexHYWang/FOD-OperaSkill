"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BookOpen,
  Check,
  ChevronDown,
  HelpCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  X,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { MultiFileUploader, type UploadedFile } from "@/components/FileUploader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import { E2E_PROCESSES, findE2EProcess } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Tab = "submit" | "review" | "published" | "history";

interface KnowledgeItem {
  id: string;
  title: string;
  team: string;
  process: string;
  section: string;
  node: string;
  scene: string;
  bindScope: string;
  materialType: string;
  source: string;
  fileName: string;
  fileUrl: string;
  version: string;
  status: string;
  isCurrent: boolean;
  rejectReason: string;
  remark: string;
  submitterOpenId?: string;
}

interface SceneOption {
  scene: string;
  process: string;
  section: string;
  node: string;
}

export default function KnowledgePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoggedIn, loading, team, setTeam, profile } = useAuth();
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("review");
  const [showForm, setShowForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // 筛选
  const [filterScene, setFilterScene] = useState("");
  const [filterProcess, setFilterProcess] = useState("");
  const [filterNode, setFilterNode] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => {
    if (!loading && !isLoggedIn) router.push("/");
  }, [loading, isLoggedIn, router]);

  useEffect(() => {
    const scene = searchParams.get("scene")?.trim();
    if (scene) setFilterScene(scene);
    const tab = searchParams.get("tab");
    if (tab === "submit" || tab === "review" || tab === "published" || tab === "history") {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const load = async () => {
    setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (team && profile.role !== "管理员") params.set("team", team);
      const data = await fetch(`/api/knowledge?${params}`, { cache: "no-store" }).then((r) => r.json());
      if (data.success) setItems(data.items || []);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, team]);

  const tabBase = useMemo(() => {
    if (activeTab === "submit") return items.filter((i) => i.status === "已退回" || i.status === "待审核");
    if (activeTab === "review") return items.filter((i) => i.status === "待审核");
    if (activeTab === "published") return items.filter((i) => i.status === "已发布" && i.isCurrent);
    return items.filter((i) => i.status === "已发布" || i.status === "已归档" || i.status === "已退回");
  }, [activeTab, items]);

  const filtered = useMemo(() => {
    return tabBase.filter((i) =>
      (!filterScene || i.scene === filterScene) &&
      (!filterProcess || i.process === filterProcess) &&
      (!filterNode || i.node === filterNode) &&
      (!filterStatus || i.status === filterStatus)
    );
  }, [tabBase, filterScene, filterProcess, filterNode, filterStatus]);

  const sceneOptions = useMemo(
    () => Array.from(new Set(items.map((i) => i.scene).filter(Boolean))).sort(),
    [items]
  );

  const processOptions = useMemo(
    () => Array.from(new Set(tabBase.map((i) => i.process).filter(Boolean))),
    [tabBase]
  );
  const nodeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          tabBase
            .filter((i) => !filterProcess || i.process === filterProcess)
            .map((i) => i.node)
            .filter(Boolean)
        )
      ),
    [tabBase, filterProcess]
  );
  const statusOptions = useMemo(
    () => Array.from(new Set(tabBase.map((i) => i.status).filter(Boolean))),
    [tabBase]
  );

  const action = async (recordId: string, actionName: "publish" | "reject" | "archive") => {
    const rejectReason = actionName === "reject" ? prompt("请输入退回原因") || "" : "";
    const res = await fetch("/api/knowledge", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recordId, action: actionName, rejectReason }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "操作失败");
    }
    load();
  };

  if (loading || !isLoggedIn || !user) {
    return <div className="min-h-screen flex items-center justify-center">加载中...</div>;
  }

  const hasFilter = filterScene || filterProcess || filterNode || filterStatus;

  return (
    <AppLayout team={team} onTeamChange={setTeam} user={user}>
      <div className="p-6 max-w-6xl mx-auto space-y-4">
        <header className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 text-sm font-medium">
              <BookOpen size={18} /> 知识库管理中心
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">提交、审核、发布和版本管理</h1>
            <p className="text-sm text-gray-500 mt-1">
              知识库资料可绑定到节点或节点下的具体场景；发布后成为当前生效版本，归档后仅保留历史记录。
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={load} disabled={refreshing}>
              <RefreshCw size={14} className={cn("mr-1", refreshing && "animate-spin")} /> 刷新
            </Button>
            <Button onClick={() => setShowForm(true)} className="bg-indigo-600 hover:bg-indigo-700">
              <Plus size={14} className="mr-1" /> 新增条目
            </Button>
          </div>
        </header>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Summary title="待审核" value={items.filter((i) => i.status === "待审核").length} tone="amber" />
          <Summary title="已发布" value={items.filter((i) => i.status === "已发布" && i.isCurrent).length} tone="emerald" />
          <Summary title="已退回" value={items.filter((i) => i.status === "已退回").length} tone="rose" />
          <Summary title="总条目" value={items.length} tone="blue" />
        </section>

        <section className="rounded-2xl bg-white border overflow-hidden">
          {/* Tab */}
          <div className="flex border-b">
            {[
              ["submit", "提交", "新增与退回补充"],
              ["review", "审核", "主管/管理员审核"],
              ["published", "发布", "当前生效版本"],
              ["history", "版本管理", "历史与归档"],
            ].map(([id, label, desc]) => (
              <button
                key={id}
                onClick={() => { setActiveTab(id as Tab); setFilterProcess(""); setFilterNode(""); setFilterStatus(""); }}
                className={cn(
                  "flex-1 px-3 py-2.5 text-sm border-b-2",
                  activeTab === id ? "border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold" : "border-transparent text-gray-500 hover:bg-gray-50"
                )}
              >
                <div>{label}</div>
                <div className="text-[10px] text-gray-400">{desc}</div>
              </button>
            ))}
          </div>

          {/* 筛选栏（有数据即显示，便于 URL 带入场景后切换 Tab） */}
          {items.length > 0 && (
            <div className="px-4 py-2 border-b bg-gray-50 flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">筛选：</span>
              <SelectFilter
                label="所有场景"
                value={filterScene}
                options={sceneOptions}
                onChange={setFilterScene}
              />
              <SelectFilter
                label="所有流程"
                value={filterProcess}
                options={processOptions}
                onChange={(v) => { setFilterProcess(v); setFilterNode(""); }}
              />
              <SelectFilter
                label="所有节点"
                value={filterNode}
                options={nodeOptions}
                onChange={setFilterNode}
                disabled={!filterProcess}
              />
              <SelectFilter
                label="所有状态"
                value={filterStatus}
                options={statusOptions}
                onChange={setFilterStatus}
              />
              {hasFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterScene("");
                    setFilterProcess("");
                    setFilterNode("");
                    setFilterStatus("");
                  }}
                  className="text-xs text-gray-400 hover:text-rose-500 px-2 py-0.5 rounded hover:bg-rose-50"
                >
                  清除
                </button>
              )}
              <span className="ml-auto text-xs text-gray-400">{filtered.length} 条</span>
            </div>
          )}

          <div className="p-4 space-y-2">
            {filtered.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">暂无条目</div>
            ) : (
              filtered.map((item) => (
                <div key={item.id} className="rounded-xl border p-3 bg-white">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={item.status} />
                    {item.isCurrent && <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[11px]">当前版本</span>}
                    <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[11px]">{item.materialType}</span>
                    {item.bindScope && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[11px]">绑定：{item.bindScope}</span>
                    )}
                    <div className="font-semibold text-sm flex-1 truncate min-w-0">{item.title}</div>
                    <div className="text-xs text-gray-400 flex-shrink-0">{item.version}</div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-500">
                    <span>{item.team}</span>
                    {item.process && <span>{item.process}</span>}
                    {item.node && <span>节点：{item.node}</span>}
                    {item.scene && <span>场景：{item.scene}</span>}
                    {item.fileUrl && <a className="text-blue-600 hover:underline" href={item.fileUrl} target="_blank" rel="noreferrer">查看资料</a>}
                  </div>
                  {item.rejectReason && (
                    <div className="mt-2 text-xs text-rose-600 bg-rose-50 rounded p-2">退回原因：{item.rejectReason}</div>
                  )}
                  <div className="mt-3 flex justify-end gap-2 flex-wrap">
                    {activeTab === "review" && (
                      <>
                        <Tooltip text="标记为历史版本，仅保留记录供查阅">
                          <Button size="sm" variant="outline" onClick={() => action(item.id, "reject")}>
                            <RotateCcw size={13} className="mr-1" /> 退回
                          </Button>
                        </Tooltip>
                        <Tooltip text="资料成为当前生效版本（测试包将下载此版本）">
                          <Button size="sm" onClick={() => action(item.id, "publish")} className="bg-emerald-600 hover:bg-emerald-700">
                            <Check size={13} className="mr-1" /> 发布
                          </Button>
                        </Tooltip>
                      </>
                    )}
                    {activeTab === "history" && item.status !== "已归档" && (
                      <Tooltip text="归档后该版本不再生效，仅供历史查阅">
                        <Button size="sm" variant="outline" onClick={() => action(item.id, "archive")}>归档</Button>
                      </Tooltip>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {showForm && (
          <KnowledgeForm
            defaultTeam={team || profile.team}
            submitterOpenId={user?.open_id || ""}
            onClose={() => setShowForm(false)}
            onDone={() => { setShowForm(false); load(); }}
          />
        )}
      </div>
    </AppLayout>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "已发布" ? "bg-emerald-50 text-emerald-700" :
    status === "待审核" ? "bg-amber-50 text-amber-700" :
    status === "已退回" ? "bg-rose-50 text-rose-700" :
    "bg-gray-100 text-gray-600";
  return <span className={cn("px-1.5 py-0.5 rounded text-[11px]", cls)}>{status}</span>;
}

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="relative group inline-flex items-center gap-1">
      {children}
      <HelpCircle size={13} className="text-gray-300 group-hover:text-gray-500 cursor-help" />
      <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover:block z-50 bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg max-w-xs whitespace-normal leading-relaxed">
        {text}
      </div>
    </div>
  );
}

function SelectFilter({
  label, value, options, onChange, disabled,
}: {
  label: string; value: string; options: string[]; onChange: (v: string) => void; disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          "appearance-none rounded border px-2 py-1 text-xs pr-6 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300",
          disabled ? "bg-gray-50 text-gray-400 cursor-not-allowed" : "text-gray-700 hover:border-indigo-400 cursor-pointer"
        )}
      >
        <option value="">{label}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  );
}

function Summary({ title, value, tone }: { title: string; value: number; tone: "amber" | "emerald" | "rose" | "blue" }) {
  const cls = {
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    rose: "bg-rose-50 text-rose-700 border-rose-100",
    blue: "bg-blue-50 text-blue-700 border-blue-100",
  }[tone];
  return (
    <div className={cn("rounded-xl border p-3", cls)}>
      <div className="text-xs opacity-75">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

const FORM_STEPS = ["基本信息", "流程定位", "文件上传"];

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-0 mb-5">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-none">
          <div className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all",
            i < current ? "bg-indigo-600 text-white" :
            i === current ? "bg-indigo-100 text-indigo-700 border-2 border-indigo-400" :
            "bg-gray-100 text-gray-400"
          )}>
            {i < current ? <Check size={14} /> : i + 1}
          </div>
          <div className="text-[10px] ml-1 font-medium mr-1 hidden sm:block"
            style={{ color: i === current ? "#4f46e5" : i < current ? "#4f46e5" : "#9ca3af" }}>
            {FORM_STEPS[i]}
          </div>
          {i < total - 1 && (
            <div className={cn("flex-1 h-0.5 mx-1", i < current ? "bg-indigo-400" : "bg-gray-200")} />
          )}
        </div>
      ))}
    </div>
  );
}

function KnowledgeForm({
  defaultTeam,
  submitterOpenId,
  onClose,
  onDone,
}: {
  defaultTeam: string;
  submitterOpenId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);

  // Step 1: 基本信息
  const [title, setTitle] = useState("");
  const [materialType, setMaterialType] = useState("规则");

  // Step 2: 流程定位
  const [team] = useState(defaultTeam);
  const [process, setProcess] = useState("");
  const [section, setSection] = useState("");
  const [node, setNode] = useState("");
  const [bindScope, setBindScope] = useState<"节点" | "场景">("节点");
  const [scene, setScene] = useState("");

  // Step 3: 文件上传
  const [fileUrl, setFileUrl] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);

  const [sceneOptions, setSceneOptions] = useState<SceneOption[]>([]);
  useEffect(() => {
    if (!team || !node) { setSceneOptions([]); return; }
    fetch(`/api/bitable/records?table=1&team=${encodeURIComponent(team)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) return;
        const opts: SceneOption[] = [];
        const seen = new Set<string>();
        for (const rec of d.records || []) {
          const recNode = String(rec.fields["流程节点"] || "");
          const sceneName = String(rec.fields["场景名称"] || rec.fields["任务名称"] || "");
          if (recNode === node && sceneName && !seen.has(sceneName)) {
            seen.add(sceneName);
            opts.push({
              scene: sceneName,
              process: String(rec.fields["端到端流程"] || ""),
              section: String(rec.fields["流程环节"] || ""),
              node: recNode,
            });
          }
        }
        setSceneOptions(opts);
      })
      .catch(() => setSceneOptions([]));
  }, [team, node]);

  const proc = findE2EProcess(process);
  const sec = proc?.sections.find((s) => s.name === section);

  const step1Valid = !!title.trim();
  const step2Valid = !!process;

  const submit = async () => {
    if (!title || !team || !process) return;
    setSaving(true);
    try {
      const payloads = files.length > 0 ? files : [{ file_name: fileUrl, url: fileUrl, file_token: "" }];
      for (const file of payloads) {
        await fetch("/api/knowledge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            team,
            process,
            section,
            node,
            scene: bindScope === "场景" ? scene : "",
            bindScope,
            materialType,
            source: file.file_token ? "本地文件" : "飞书云文档",
            fileName: file.file_name,
            fileUrl: file.url,
            fileToken: file.file_token,
            submitterOpenId,
            remark,
          }),
        });
      }
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="px-5 py-3 border-b flex items-center flex-shrink-0">
          <BookOpen size={16} className="text-indigo-600 mr-2" />
          <div className="font-semibold">新增知识库条目</div>
          <div className="flex-1" />
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={16} /></button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto">
          <StepIndicator current={step} total={3} />

          {/* Step 0: 基本信息 */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-gray-600 font-medium">条目标题 *</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例如：应付账款三方对账规则"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-600 font-medium">资料类型</label>
                <div className="grid grid-cols-3 gap-2">
                  {["规则", "字典", "模版"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setMaterialType(t)}
                      className={cn(
                        "py-2 rounded-lg border text-sm font-medium transition-all",
                        materialType === t
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white text-gray-700 border-gray-200 hover:border-indigo-300"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-lg bg-gray-50 border px-3 py-2 text-sm text-gray-600">
                <span className="text-xs text-gray-400">所属团队：</span>{team || "（请先选择团队）"}
              </div>
            </div>
          )}

          {/* Step 1: 流程定位 */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-gray-600 font-medium">E2E 流程 *</label>
                <select
                  value={process}
                  onChange={(e) => { setProcess(e.target.value); setSection(""); setNode(""); setScene(""); }}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                >
                  <option value="">选择端到端流程</option>
                  {E2E_PROCESSES.map((p) => <option key={p.id} value={p.shortName}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-gray-600 font-medium">流程环节</label>
                  <select
                    value={section}
                    disabled={!proc}
                    onChange={(e) => { setSection(e.target.value); setNode(""); setScene(""); }}
                    className="w-full rounded-lg border px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  >
                    <option value="">全部环节</option>
                    {proc?.sections.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-600 font-medium">流程节点</label>
                  <select
                    value={node}
                    disabled={!sec}
                    onChange={(e) => { setNode(e.target.value); setScene(""); }}
                    className="w-full rounded-lg border px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  >
                    <option value="">全部节点</option>
                    {sec?.nodes.map((n) => <option key={n.id} value={n.name}>{n.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-600 font-medium">绑定范围</label>
                <div className="flex gap-3">
                  {(["节点", "场景"] as const).map((scope) => (
                    <label key={scope} className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all flex-1",
                      bindScope === scope ? "border-indigo-400 bg-indigo-50" : "border-gray-200 hover:border-indigo-200"
                    )}>
                      <input
                        type="radio"
                        name="bindScope"
                        value={scope}
                        checked={bindScope === scope}
                        onChange={() => setBindScope(scope)}
                        className="accent-indigo-600"
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-700">{scope}</div>
                        <div className="text-[10px] text-gray-400">
                          {scope === "节点" ? "覆盖节点下所有场景" : "仅绑定到特定场景"}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              {bindScope === "场景" && (
                <div className="space-y-1">
                  <label className="text-xs text-gray-600 font-medium">关联场景</label>
                  <select
                    value={scene}
                    onChange={(e) => setScene(e.target.value)}
                    disabled={!node}
                    className="w-full rounded-lg border px-3 py-2 text-sm disabled:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  >
                    <option value="">请先选择节点</option>
                    {sceneOptions.map((o) => <option key={o.scene} value={o.scene}>{o.scene}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Step 2: 文件上传 */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-gray-600 font-medium">飞书云文档链接（可选）</label>
                <input
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
              </div>
              <MultiFileUploader label="本地文件（可多选）" uploaded={files} onUpload={setFiles} />
              <div className="space-y-1">
                <label className="text-xs text-gray-600 font-medium">备注</label>
                <textarea
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="补充说明..."
                  rows={3}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
              </div>
              {/* 提交前摘要 */}
              <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-700 space-y-1">
                <div className="font-semibold text-sm mb-1">确认信息</div>
                <div><span className="text-indigo-400">标题：</span>{title}</div>
                <div><span className="text-indigo-400">类型：</span>{materialType}</div>
                <div><span className="text-indigo-400">流程定位：</span>{process}{section ? ` · ${section}` : ""}{node ? ` · ${node}` : ""}</div>
                <div><span className="text-indigo-400">绑定范围：</span>{bindScope}{bindScope === "场景" && scene ? ` · ${scene}` : ""}</div>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t bg-gray-50 flex items-center gap-2 flex-shrink-0">
          <div className="flex-1">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                ← 上一步
              </Button>
            )}
          </div>
          {step < 2 ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 0 ? !step1Valid : step === 1 ? !step2Valid : false}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              下一步 →
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>取消</Button>
              <Button
                onClick={submit}
                disabled={!title || !team || !process || saving || (files.length === 0 && !fileUrl)}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {saving ? "提交中..." : <><Send size={14} className="mr-1" /> 提交审核</>}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
