/**
 * Table1「归属范式」多选列：与 /api/bitable/init、/api/bitable/migrate-v4 共用，避免 options 文案漂移。
 */
import { PARADIGM_DEFS, TABLE1_FIELD_PARADIGM } from "@/lib/constants";

/** 飞书 Bitable 字段类型：多选 = 4 */
export const BITABLE_FIELD_TYPE_MULTI_SELECT = 4;

export function getTable1ParadigmBitableField(): {
  field_name: string;
  type: number;
  property: { options: { name: string }[] };
} {
  return {
    field_name: TABLE1_FIELD_PARADIGM,
    type: BITABLE_FIELD_TYPE_MULTI_SELECT,
    property: {
      options: PARADIGM_DEFS.map((d) => ({ name: d.feishuOptionName })),
    },
  };
}
