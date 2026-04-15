// PTP (Purchase to Payment) 流程结构常量

export interface ProcessNode {
  id: string;
  name: string;
}

export interface ProcessSection {
  id: string;
  name: string;
  nodes: ProcessNode[];
}

export const PTP_SECTIONS: ProcessSection[] = [
  {
    id: "contract",
    name: "合同管理",
    nodes: [{ id: "contract_review", name: "合同审核" }],
  },
  {
    id: "master_data",
    name: "主数据管理",
    nodes: [
      { id: "master_data_add", name: "主数据新增" },
      { id: "master_data_change", name: "主数据变更" },
    ],
  },
  {
    id: "accrual",
    name: "预提",
    nodes: [{ id: "accrual_amortize", name: "预提&摊销&结转" }],
  },
  {
    id: "reconciliation",
    name: "对账结算",
    nodes: [
      { id: "recon_forward", name: "正向对账" },
      { id: "recon_return", name: "退货对账" },
      { id: "recon_exit", name: "退出对账" },
      { id: "recon_deduct", name: "扣款对账" },
    ],
  },
  {
    id: "invoice",
    name: "发票管理",
    nodes: [
      { id: "invoice_register", name: "发票登记" },
      { id: "invoice_verify", name: "发票校验" },
      { id: "invoice_archive", name: "发票归档" },
    ],
  },
  {
    id: "payment",
    name: "付款",
    nodes: [
      { id: "payment_apply", name: "付款申请" },
      { id: "payment_approve", name: "付款审批" },
      { id: "payment_plan", name: "资金计划提报" },
      { id: "payment_execute", name: "资金支付" },
      { id: "payment_entry", name: "入账" },
      { id: "payment_clear", name: "清账" },
    ],
  },
  {
    id: "other",
    name: "其他",
    nodes: [
      { id: "month_end", name: "月结核算" },
      { id: "deposit_receive", name: "保证金收款" },
      { id: "deposit_refund", name: "保证金退款" },
      { id: "doc_archive", name: "资料归档" },
      { id: "doc_provide", name: "资料提供（审计、税务等）" },
    ],
  },
];

export type TaskLabel =
  | "pure_manual"
  | "cross_system"
  | "not_recommended";

export interface LabelOption {
  value: TaskLabel;
  icon: string;
  label: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export const TASK_LABELS: LabelOption[] = [
  {
    value: "pure_manual",
    icon: "★",
    label: "纯手工",
    description: "纯线下操作or纯手工工作（本次优先完成）",
    color: "text-orange-700",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-300",
  },
  {
    value: "cross_system",
    icon: "◆",
    label: "跨系统",
    description: "涉及跨系统手工工作",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-300",
  },
  {
    value: "not_recommended",
    icon: "✕",
    label: "不建议AI",
    description: "手工作业但处于风险等原因不建议AI应用",
    color: "text-red-700",
    bgColor: "bg-red-50",
    borderColor: "border-red-300",
  },
];

export const PRESET_TEAMS = ["互联网PTP团队"];

// 第二步准确率门槛
export const STEP2_MIN_ACCURACY = 90;

// 第三步对比报告必须包含的三个分析点
export const REPORT_REQUIRED_POINTS_STEP3 = [
  "子skill 1、2 对比母skill：是否严格遵循母框架的结构（节点数量、顺序是否与母包一致）",
  "子skill 1 对比 子skill 2：调整了哪些配置",
  "准确率分析：最终的准确率提升主要来自以上哪些调整、残留问题",
];

// 第四步对比报告必须包含的分析点
export const REPORT_REQUIRED_POINTS_STEP4 = [
  "子SKill3是否严格遵循母框架的结构（节点数量、顺序是否与母包一致）",
  "子skill 3 对比 子skill 1和子SKill2：调整了哪些配置",
  "子skill 3 对比 母Skill：调整了哪些配置",
  "准确率分析：子SKill3相较于子skill 1和子SKill准确率提升或者下降主要来自以上哪些调整、残留问题",
];
