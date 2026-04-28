// 财务部 FOD 端到端流程结构常量

export interface ProcessNode {
  id: string;
  name: string;
}

export interface ProcessSection {
  id: string;
  name: string;
  nodes: ProcessNode[];
}

export interface E2EProcess {
  id: string;
  name: string;
  shortName: string;
  color: string;
  sections: ProcessSection[];
}

// ─── PTP（含资金） ───
const PTP_SECTIONS: ProcessSection[] = [
  {
    id: "ptp_contract",
    name: "合同管理",
    nodes: [{ id: "ptp_contract_review", name: "合同审核" }],
  },
  {
    id: "ptp_master_data",
    name: "主数据管理",
    nodes: [
      { id: "ptp_master_data_add", name: "主数据新增" },
      { id: "ptp_master_data_change", name: "主数据变更" },
    ],
  },
  {
    id: "ptp_accrual",
    name: "预提",
    nodes: [{ id: "ptp_accrual_amortize", name: "预提&摊销&结转" }],
  },
  {
    id: "ptp_reconciliation",
    name: "对账结算",
    nodes: [
      { id: "ptp_recon_forward", name: "正向对账" },
      { id: "ptp_recon_return", name: "退货对账" },
      { id: "ptp_recon_exit", name: "退出对账" },
      { id: "ptp_recon_deduct", name: "扣款对账" },
    ],
  },
  {
    id: "ptp_invoice",
    name: "发票管理",
    nodes: [
      { id: "ptp_invoice_register", name: "发票登记" },
      { id: "ptp_invoice_verify", name: "发票校验" },
      { id: "ptp_invoice_archive", name: "发票归档" },
    ],
  },
  {
    id: "ptp_payment",
    name: "付款",
    nodes: [
      { id: "ptp_payment_apply", name: "付款申请" },
      { id: "ptp_payment_approve", name: "付款审批" },
      { id: "ptp_payment_plan", name: "资金计划提报" },
      { id: "ptp_payment_execute", name: "资金支付" },
      { id: "ptp_payment_entry", name: "入账" },
      { id: "ptp_payment_clear", name: "清账" },
    ],
  },
  {
    id: "ptp_other",
    name: "其他",
    nodes: [
      { id: "ptp_month_end", name: "月结核算" },
      { id: "ptp_deposit_receive", name: "保证金收款" },
      { id: "ptp_deposit_refund", name: "保证金退款" },
      { id: "ptp_doc_archive", name: "资料归档" },
      { id: "ptp_doc_provide", name: "资料提供（审计、税务等）" },
      { id: "ptp_other_misc", name: "其他" },
    ],
  },
];

// ─── OTC（Order to Cash） ───
const OTC_SECTIONS: ProcessSection[] = [
  {
    id: "otc_contract_policy",
    name: "合同政策管理",
    nodes: [
      { id: "otc_rebate_policy", name: "返利政策归集/审核/创建" },
      { id: "otc_customer_contract", name: "客户合同审核" },
    ],
  },
  {
    id: "otc_master_data",
    name: "主数据管理",
    nodes: [
      { id: "otc_master_add_change", name: "主数据新增/变更" },
      { id: "otc_customer_credit", name: "客户信用维护" },
    ],
  },
  {
    id: "otc_reconciliation",
    name: "对账结算及核算",
    nodes: [
      { id: "otc_recon_forward", name: "正向对账" },
      { id: "otc_rebate_settle", name: "返利实结" },
      { id: "otc_revenue_confirm", name: "收入确认" },
      { id: "otc_revenue_audit", name: "收入稽核" },
    ],
  },
  {
    id: "otc_accrual",
    name: "预提",
    nodes: [{ id: "otc_rebate_accrual", name: "返利预提" }],
  },
  {
    id: "otc_invoice",
    name: "发票管理",
    nodes: [
      { id: "otc_invoice_issue", name: "发票开具" },
      { id: "otc_invoice_register", name: "发票登记" },
      { id: "otc_invoice_mail", name: "发票邮寄" },
      { id: "otc_invoice_archive", name: "票据归档" },
    ],
  },
  {
    id: "otc_collection",
    name: "收款",
    nodes: [
      { id: "otc_bank_collect", name: "银行收款认领" },
      { id: "otc_third_recharge", name: "三方账户充值" },
      { id: "otc_third_withdraw", name: "三方账户提现" },
      { id: "otc_third_recon", name: "三方账户对账" },
    ],
  },
  {
    id: "otc_other",
    name: "其他",
    nodes: [
      { id: "otc_month_end", name: "月结核算" },
      { id: "otc_customer_exit", name: "客户退出结算" },
      { id: "otc_deposit_receive", name: "保证金收款" },
      { id: "otc_deposit_refund", name: "保证金退款" },
      { id: "otc_data_provide", name: "资料提供" },
      { id: "otc_other_misc", name: "其他" },
    ],
  },
];

// ─── RTR（Record to Report） ───
const RTR_SECTIONS: ProcessSection[] = [
  {
    id: "rtr_master_data",
    name: "主数据管理",
    nodes: [
      { id: "rtr_customer_master", name: "客户主数据" },
      { id: "rtr_vendor_master", name: "供应商主数据" },
      { id: "rtr_financial_master", name: "财报主数据" },
      { id: "rtr_mgmt_master", name: "管报主数据" },
    ],
  },
  {
    id: "rtr_contract",
    name: "合同管理",
    nodes: [{ id: "rtr_contract_apply", name: "合同申请" }],
  },
  {
    id: "rtr_reconciliation",
    name: "对账结算及核算",
    nodes: [
      { id: "rtr_recon_forward", name: "正向对账" },
      { id: "rtr_recon_reverse", name: "逆向对账" },
      { id: "rtr_revenue_confirm", name: "收入确认" },
      { id: "rtr_collection_claim", name: "收款认领" },
      { id: "rtr_other_accounting", name: "其他核算" },
    ],
  },
  {
    id: "rtr_accrual",
    name: "预提",
    nodes: [{ id: "rtr_accrual_amortize", name: "预提&摊销" }],
  },
  {
    id: "rtr_invoice",
    name: "发票管理",
    nodes: [
      { id: "rtr_invoice_issue", name: "发票开具" },
      { id: "rtr_invoice_register", name: "发票登记" },
      { id: "rtr_invoice_overdue", name: "欠票归档" },
    ],
  },
  {
    id: "rtr_payment",
    name: "付款管理",
    nodes: [
      { id: "rtr_payment_apply", name: "付款申请" },
      { id: "rtr_payment_approve", name: "付款审批" },
    ],
  },
  {
    id: "rtr_period_end",
    name: "期末账务核对及检查",
    nodes: [
      { id: "rtr_month_end", name: "月结核算" },
      { id: "rtr_reconcile", name: "对账" },
      { id: "rtr_review_check", name: "复核检查" },
    ],
  },
  {
    id: "rtr_report",
    name: "报表管理",
    nodes: [
      { id: "rtr_mgmt_confirm", name: "管报认定" },
      { id: "rtr_mgmt_alloc", name: "管报分摊" },
      { id: "rtr_internal_settle", name: "内部结算" },
      { id: "rtr_diff_adjust", name: "财管差调整" },
      { id: "rtr_report_compile", name: "财/管报编制&出具" },
      { id: "rtr_report_check", name: "报表检查" },
    ],
  },
  {
    id: "rtr_other",
    name: "其他",
    nodes: [
      { id: "rtr_hr_mgmt", name: "人员管理" },
      { id: "rtr_data_provide", name: "数据/资料提供" },
      { id: "rtr_fixed_asset", name: "固资盘点" },
      { id: "rtr_tax_accounting", name: "税金核算" },
      { id: "rtr_other_misc", name: "其他" },
    ],
  },
];

// ─── PIC（Production & Inventory Control） ───
const PIC_SECTIONS: ProcessSection[] = [
  {
    id: "pic_order",
    name: "订单管理",
    nodes: [
      { id: "pic_order_create", name: "生产订单创建" },
      { id: "pic_order_approve", name: "生产订单审核" },
    ],
  },
  {
    id: "pic_material",
    name: "物料管理",
    nodes: [
      { id: "pic_material_pick", name: "领料" },
      { id: "pic_material_loss", name: "报损" },
    ],
  },
  {
    id: "pic_production",
    name: "生产管理",
    nodes: [
      { id: "pic_cost_alloc", name: "费用分摊&成本计提" },
      { id: "pic_cost_transfer", name: "成本结转" },
      { id: "pic_wip_count", name: "在制品盘点" },
      { id: "pic_scrap", name: "生产报废处理" },
    ],
  },
  {
    id: "pic_inbound",
    name: "完工入库",
    nodes: [
      { id: "pic_inbound_confirm", name: "入库确认" },
      { id: "pic_defect", name: "不良品处理" },
    ],
  },
  {
    id: "pic_inventory",
    name: "存货管理",
    nodes: [
      { id: "pic_inv_entry", name: "入账" },
      { id: "pic_inv_count", name: "存货盘点" },
      { id: "pic_outbound", name: "出库结账" },
    ],
  },
  {
    id: "pic_other",
    name: "其他",
    nodes: [{ id: "pic_other_misc", name: "其他" }],
  },
];

// ─── 税务 ───
const TAX_SECTIONS: ProcessSection[] = [
  {
    id: "tax_invoice",
    name: "发票管理",
    nodes: [
      { id: "tax_invoice_issue", name: "发票开具" },
      { id: "tax_ctrl_disk", name: "税控盘管理" },
      { id: "tax_invoice_link", name: "票证关联" },
    ],
  },
  {
    id: "tax_declaration",
    name: "申报管理",
    nodes: [
      { id: "tax_daily_declare", name: "日常申报" },
      { id: "tax_annual_declare", name: "年度申报" },
    ],
  },
  {
    id: "tax_other",
    name: "其他",
    nodes: [
      { id: "tax_stamp_duty", name: "印花税相关合同梳理" },
      { id: "tax_clearance_cert", name: "完税证明下载" },
      { id: "tax_credit_review", name: "信用评级复评申请" },
      { id: "tax_personal_fee", name: "个税手续费返还申请" },
      { id: "tax_master_data", name: "主数据维护" },
      { id: "tax_other_misc", name: "其他" },
    ],
  },
];

// ─── 五大端到端流程汇总 ───
export const E2E_PROCESSES: E2EProcess[] = [
  {
    id: "ptp",
    name: "PTP（Purchase to Payment）",
    shortName: "PTP",
    color: "blue",
    sections: PTP_SECTIONS,
  },
  {
    id: "otc",
    name: "OTC（Order to Cash）",
    shortName: "OTC",
    color: "green",
    sections: OTC_SECTIONS,
  },
  {
    id: "rtr",
    name: "RTR（Record to Report）",
    shortName: "RTR",
    color: "purple",
    sections: RTR_SECTIONS,
  },
  {
    id: "pic",
    name: "PIC（Production & Inventory Control）",
    shortName: "PIC",
    color: "orange",
    sections: PIC_SECTIONS,
  },
  {
    id: "tax",
    name: "税务",
    shortName: "税务",
    color: "red",
    sections: TAX_SECTIONS,
  },
];

export function findE2EProcess(raw: string): E2EProcess | undefined {
  const value = (raw || "").trim();
  if (!value) return undefined;
  return E2E_PROCESSES.find(
    (p) => p.id === value || p.shortName === value || p.name === value
  );
}

export function normalizeE2EProcessShortName(raw: string): string {
  const proc = findE2EProcess(raw);
  return proc?.shortName || (raw || "").trim();
}

// 兼容旧代码（保留 PTP_SECTIONS 导出）
export { PTP_SECTIONS };

export type TaskLabel = "pure_manual" | "cross_system" | "not_recommended";

/** 飞书「标签」是否为纯线下（兼容历史「纯手工」文案） */
export function feishuLabelIsPureManual(labelRaw: string | undefined): boolean {
  if (!labelRaw) return false;
  return labelRaw.includes("纯线下") || labelRaw.includes("纯手工");
}

/** 从飞书「标签」单元格解析为内部 TaskLabel */
export function parseTaskLabelFromFeishu(labelRaw: string | undefined): TaskLabel | "" {
  if (!labelRaw) return "";
  if (feishuLabelIsPureManual(labelRaw)) return "pure_manual";
  if (labelRaw.includes("跨系统")) return "cross_system";
  if (labelRaw.includes("不建议")) return "not_recommended";
  return "";
}

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
    label: "纯线下",
    description: "纯线下操作（优先进入「Skill创建」）",
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

/** Table1（流程节点映射）多选列字段名，须与飞书、API 入参 key 一致 */
export const TABLE1_FIELD_PARADIGM = "归属范式" as const;

export type ParadigmId = "p1" | "p2" | "p3" | "p4" | "p5" | "p6";

export interface ParadigmDef {
  id: ParadigmId;
  /** 与 Bitable 创建字段/写入记录时的 option name 逐字一致 */
  feishuOptionName: string;
  shortLabel: string;
  title: string;
  description: string;
}

/**
 * 六种作业范式；feishuOptionName 与迁移/初始化时 MULTI_SELECT 的 options 绑定，勿随意改。
 */
export const PARADIGM_DEFS: readonly ParadigmDef[] = [
  {
    id: "p1",
    feishuOptionName: "范式① 数据提取-格式转化-系统导入/智能填写",
    shortLabel: "①",
    title: "数据提取 → 格式转换 → 导入/智能填单",
    description: "多介质导出 → 按模板转换 → 导入或智能填到系统",
  },
  {
    id: "p2",
    feishuOptionName: "范式② 多源采集-交叉核对-差异处理",
    shortLabel: "②",
    title: "多源数据采集 → 交叉核对 → 差异处理",
    description: "A/B 取数 → 比对 → 查因与处理",
  },
  {
    id: "p3",
    feishuOptionName: "范式③ 规则计算-分摊-会计凭证",
    shortLabel: "③",
    title: "规则计算 → 分摊分配 → 凭证生成",
    description: "取数 → 公式/分摊 → 凭证明细",
  },
  {
    id: "p4",
    feishuOptionName: "范式④ 单据审核-规则校验-放行或异常",
    shortLabel: "④",
    title: "单据审核 → 规则校验 → 放行/异常",
    description: "接单据 → 逐条规则 → 放行或标异常",
  },
  {
    id: "p5",
    feishuOptionName: "范式⑤ 定时或事件-自动执行-结果推送",
    shortLabel: "⑤",
    title: "定时/事件触发 → 自动执行 → 结果推送",
    description: "调度或事件 → 系统执行 → 下游通知",
  },
  {
    id: "p6",
    feishuOptionName: "范式⑥ 线下台账-系统管理-核对预警",
    shortLabel: "⑥",
    title: "线下台账 → 系统化管理 → 自动核对/预警",
    description: "Excel/台账迁入 → 系统维护 → 对账与预警",
  },
];

const PARADIGM_NAME_TO_ID: Record<string, ParadigmId> = Object.fromEntries(
  PARADIGM_DEFS.map((d) => [d.feishuOptionName, d.id])
) as Record<string, ParadigmId>;

export const ALL_PARADIGM_IDS: readonly ParadigmId[] = PARADIGM_DEFS.map(
  (d) => d.id
);

export function isParadigmId(s: string): s is ParadigmId {
  return (ALL_PARADIGM_IDS as readonly string[]).includes(s);
}

/** 从飞书多选列原始值解析为 id 列表（去重、过滤未知项） */
export function parseParadigmsFromFeishu(feishu: unknown): ParadigmId[] {
  const out: ParadigmId[] = [];
  const seen = new Set<ParadigmId>();

  const push = (name: string) => {
    const t = name.trim();
    if (!t) return;
    const id = PARADIGM_NAME_TO_ID[t];
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  };

  if (feishu == null) return out;
  if (Array.isArray(feishu)) {
    for (const x of feishu) {
      if (typeof x === "string") push(x);
    }
    return out;
  }
  if (typeof feishu === "string") {
    push(feishu);
    return out;
  }
  return out;
}

export function paradigmIdsToFeishuFieldValue(
  ids: readonly ParadigmId[]
): string[] {
  return ids.map(
    (id) => PARADIGM_DEFS.find((d) => d.id === id)!.feishuOptionName
  );
}

export const PRESET_TEAMS = [
  "武汉中心",
  "北京-采购到付款组",
  "北京-订单到收款组",
  "北京-互联网组",
  "北京-返利组",
  "北京-总账组",
  "北京-海外组",
  "北京-税务组",
  "成本组",
  "专项成本组",
  "财报组",
  "管报组",
];

// 第二步准确率门槛（必须达到 100% 才可提交）
export const STEP2_MIN_ACCURACY = 100;

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
