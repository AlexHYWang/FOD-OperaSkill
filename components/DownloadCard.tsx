"use client";

import { Download, Package, Wrench } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface DownloadItem {
  name: string;
  description: string;
  fileName: string;
  icon: React.ReactNode;
  color: string;
}

const DOWNLOADS: DownloadItem[] = [
  {
    name: "母 Skill 框架",
    description:
      "包含标准化的母框架结构，是生成各场景子Skill的基础模板",
    fileName: "mother_framework_v1.1.3.zip",
    icon: <Package size={20} />,
    color: "text-purple-600 bg-purple-50 border-purple-200",
  },
  {
    name: "Skill Creator",
    description:
      "Claude 官方出品的专门用于创建 Skill 的工具，下载解压后按指引使用",
    fileName: "skill-creator.zip",
    icon: <Wrench size={20} />,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
  },
];

export function DownloadCard() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {DOWNLOADS.map((item) => (
        <Card key={item.fileName} className="border hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div
                className={`flex-shrink-0 p-2 rounded-lg border ${item.color}`}
              >
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{item.name}</div>
                <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                  {item.description}
                </div>
              </div>
            </div>
            <a
              href={`/${item.fileName}`}
              download
              className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-colors"
            >
              <Download size={14} />
              下载 {item.fileName}
            </a>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
