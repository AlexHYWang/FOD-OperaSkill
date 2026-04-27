"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, FlaskConical, UploadCloud, X } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { FileUploader, type UploadedFile } from "@/components/FileUploader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";

interface Dataset {
  id: string;
  name: string;
  team: string;
  scene: string;
  coverage: string;
}

export default function EvaluationTestPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const { user, isLoggedIn, loading, team, setTeam } = useAuth();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedId, setSelectedId] = useState(sp?.get("datasetId") || "");
  const [scene, setScene] = useState(sp?.get("scene") || "");
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    if (!loading && !isLoggedIn) router.push("/");
  }, [loading, isLoggedIn, router]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const params = new URLSearchParams();
    if (team) params.set("team", team);
    fetch(`/api/evaluation/datasets?${params}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setDatasets(d.items || []));
  }, [isLoggedIn, team]);

  const selected = useMemo(() => datasets.find((d) => d.id === selectedId) || null, [datasets, selectedId]);
  useEffect(() => {
    if (selected?.scene) setScene(selected.scene);
  }, [selected?.scene]);

  if (loading || !isLoggedIn || !user) return <div className="min-h-screen flex items-center justify-center">加载中...</div>;

  const packageUrl =
    selected && team
      ? `/api/evaluation/test-package?team=${encodeURIComponent(team)}&scene=${encodeURIComponent(selected.scene)}&datasetId=${encodeURIComponent(selected.id)}`
      : "";

  return (
    <AppLayout team={team} onTeamChange={setTeam} user={user}>
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <header>
          <div className="flex items-center gap-2 text-amber-600 text-sm font-medium">
            <FlaskConical size={18} /> 评测集测试
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">财多多线下测试与结果回传</h1>
          <p className="text-sm text-gray-500 mt-1">下载线下测试包，在财多多本地完成测试后上传机器输出 C 结果、对比分析报告和准确率。</p>
        </header>

        <section className="rounded-2xl border bg-white p-4 space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs text-gray-600">选择评测集</span>
              <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full rounded border px-3 py-2 text-sm">
                <option value="">请选择</option>
                {datasets.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.scene}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-gray-600">绑定场景</span>
              <input value={scene} onChange={(e) => setScene(e.target.value)} className="w-full rounded border px-3 py-2 text-sm" />
            </label>
          </div>

          {selected && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <div className="font-semibold mb-1">线下测试步骤</div>
              <ol className="list-decimal ml-5 space-y-1 text-xs">
                <li>下载线下测试包，解压后可看到 SKILL、知识库、输入A样本、人工输出C结果。</li>
                <li>打开财多多本地 Agent APP，加载 SKILL ZIP 和知识库资料。</li>
                <li>使用输入A样本执行测试，并与人工输出C结果对比。</li>
                <li>回到本页面上传机器输出C结果、对比分析报告，并填写准确率。</li>
              </ol>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={!packageUrl} onClick={() => packageUrl && window.open(packageUrl, "_blank")}>
              <Download size={14} className="mr-1" /> 下载线下测试包
            </Button>
            <Button disabled={!selected} onClick={() => setShowUpload(true)} className="bg-amber-600 hover:bg-amber-700">
              <UploadCloud size={14} className="mr-1" /> 上传测评结果
            </Button>
          </div>
        </section>

        {showUpload && selected && (
          <RunUploadModal
            dataset={selected}
            team={team}
            scene={scene || selected.scene}
            onClose={() => setShowUpload(false)}
          />
        )}
      </div>
    </AppLayout>
  );
}

function RunUploadModal({ dataset, team, scene, onClose }: { dataset: Dataset; team: string; scene: string; onClose: () => void }) {
  const [outputFile, setOutputFile] = useState<UploadedFile | null>(null);
  const [reportFile, setReportFile] = useState<UploadedFile | null>(null);
  const [accuracy, setAccuracy] = useState("");
  const [skillVersion, setSkillVersion] = useState("");
  const [knowledgeVersion, setKnowledgeVersion] = useState("");
  const [remark, setRemark] = useState("");
  const submit = async () => {
    const res = await fetch("/api/evaluation/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        team,
        scene,
        datasetId: dataset.id,
        outputFileName: outputFile?.file_name,
        outputFileUrl: outputFile?.url,
        reportFileName: reportFile?.file_name,
        reportFileUrl: reportFile?.url,
        accuracy: Number(accuracy),
        skillVersion,
        knowledgeVersion,
        tool: "财多多",
        remark,
      }),
    });
    const data = await res.json();
    if (!data.success) alert(data.error || "保存失败");
    else onClose();
  };
  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
        <div className="px-5 py-3 border-b flex items-center"><div className="font-semibold">上传测评结果</div><div className="flex-1" /><button onClick={onClose}><X size={16} /></button></div>
        <div className="p-5 space-y-4">
          <div className="rounded-xl border bg-gray-50 p-3 text-sm">{dataset.name} / {scene}</div>
          <FileUploader label="机器输出C结果" uploaded={outputFile} onUpload={setOutputFile} required />
          <FileUploader label="对比分析报告" uploaded={reportFile} onUpload={setReportFile} required />
          <div className="grid md:grid-cols-3 gap-2">
            <input value={accuracy} onChange={(e) => setAccuracy(e.target.value)} placeholder="准确率(%) *" className="rounded border px-3 py-2 text-sm" />
            <input value={skillVersion} onChange={(e) => setSkillVersion(e.target.value)} placeholder="SKILL版本" className="rounded border px-3 py-2 text-sm" />
            <input value={knowledgeVersion} onChange={(e) => setKnowledgeVersion(e.target.value)} placeholder="知识库版本" className="rounded border px-3 py-2 text-sm" />
          </div>
          <textarea value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="测试备注" rows={3} className="w-full rounded border px-3 py-2 text-sm" />
        </div>
        <div className="px-5 py-3 border-t bg-gray-50 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={submit} disabled={!outputFile || !reportFile || !accuracy}>提交测评结果</Button>
        </div>
      </div>
    </div>
  );
}
