/**
 * MiMo API 客户端（OpenAI 兼容）
 * 用于校验用户上传的对比分析报告
 */

const MIMO_BASE_URL =
  process.env.MIMO_BASE_URL || "https://token-plan-cn.xiaomimimo.com/v1";
const MIMO_API_KEY = process.env.MIMO_API_KEY || "";
const MIMO_MODEL = process.env.MIMO_MODEL || "mimo-v2-pro";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function chatCompletion(messages: ChatMessage[]): Promise<string> {
  const res = await fetch(`${MIMO_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MIMO_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MIMO_MODEL,
      messages,
      temperature: 0.1,
      max_tokens: 2000,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MiMo API 请求失败: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.choices[0].message.content as string;
}

export interface ValidationResult {
  passed: boolean;
  score: number;
  missing_points: string[];
  feedback: string;
  details: Record<string, { found: boolean; comment: string }>;
}

/**
 * 校验第三步对比分析报告
 * 必须包含三个分析点：
 * 1. 子skill 1、2 对比母skill：是否严格遵循母框架的结构
 * 2. 子skill 1 对比 子skill 2：调整了哪些配置
 * 3. 准确率分析：最终的准确率提升来自哪些调整、残留问题
 */
export async function validateStep3Report(
  reportContent: string
): Promise<ValidationResult> {
  const systemPrompt = `你是一位专业的AI技能评估专家。用户提交了一份关于AI子Skill对比分析的报告（Markdown格式）。
请逐一判断该报告是否包含了以下三个必要分析点，并给出详细反馈。

评判标准：
1. **框架结构对比**：报告中是否有"子skill 1"和"子skill 2"对比"母skill（母框架）"的结构分析，包括节点数量、顺序是否与母框架一致。
2. **配置调整对比**：报告中是否有"子skill 1"对比"子skill 2"的配置调整说明。
3. **准确率分析**：报告中是否包含准确率提升来源的分析，以及残留问题的说明（如有）。

请以 JSON 格式返回，格式如下：
{
  "passed": true/false,
  "score": 0-100的分数（3个点各占约33分），
  "missing_points": ["缺少的点列表"],
  "feedback": "总体反馈说明",
  "details": {
    "framework_comparison": { "found": true/false, "comment": "说明" },
    "config_comparison": { "found": true/false, "comment": "说明" },
    "accuracy_analysis": { "found": true/false, "comment": "说明" }
  }
}`;

  const userMessage = `请分析以下对比报告内容：\n\n---\n${reportContent}\n---\n\n请判断该报告是否包含了三个必要分析点，并返回 JSON 格式的评估结果。`;

  const raw = await chatCompletion([
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ]);

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("未找到 JSON 内容");
    const result = JSON.parse(jsonMatch[0]) as ValidationResult;
    return result;
  } catch {
    return {
      passed: false,
      score: 0,
      missing_points: ["报告解析失败，请检查报告格式"],
      feedback: `AI解析响应失败，原始内容：${raw.slice(0, 200)}`,
      details: {
        framework_comparison: { found: false, comment: "解析失败" },
        config_comparison: { found: false, comment: "解析失败" },
        accuracy_analysis: { found: false, comment: "解析失败" },
      },
    };
  }
}

/**
 * 校验第四步对比分析报告
 * 必须包含四个分析点：
 * 1. 子Skill3是否严格遵循母框架的结构
 * 2. 子skill 3 对比 子skill 1和子SKill2：调整了哪些配置
 * 3. 子skill 3 对比 母Skill：调整了哪些配置
 * 4. 准确率分析：子SKill3相较于子skill 1和子SKill准确率提升或下降来自哪些调整
 */
export async function validateStep4Report(
  reportContent: string
): Promise<ValidationResult> {
  const systemPrompt = `你是一位专业的AI技能评估专家。用户提交了一份关于AI子Skill3对比分析的报告（Markdown格式）。
请逐一判断该报告是否包含了以下四个必要分析点，并给出详细反馈。

评判标准：
1. **子Skill3框架遵循性**：报告是否分析了子Skill3是否严格遵循母框架结构（节点数量、顺序是否与母包一致）。
2. **子Skill3与子Skill1/2对比**：报告是否包含子Skill3与子Skill1、子Skill2的配置调整对比说明。
3. **子Skill3与母Skill对比**：报告是否包含子Skill3与母Skill的配置调整对比说明。
4. **准确率分析**：报告是否包含子Skill3相较于子Skill1和子Skill2的准确率提升/下降分析，以及残留问题（如有）。

请以 JSON 格式返回，格式如下：
{
  "passed": true/false,
  "score": 0-100的分数（4个点各占25分），
  "missing_points": ["缺少的点列表"],
  "feedback": "总体反馈说明",
  "details": {
    "skill3_framework": { "found": true/false, "comment": "说明" },
    "skill3_vs_skill12": { "found": true/false, "comment": "说明" },
    "skill3_vs_mother": { "found": true/false, "comment": "说明" },
    "accuracy_analysis": { "found": true/false, "comment": "说明" }
  }
}`;

  const userMessage = `请分析以下对比报告内容：\n\n---\n${reportContent}\n---\n\n请判断该报告是否包含了四个必要分析点，并返回 JSON 格式的评估结果。`;

  const raw = await chatCompletion([
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ]);

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("未找到 JSON 内容");
    const result = JSON.parse(jsonMatch[0]) as ValidationResult;
    return result;
  } catch {
    return {
      passed: false,
      score: 0,
      missing_points: ["报告解析失败，请检查报告格式"],
      feedback: `AI解析响应失败，原始内容：${raw.slice(0, 200)}`,
      details: {
        skill3_framework: { found: false, comment: "解析失败" },
        skill3_vs_skill12: { found: false, comment: "解析失败" },
        skill3_vs_mother: { found: false, comment: "解析失败" },
        accuracy_analysis: { found: false, comment: "解析失败" },
      },
    };
  }
}
