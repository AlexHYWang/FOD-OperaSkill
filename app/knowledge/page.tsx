"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Check, Plus, RefreshCw, RotateCcw, Send, X } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { MultiFileUploader, type UploadedFile } from "@/components/FileUploader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import { E2E_PROCESSES } from "@/lib/constants";
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
  materialType: string;
  source: string;
  fileName: string;
  fileUrl: string;
  version: string;
  status: string;
  isCurrent: boolean;
  rejectReason: string;
  remark: string;
}

export default function KnowledgePage() {
  const router = useRouter();
  const { user, isLoggedIn, loading, team, setTeam, profile } = useAuth();
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("review");
  const [showForm, setShowForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!loading && !isLoggedIn) router.push("/");
  }, [loading, isLoggedIn, router]);

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

  const filtered = useMemo(() => {
    if (activeTab === "submit") return items.filter((i) => i.status === "已退回" || i.status === "待审核");
    if (activeTab === "review") return items.filter((i) => i.status === "待审核");
    if (activeTab === "published") return items.filter((i) => i.status === "已发布" && i.isCurrent);
    return items.filter((i) => i.status === "已发布" || i.status === "已归档" || i.status === "已退回");
  }, [activeTab, items]);

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

  return (
    <AppLayout team={team} onTeamChange={setTeam} user={user}>
      <div className="p-6 max-w-6xl mx-auto space-y-4">
        <header className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 text-sm font-medium">
              <BookOpen size={18} /> 知识库管理中心
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">提交、审核、发布和版本管理</h1>
            <p className="text-sm text-gray-500 mt-1">知识库资料按场景绑定，并标记为规则、字典或模版。</p>
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
          <div className="flex border-b">
            {[
              ["submit", "提交", "新增与退回补充"],
              ["review", "审核", "主管/管理员审核"],
              ["published", "发布", "当前生效版本"],
              ["history", "版本管理", "历史与归档"],
            ].map(([id, label, desc]) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as Tab)}
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
          <div className="p-4 space-y-2">
            {filtered.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">暂无条目</div>
            ) : (
              filtered.map((item) => (
                <div key={item.id} className="rounded-xl border p-3 bg-white">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[11px]">{item.status}</span>
                    {item.isCurrent && <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[11px]">当前版本</span>}
                    <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[11px]">{item.materialType}</span>
                    <div className="font-semibold text-sm flex-1 truncate">{item.title}</div>
                    <div className="text-xs text-gray-400">{item.version}</div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-500">
                    <span>{item.team}</span>
                    <span>{item.process}</span>
                    {item.scene && <span>场景：{item.scene}</span>}
                    {item.fileUrl && <a className="text-blue-600" href={item.fileUrl} target="_blank">查看资料</a>}
                  </div>
                  {item.rejectReason && <div className="mt-2 text-xs text-rose-600 bg-rose-50 rounded p-2">退回原因：{item.rejectReason}</div>}
                  <div className="mt-3 flex justify-end gap-2">
                    {activeTab === "review" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => action(item.id, "reject")}>
                          <RotateCcw size={13} className="mr-1" /> 退回
                        </Button>
                        <Button size="sm" onClick={() => action(item.id, "publish")} className="bg-emerald-600 hover:bg-emerald-700">
                          <Check size={13} className="mr-1" /> 发布
                        </Button>
                      </>
                    )}
                    {activeTab === "history" && item.status !== "已归档" && (
                      <Button size="sm" variant="outline" onClick={() => action(item.id, "archive")}>归档</Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {showForm && <KnowledgeForm defaultTeam={team || profile.team} onClose={() => setShowForm(false)} onDone={() => { setShowForm(false); load(); }} />}
      </div>
    </AppLayout>
  );
}

function Summary({ title, value, tone }: { title: string; value: number; tone: "amber" | "emerald" | "rose" | "blue" }) {
  const cls = {
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    rose: "bg-rose-50 text-rose-700 border-rose-100",
    blue: "bg-blue-50 text-blue-700 border-blue-100",
  }[tone];
  return <div className={cn("rounded-xl border p-3", cls)}><div className="text-xs opacity-75">{title}</div><div className="text-2xl font-bold">{value}</div></div>;
}

function KnowledgeForm({ defaultTeam, onClose, onDone }: { defaultTeam: string; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [team, setTeam] = useState(defaultTeam);
  const [process, setProcess] = useState("");
  const [section, setSection] = useState("");
  const [node, setNode] = useState("");
  const [scene, setScene] = useState("");
  const [materialType, setMaterialType] = useState("规则");
  const [fileUrl, setFileUrl] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);

  const proc = E2E_PROCESSES.find((p) => p.name === process);
  const sec = proc?.sections.find((s) => s.name === section);

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
            scene,
            materialType,
            source: file.file_token ? "本地文件" : "飞书云文档",
            fileName: file.file_name,
            fileUrl: file.url,
            fileToken: file.file_token,
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-auto">
        <div className="px-5 py-3 border-b flex items-center">
          <div className="font-semibold">新增知识库条目</div>
          <div className="flex-1" />
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="条目标题 *" className="w-full rounded border px-3 py-2 text-sm" />
          <input value={team} onChange={(e) => setTeam(e.target.value)} placeholder="所属团队 *" className="w-full rounded border px-3 py-2 text-sm" />
          <div className="grid md:grid-cols-2 gap-2">
            <select value={process} onChange={(e) => { setProcess(e.target.value); setSection(""); setNode(""); }} className="rounded border px-3 py-2 text-sm">
              <option value="">E2E 流程 *</option>
              {E2E_PROCESSES.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
            <select value={section} disabled={!proc} onChange={(e) => { setSection(e.target.value); setNode(""); }} className="rounded border px-3 py-2 text-sm disabled:bg-gray-100">
              <option value="">环节 · 任选</option>
              {proc?.sections.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <select value={node} disabled={!sec} onChange={(e) => setNode(e.target.value)} className="rounded border px-3 py-2 text-sm disabled:bg-gray-100">
              <option value="">节点 · 任选</option>
              {sec?.nodes.map((n) => <option key={n.id} value={n.name}>{n.name}</option>)}
            </select>
            <input value={scene} onChange={(e) => setScene(e.target.value)} placeholder="关联场景名 · 任选" className="rounded border px-3 py-2 text-sm" />
          </div>
          <select value={materialType} onChange={(e) => setMaterialType(e.target.value)} className="rounded border px-3 py-2 text-sm">
            <option value="规则">规则</option>
            <option value="字典">字典</option>
            <option value="模版">模版</option>
          </select>
          <input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="飞书云文档链接（可选）" className="w-full rounded border px-3 py-2 text-sm" />
          <MultiFileUploader label="本地文件（可多选）" uploaded={files} onUpload={setFiles} />
          <textarea value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="备注" rows={3} className="w-full rounded border px-3 py-2 text-sm" />
        </div>
        <div className="px-5 py-3 border-t bg-gray-50 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={submit} disabled={!title || !team || !process || saving} className="bg-indigo-600 hover:bg-indigo-700">
            <Send size={14} className="mr-1" /> 提交审核
          </Button>
        </div>
      </div>
    </div>
  );
}
