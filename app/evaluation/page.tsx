"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, FilePlus2, FlaskConical, Plus, RefreshCw, X } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { MultiFileUploader, type UploadedFile } from "@/components/FileUploader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import { E2E_PROCESSES } from "@/lib/constants";

interface Dataset {
  id: string;
  name: string;
  team: string;
  scene: string;
  coverage: string;
  process: string;
  section: string;
  node: string;
  status: string;
}

export default function EvaluationPage() {
  const router = useRouter();
  const { user, isLoggedIn, loading, team, setTeam, profile } = useAuth();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [materials, setMaterials] = useState<Record<string, number>>({});
  const [showDatasetForm, setShowDatasetForm] = useState(false);
  const [showMaterialForm, setShowMaterialForm] = useState<Dataset | null>(null);
  const [showReminder, setShowReminder] = useState(false);

  useEffect(() => {
    if (!loading && !isLoggedIn) router.push("/");
  }, [loading, isLoggedIn, router]);

  const load = async () => {
    const params = new URLSearchParams();
    if (team) params.set("team", team);
    const data = await fetch(`/api/evaluation/datasets?${params}`, { cache: "no-store" }).then((r) => r.json());
    if (data.success) {
      setDatasets(data.items || []);
      const counts: Record<string, number> = {};
      await Promise.all(
        (data.items || []).map(async (d: Dataset) => {
          const m = await fetch(`/api/evaluation/materials?datasetId=${encodeURIComponent(d.id)}`).then((r) => r.json());
          counts[d.id] = m.items?.length || 0;
        })
      );
      setMaterials(counts);
    }
  };

  useEffect(() => {
    if (isLoggedIn) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, team]);

  if (loading || !isLoggedIn || !user) return <div className="min-h-screen flex items-center justify-center">加载中...</div>;

  return (
    <AppLayout team={team} onTeamChange={setTeam} user={user}>
      <div className="p-6 max-w-6xl mx-auto space-y-4">
        <header className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-teal-600 text-sm font-medium">
              <FlaskConical size={18} /> 评测集上传
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">A样本、人工C结果和覆盖范围管理</h1>
            <p className="text-sm text-gray-500 mt-1">每条评测集组合包含输入A样本和人工输出C结果两个资料板块。</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={load}><RefreshCw size={14} className="mr-1" /> 刷新</Button>
            <Button variant="outline" onClick={() => setShowReminder(true)}><Bell size={14} className="mr-1" /> 评测集催办</Button>
            <Button onClick={() => setShowDatasetForm(true)} className="bg-teal-600 hover:bg-teal-700"><Plus size={14} className="mr-1" /> 新增评测集</Button>
          </div>
        </header>

        <section className="rounded-2xl bg-white border overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b text-sm font-semibold">评测集组合</div>
          <div className="p-4 space-y-3">
            {datasets.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">暂无评测集</div>
            ) : (
              datasets.map((d) => (
                <div key={d.id} className="rounded-xl border p-3">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 text-[11px]">{d.status || "可用"}</span>
                    <div className="font-semibold text-sm flex-1">{d.name}</div>
                    <span className="text-xs text-gray-400">{materials[d.id] || 0} 个资料</span>
                  </div>
                  <div className="mt-2 text-xs text-gray-500 flex flex-wrap gap-2">
                    <span>{d.team}</span>
                    <span>场景：{d.scene}</span>
                    <span>{d.process}</span>
                    {d.coverage && <span className="text-gray-700">覆盖范围：{d.coverage}</span>}
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setShowMaterialForm(d)}>
                      <FilePlus2 size={13} className="mr-1" /> 追加 A/C 资料
                    </Button>
                    <Button size="sm" onClick={() => router.push(`/evaluation/test?datasetId=${encodeURIComponent(d.id)}&scene=${encodeURIComponent(d.scene)}`)}>
                      去线下测试
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {showDatasetForm && <DatasetForm defaultTeam={team || profile.team} onClose={() => setShowDatasetForm(false)} onDone={() => { setShowDatasetForm(false); load(); }} />}
        {showMaterialForm && <MaterialForm dataset={showMaterialForm} onClose={() => setShowMaterialForm(null)} onDone={() => { setShowMaterialForm(null); load(); }} />}
        {showReminder && <ReminderForm defaultTeam={team || profile.team} onClose={() => setShowReminder(false)} />}
      </div>
    </AppLayout>
  );
}

function DatasetForm({ defaultTeam, onClose, onDone }: { defaultTeam: string; onClose: () => void; onDone: () => void }) {
  const [team, setTeam] = useState(defaultTeam);
  const [name, setName] = useState("");
  const [scene, setScene] = useState("");
  const [coverage, setCoverage] = useState("");
  const [process, setProcess] = useState("");
  const [section, setSection] = useState("");
  const [node, setNode] = useState("");
  const [remark, setRemark] = useState("");
  const proc = E2E_PROCESSES.find((p) => p.name === process);
  const sec = proc?.sections.find((s) => s.name === section);
  const submit = async () => {
    await fetch("/api/evaluation/datasets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team, name, scene, coverage, process, section, node, remark }),
    });
    onDone();
  };
  return (
    <Modal title="新增评测集" onClose={onClose}>
      <div className="space-y-3">
        <input value={team} onChange={(e) => setTeam(e.target.value)} placeholder="团队 *" className="w-full rounded border px-3 py-2 text-sm" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="评测集名称" className="w-full rounded border px-3 py-2 text-sm" />
        <input value={scene} onChange={(e) => setScene(e.target.value)} placeholder="绑定场景 *" className="w-full rounded border px-3 py-2 text-sm" />
        <textarea value={coverage} onChange={(e) => setCoverage(e.target.value)} placeholder="评测集覆盖范围：时间、主体范围、样本口径等 *" rows={3} className="w-full rounded border px-3 py-2 text-sm" />
        <div className="grid md:grid-cols-3 gap-2">
          <select value={process} onChange={(e) => { setProcess(e.target.value); setSection(""); setNode(""); }} className="rounded border px-3 py-2 text-sm">
            <option value="">E2E 流程</option>
            {E2E_PROCESSES.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
          <select value={section} disabled={!proc} onChange={(e) => { setSection(e.target.value); setNode(""); }} className="rounded border px-3 py-2 text-sm disabled:bg-gray-100">
            <option value="">环节</option>
            {proc?.sections.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
          <select value={node} disabled={!sec} onChange={(e) => setNode(e.target.value)} className="rounded border px-3 py-2 text-sm disabled:bg-gray-100">
            <option value="">节点</option>
            {sec?.nodes.map((n) => <option key={n.id} value={n.name}>{n.name}</option>)}
          </select>
        </div>
        <textarea value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="备注" rows={2} className="w-full rounded border px-3 py-2 text-sm" />
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>取消</Button><Button onClick={submit} disabled={!team || !scene || !coverage}>创建</Button></div>
      </div>
    </Modal>
  );
}

function MaterialForm({ dataset, onClose, onDone }: { dataset: Dataset; onClose: () => void; onDone: () => void }) {
  const [panel, setPanel] = useState("输入A样本");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [link, setLink] = useState("");
  const submit = async () => {
    const payloadFiles = files.length ? files : [{ file_name: link, url: link, file_token: "", source: "飞书云文档" }];
    await fetch("/api/evaluation/materials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ datasetId: dataset.id, team: dataset.team, scene: dataset.scene, panel, files: payloadFiles }),
    });
    onDone();
  };
  return (
    <Modal title={`追加资料：${dataset.name}`} onClose={onClose}>
      <div className="space-y-3">
        <select value={panel} onChange={(e) => setPanel(e.target.value)} className="rounded border px-3 py-2 text-sm">
          <option value="输入A样本">输入A样本</option>
          <option value="人工输出C结果">人工输出C结果</option>
        </select>
        <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="飞书云文档链接（可选）" className="w-full rounded border px-3 py-2 text-sm" />
        <MultiFileUploader label="本地文件（可多选）" uploaded={files} onUpload={setFiles} />
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>取消</Button><Button onClick={submit} disabled={!link && files.length === 0}>保存资料</Button></div>
      </div>
    </Modal>
  );
}

function ReminderForm({ defaultTeam, onClose }: { defaultTeam: string; onClose: () => void }) {
  const [team, setTeam] = useState(defaultTeam);
  const [targetOpenId, setTargetOpenId] = useState("");
  const [scene, setScene] = useState("");
  const [coverage, setCoverage] = useState("");
  const submit = async () => {
    const res = await fetch("/api/evaluation/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team, targetOpenId, scene, coverage }),
    });
    const data = await res.json();
    if (!data.success) alert(data.error || "催办失败");
    else onClose();
  };
  return (
    <Modal title="评测集催办" onClose={onClose}>
      <div className="space-y-3">
        <input value={team} onChange={(e) => setTeam(e.target.value)} placeholder="团队 *" className="w-full rounded border px-3 py-2 text-sm" />
        <input value={targetOpenId} onChange={(e) => setTargetOpenId(e.target.value)} placeholder="被催办人 open_id *" className="w-full rounded border px-3 py-2 text-sm" />
        <input value={scene} onChange={(e) => setScene(e.target.value)} placeholder="场景 *" className="w-full rounded border px-3 py-2 text-sm" />
        <textarea value={coverage} onChange={(e) => setCoverage(e.target.value)} placeholder="需要补充的覆盖范围 *" rows={3} className="w-full rounded border px-3 py-2 text-sm" />
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>取消</Button><Button onClick={submit} disabled={!team || !targetOpenId || !scene || !coverage}>发送催办</Button></div>
      </div>
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="px-5 py-3 border-b flex items-center"><div className="font-semibold">{title}</div><div className="flex-1" /><button onClick={onClose}><X size={16} /></button></div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
