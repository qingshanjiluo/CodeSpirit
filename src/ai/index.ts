/**
 * CodeSpirit AI 模块
 * 支持多API密钥轮询、错误重试、调用统计
 * 优先适配 DeepSeek API
 */

import { get, put, STORES } from '@/db';

// AI 调用统计（存储在 localStorage 中便于快速访问）
const STATS_KEY = 'codespirit_ai_stats';

interface AIStats {
  totalCalls: number;
  todayCalls: number;
  lastCallTime: number | null;
  lastCallDate: string;
  errors: number;
  tokensUsed: number;
}

interface AIConfig {
  provider: string;
  endpoint: string;
  model: string;
  apiKeys: string[];
  temperature: number;
  maxTokens: number;
  keyIndex: number;
}

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface CallAIOptions {
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  onStream?: (chunk: string) => void;
}

// 结构化课程内容类型
interface StructuredCourseContent {
  title: string;
  description: string;
  stages: CourseStage[];
  estimatedMinutes: number;
  xpReward: number;
}

interface CourseStage {
  id: string;
  name: string;
  type: 'explanation' | 'example' | 'practice' | 'test' | 'summary';
  content: string;
  gameComponents?: GameComponentData[];
  dialogue?: DialogueLine[];
}

interface GameComponentData {
  type: 'fill-blank' | 'puzzle' | 'drag-drop' | 'multi-choice' | 'maze' | 'code-exec' | 'mini-project';
  data: any;
  instructions: string;
  solution?: any;
  hints?: string[];
}

interface DialogueLine {
  speaker: 'ai' | 'user';
  content: string;
  delay?: number; // 延迟显示（毫秒）
}

/**
 * 获取AI配置
 */
export async function getAIConfig(): Promise<AIConfig> {
  const config = await get<{ value: AIConfig }>(STORES.AI_CONFIG, 'aiConfig');
  console.log('[AI] 读取AI配置:', config);
  
  let aiConfig: AIConfig;
  
  if (config?.value) {
    console.log('[AI] 使用数据库中的配置');
    aiConfig = config.value;
    
    // 验证并修复端点URL
    if (aiConfig.endpoint && !aiConfig.endpoint.includes('/chat/completions')) {
      console.warn('[AI] 检测到不完整的端点URL，自动修复:', aiConfig.endpoint);
      
      // 修复端点URL
      if (aiConfig.endpoint.includes('v1')) {
        // 如果是v1端点，添加/chat/completions
        aiConfig.endpoint = aiConfig.endpoint.replace(/\/?$/, '/chat/completions');
      } else if (aiConfig.endpoint.includes('api.deepseek.com')) {
        // 如果是deepseek域名，使用标准端点
        aiConfig.endpoint = 'https://api.deepseek.com/chat/completions';
      } else {
        // 其他情况，使用完整端点
        aiConfig.endpoint = 'https://api.deepseek.com/chat/completions';
      }
      
      console.log('[AI] 修复后的端点:', aiConfig.endpoint);
      
      // 自动保存修复后的配置
      try {
        await updateAIConfig({ endpoint: aiConfig.endpoint });
        console.log('[AI] 已自动保存修复后的端点配置');
      } catch (error) {
        console.error('[AI] 自动保存配置失败:', error);
      }
    }
  } else {
    console.log('[AI] 使用默认配置');
    aiConfig = {
      provider: 'deepseek',
      endpoint: 'https://api.deepseek.com/chat/completions',
      model: 'deepseek-chat',
      apiKeys: [],
      temperature: 0.7,
      maxTokens: 4096,
      keyIndex: 0
    };
  }
  
  // 确保端点格式正确
  if (!aiConfig.endpoint.startsWith('https://')) {
    aiConfig.endpoint = 'https://' + aiConfig.endpoint;
  }
  
  return aiConfig;
}

/**
 * 更新AI配置
 */
export async function updateAIConfig(config: Partial<AIConfig>): Promise<void> {
  console.log('[AI] 更新AI配置:', config);
  
  const current = await get<{ value: AIConfig; key: string; category: string }>(
    STORES.AI_CONFIG,
    'aiConfig'
  );
  console.log('[AI] 当前配置:', current);
  
  const updated = {
    key: 'aiConfig',
    category: 'aiConfig',
    value: { ...current?.value, ...config },
    updatedAt: Date.now()
  };
  
  console.log('[AI] 保存配置:', updated);
  await put(STORES.AI_CONFIG, updated);
  console.log('[AI] 配置保存完成');
}

/**
 * 获取调用统计
 */
export function getAIStats(): AIStats {
  const stats = localStorage.getItem(STATS_KEY);
  const today = new Date().toDateString();

  if (stats) {
    const parsed = JSON.parse(stats);
    // 重置今日统计
    if (parsed.lastCallDate !== today) {
      parsed.todayCalls = 0;
      parsed.lastCallDate = today;
    }
    return parsed;
  }

  return {
    totalCalls: 0,
    todayCalls: 0,
    lastCallTime: null,
    lastCallDate: today,
    errors: 0,
    tokensUsed: 0
  };
}

/**
 * 更新调用统计
 */
function updateStats(tokens?: number): void {
  const stats = getAIStats();
  const today = new Date().toDateString();

  stats.totalCalls++;
  stats.todayCalls++;
  stats.lastCallTime = Date.now();
  stats.lastCallDate = today;
  if (tokens) {
    stats.tokensUsed += tokens;
  }

  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

/**
 * 记录错误
 */
function recordError(): void {
  const stats = getAIStats();
  stats.errors++;
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

/**
 * 基础AI调用函数（支持多密钥轮询和错误重试）
 */
export async function callAI(options: CallAIOptions): Promise<string> {
  const config = await getAIConfig();

  if (!config.apiKeys.length) {
    throw new Error('未配置API密钥，请先在设置中添加API密钥');
  }

  const maxRetries = config.apiKeys.length * 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const keyIndex = (config.keyIndex + attempt) % config.apiKeys.length;
    const apiKey = config.apiKeys[keyIndex];

    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          messages: options.messages,
          temperature: options.temperature ?? config.temperature,
          max_tokens: options.maxTokens ?? config.maxTokens,
          stream: options.stream ?? false
        })
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        let errorDetails = '';
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.error?.message || errorData.message || errorMessage;
          errorDetails = JSON.stringify(errorData, null, 2);
        } catch {
          // 如果无法解析JSON，使用状态文本
          errorMessage = `${response.status} ${response.statusText}`;
        }
        
        const error = new Error(errorMessage);
        (error as any).status = response.status;
        (error as any).details = errorDetails;
        throw error;
      }

      // 处理流式响应
      if (options.stream && options.onStream) {
        return await handleStreamResponse(response, options.onStream);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      const tokens = data.usage?.total_tokens;

      // 更新统计
      updateStats(tokens);

      // 更新密钥索引（轮询）
      await updateAIConfig({ keyIndex: (keyIndex + 1) % config.apiKeys.length });

      return content;
    } catch (error) {
      lastError = error as Error;
      const status = (error as any).status;
      
      console.warn(`[AI] 调用失败 (key ${keyIndex}, attempt ${attempt + 1}):`, error);

      // 如果是404错误，可能是端点问题，提供更详细的错误信息
      if (status === 404) {
        console.error('[AI] API端点返回404，请检查：');
        console.error('1. API端点URL是否正确:', config.endpoint);
        console.error('2. DeepSeek API文档: https://platform.deepseek.com/api-docs/');
        console.error('3. 当前模型:', config.model);
        
        // 如果是端点问题，尝试使用备用端点
        if (config.endpoint.includes('v1/')) {
          console.warn('[AI] 尝试使用非v1端点...');
          const altEndpoint = config.endpoint.replace('v1/', '');
          console.warn('[AI] 备用端点:', altEndpoint);
        }
      }

      // 如果是密钥问题，尝试下一个密钥
      if (status === 401 || status === 403 ||
          lastError.message?.includes('401') || lastError.message?.includes('403')) {
        console.warn(`[AI] 密钥 ${keyIndex} 无效，尝试下一个密钥`);
        continue;
      }

      // 网络错误，短暂延迟后重试
      if (lastError.message?.includes('network') || lastError.message?.includes('fetch') ||
          lastError.message?.includes('Network') || lastError.message?.includes('Failed to fetch')) {
        console.warn(`[AI] 网络错误，${attempt + 1}秒后重试`);
        await sleep(1000 * (attempt + 1));
        continue;
      }

      // 如果是404错误且没有备用端点，直接抛出
      if (status === 404) {
        break;
      }

      // 其他错误，短暂延迟后重试
      await sleep(1000 * (attempt + 1));
      continue;
    }
  }

  recordError();
  throw lastError || new Error('AI调用失败，请检查网络连接和API密钥');
}

/**
 * 处理流式响应
 */
async function handleStreamResponse(
  response: Response,
  onStream: (chunk: string) => void
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('无法读取响应流');

  const decoder = new TextDecoder();
  let fullContent = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              fullContent += content;
              onStream(content);
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  updateStats();
  return fullContent;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 生成课程方案（3-5个不同侧重）
 */
export async function generateCoursePlans(
  description: string,
  level: string,
  timePerWeek: number
): Promise<Array<{
  title: string;
  description: string;
  focus: string;
  estimatedWeeks: number;
  style?: string;
  learningStyle?: string;
  keyFeatures?: string[];
}>> {
  const systemPrompt = `你是一个专业的编程教育课程设计师。根据用户的需求，设计3-5个不同侧重的课程方案。

每个方案应包含以下字段：
1. title: 吸引人的课程标题（体现课程特色）
2. description: 详细课程简介（50-100字，说明课程内容和目标）
3. focus: 主要侧重点（如：基础概念、项目实践、原理深入等）
4. estimatedWeeks: 预计学习周数（基于每周${timePerWeek}小时）
5. style: 教学风格倾向（如：实践驱动、理论深入、项目导向、游戏化学习等）
6. learningStyle: 适合的学习风格（如：循序渐进、快速上手、深度探索等）
7. keyFeatures: 关键特色（数组，2-4个特色点）

要求：
- 方案之间要有明显差异，覆盖不同学习风格
- 周数计算要合理，基于每周${timePerWeek}小时
- 标题要吸引人，体现课程特色
- 以JSON数组格式返回，不要包含其他解释文字

示例格式：
[
  {
    "title": "Python编程从零到实战",
    "description": "通过实际项目学习Python基础，适合初学者快速上手...",
    "focus": "项目实践",
    "estimatedWeeks": 6,
    "style": "实践驱动",
    "learningStyle": "快速上手",
    "keyFeatures": ["项目实战", "即时反馈", "代码练习"]
  }
]`;

  const userPrompt = `用户需求：${description}
预期水平：${level}
每周可用时间：${timePerWeek}小时

请生成3-5个不同侧重的课程方案，确保多样性。`;

  const response = await callAI({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.8
  });

  try {
    // 提取JSON部分
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(response);
  } catch {
    // 如果解析失败，返回默认方案
    return [
      {
        title: '基础入门',
        description: '从零开始学习编程基础',
        focus: '基础概念',
        estimatedWeeks: 4
      },
      {
        title: '实战进阶',
        description: '通过实际项目提升技能',
        focus: '项目实践',
        estimatedWeeks: 6
      },
      {
        title: '深度探索',
        description: '深入理解核心原理',
        focus: '原理深入',
        estimatedWeeks: 8
      }
    ];
  }
}

/**
 * 生成课程内容（对话式，含游戏化组件）
 */
export async function generateCourseContent(
  courseTitle: string,
  chapterIndex: number,
  totalChapters: number,
  previousContext: string,
  userLevel: string,
  onStream?: (chunk: string) => void
): Promise<string> {
  const systemPrompt = `你是一个AI编程导师，正在教授"${courseTitle}"课程的第${chapterIndex + 1}节（共${totalChapters}节）。

课程交互设计规范：
1. 每节课遵循固定流程：讲解 → 示例 → 练习 → 测试 → 总结
2. 使用对话式教学，像导师一样亲切引导
3. 在适当位置插入游戏化元素：
   - <game-maze>迷宫游戏</game-maze>
   - <game-puzzle>代码拼图</game-puzzle>
   - <game-drag-drop>拖拽配对</game-drag-drop>
   - <game-multi-choice>多选题</game-multi-choice>
   - <game-code-exec>代码执行验证</game-code-exec>
   - <game-fill-blank>代码填空</game-fill-blank>
   - <game-mini-project>小项目挑战</game-mini-project>
4. 代码示例使用 Monaco 编辑器格式：<code-editor lang="python">代码</code-editor>
5. 每个阶段用 <stage name="讲解中|练习中|测试中"> 标记

用户水平：${userLevel}

请生成完整的课程内容，包含交互元素标记。`;

  const userPrompt = previousContext
    ? `前一节内容概要：${previousContext}\n\n请继续生成第${chapterIndex + 1}节内容。`
    : `请生成第${chapterIndex + 1}节内容。`;

  return callAI({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.7,
    stream: !!onStream,
    onStream
  });
}

/**
 * 获取代码优化建议
 */
export async function getCodeOptimization(
  code: string,
  language: string,
  taskDescription: string
): Promise<{
  isCorrect: boolean;
  feedback: string;
  optimizedCode: string;
  explanation: string;
  timeComplexity: string;
  spaceComplexity: string;
}> {
  const systemPrompt = `你是一个代码审查专家。分析用户提交的代码，提供：
1. 正确性判断
2. 详细反馈
3. 优化后的代码
4. 优化解释
5. 时间复杂度分析
6. 空间复杂度分析

以JSON格式返回：
{
  "isCorrect": boolean,
  "feedback": string,
  "optimizedCode": string,
  "explanation": string,
  "timeComplexity": string,
  "spaceComplexity": string
}`;

  const userPrompt = `任务描述：${taskDescription}
编程语言：${language}

代码：
\`\`\`${language}
${code}
\`\`\``;

  const response = await callAI({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.3
  });

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(response);
  } catch {
    return {
      isCorrect: true,
      feedback: '代码已提交',
      optimizedCode: code,
      explanation: '无法解析AI响应',
      timeComplexity: '未知',
      spaceComplexity: '未知'
    };
  }
}

/**
 * 动态难度调整（根据历史数据调整）
 */
export async function adjustDifficulty(
  correctRate: number,
  avgTime: number,
  currentDifficulty: string
): Promise<{ difficulty: string; explanation: string }> {
  const systemPrompt = `你是一个自适应学习系统。根据学生的学习数据，调整后续内容的难度。

难度级别：beginner < easy < medium < hard < expert

调整规则：
- 正确率 > 80% 且用时较短：提升难度
- 正确率 50-80%：保持当前难度
- 正确率 < 50%：降低难度

以JSON格式返回：{ "difficulty": string, "explanation": string }`;

  const userPrompt = `当前正确率：${(correctRate * 100).toFixed(1)}%
平均用时：${avgTime}秒
当前难度：${currentDifficulty}

请决定下一节的难度。`;

  const response = await callAI({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.3
  });

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(response);
  } catch {
    return {
      difficulty: currentDifficulty,
      explanation: '保持当前难度'
    };
  }
}

/**
 * 自由问答（AI老师上下文对话）
 */
export async function chatWithAI(
  messages: Message[],
  onStream?: (chunk: string) => void
): Promise<string> {
  const config = await getAIConfig();
  const profile = await get<{ value: { aiRoleName: string } }>(STORES.USER_DATA, 'profile');
  const aiName = profile?.value?.aiRoleName || 'AI导师';

  const systemMessage: Message = {
    role: 'system',
    content: `你是${aiName}，一个专业、耐心、友好的编程导师。\n\n教学原则：\n1. 用通俗易懂的语言解释复杂概念\n2. 提供具体的代码示例\n3. 鼓励学生自主思考，不直接给答案\n4. 根据学生的问题深度调整回答详细程度\n5. 适时提供学习建议和资源推荐`
  };

  return callAI({
    messages: [systemMessage, ...messages],
    temperature: 0.7,
    stream: !!onStream,
    onStream
  });
}

/**
 * 生成课后摘要
 */
export async function generateSummary(
  chapterContent: string,
  userNotes: string[]
): Promise<{ keyPoints: string[]; summary: string; reviewQuestions: string[] }> {
  const systemPrompt = `根据课程内容生成学习摘要。以JSON格式返回：
{
  "keyPoints": ["要点1", "要点2", ...],
  "summary": "整体总结",
  "reviewQuestions": ["复习问题1", ...]
}`;

  const userPrompt = `课程内容：\n${chapterContent}\n\n用户笔记：\n${userNotes.join('\n')}`;

  const response = await callAI({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.5
  });

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(response);
  } catch {
    return {
      keyPoints: ['课程内容要点'],
      summary: '本节课程总结',
      reviewQuestions: ['复习问题1']
    };
  }
}

/**
 * 降级模拟输出（沙箱失败时使用）
 */
export async function simulateCodeExecution(
  code: string,
  language: string,
  input?: string
): Promise<{ output: string; error?: string }> {
  const systemPrompt = `模拟代码执行环境。根据代码逻辑，预测输出结果。
只返回输出内容，不要解释。如果代码有错误，返回错误信息。`;

  const userPrompt = `语言：${language}\n输入：${input || '无'}\n\n代码：\n\`\`\`${language}\n${code}\n\`\`\`\n\n请模拟执行并返回输出。`;

  const response = await callAI({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.1
  });

  return {
    output: response.trim(),
    error: response.includes('Error') || response.includes('错误') ? response : undefined
  };
}

/**
 * 生成结构化课程内容（替代旧版 generateCourseContent）
 * 生成真正的游戏组件数据，而不是文本标签
 */
export async function generateStructuredCourseContent(
  courseTitle: string,
  chapterIndex: number,
  totalChapters: number,
  previousContext: string,
  userLevel: string,
  onStream?: (chunk: string) => void
): Promise<StructuredCourseContent> {
  const systemPrompt = `你是AI编程导师，为"${courseTitle}"课程第${chapterIndex + 1}节生成内容。

要求：
1. 生成对话式教学内容，像导师一样一句一句讲解
2. 每句话简短清晰，适合${userLevel}水平
3. 内容结构：讲解→示例→练习→测试→总结
4. 在练习阶段添加代码填空或选择题
5. 返回JSON格式

JSON结构：
{
  "title": "简短标题",
  "description": "简短描述",
  "stages": [
    {
      "id": "stage-1",
      "name": "概念讲解",
      "type": "explanation",
      "content": "Markdown格式的完整讲解",
      "dialogue": [
        {"speaker": "ai", "content": "第一句话", "delay": 1000},
        {"speaker": "ai", "content": "第二句话", "delay": 1500}
      ]
    }
  ]
}

对话要自然分段，每段1-3句话。`;

  const userPrompt = previousContext
    ? `前一节内容概要：${previousContext}\n\n请继续生成第${chapterIndex + 1}节的结构化内容。`
    : `请生成第${chapterIndex + 1}节的结构化内容。`;

  try {
    const response = await callAI({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      stream: !!onStream,
      onStream
    });

    // 尝试解析JSON响应
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : response;
      const parsed = JSON.parse(jsonStr);
      
      // 验证并补全必要字段
      return {
        title: parsed.title || `第${chapterIndex + 1}节：${courseTitle}`,
        description: parsed.description || `学习${courseTitle}的第${chapterIndex + 1}节内容`,
        stages: parsed.stages || generateDefaultStages(courseTitle, chapterIndex),
        estimatedMinutes: parsed.estimatedMinutes || 15,
        xpReward: parsed.xpReward || 100
      };
    } catch (parseError) {
      console.error('解析AI响应失败:', parseError, '响应:', response);
      // 降级处理：返回默认结构
      return generateDefaultStructuredContent(courseTitle, chapterIndex, userLevel);
    }
  } catch (error) {
    console.error('生成结构化内容失败:', error);
    return generateDefaultStructuredContent(courseTitle, chapterIndex, userLevel);
  }
}

/**
 * 生成默认的结构化内容（降级处理）
 */
function generateDefaultStructuredContent(
  courseTitle: string,
  chapterIndex: number,
  userLevel: string
): StructuredCourseContent {
  return {
    title: `第${chapterIndex + 1}节：${courseTitle}基础`,
    description: `学习${courseTitle}的基础知识，适合${userLevel}水平`,
    estimatedMinutes: 15,
    xpReward: 100,
    stages: generateDefaultStages(courseTitle, chapterIndex)
  };
}

/**
 * 生成默认阶段
 */
function generateDefaultStages(courseTitle: string, chapterIndex: number): CourseStage[] {
  const stageTypes: CourseStage['type'][] = ['explanation', 'example', 'practice', 'test', 'summary'];
  const stageNames = ['概念讲解', '代码示例', '动手练习', '知识测试', '本节总结'];
  
  return stageTypes.map((type, index) => ({
    id: `stage-${chapterIndex}-${index}`,
    name: stageNames[index],
    type,
    content: `这是${courseTitle}第${chapterIndex + 1}节的${stageNames[index]}内容。`,
    dialogue: [
      { speaker: 'ai', content: `你好！我是你的编程导师。现在我们来学习${courseTitle}的第${chapterIndex + 1}节。`, delay: 0 },
      { speaker: 'ai', content: `这是${stageNames[index]}部分，请认真学习。`, delay: 1000 }
    ],
    gameComponents: index === 2 ? [ // 在练习阶段添加一个示例游戏组件
      {
        type: 'fill-blank',
        data: {
          code: `// 完成${courseTitle}的基础代码\nfunction example() {\n  console.log("Hello, World!");\n}`,
          blanks: [
            { position: 1, correct: 'function' },
            { position: 2, correct: 'example' }
          ]
        },
        instructions: '请填写缺失的关键字',
        solution: ['function', 'example'],
        hints: ['这是一个函数定义', '函数名应该描述功能']
      }
    ] : undefined
  }));
}

/**
 * 流式生成对话内容（用于实时显示）- 改进版
 * 现在会生成真正的对话式内容，包含AI和用户的交替对话
 */
export async function generateStreamingDialogue(
  topic: string,
  onChunk: (chunk: { speaker: 'ai' | 'user'; content: string; delay?: number }) => void
): Promise<void> {
  const systemPrompt = `你是一个AI编程导师，正在与学生进行对话式教学。
请生成一段关于"${topic}"的教学对话。
对话应该：
1. 包含多个来回（AI和学生的交替对话）
2. 每个对话片段简短（1-2句话）
3. 自然、亲切，像真正的导师一样
4. 包含提问和回答
5. 以JSON格式返回，格式如下：
{
  "dialogue": [
    {"speaker": "ai", "content": "第一句话", "delay": 800},
    {"speaker": "user", "content": "学生回答", "delay": 600},
    {"speaker": "ai", "content": "第二句话", "delay": 800}
  ]
}`;

  try {
    const response = await callAI({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `请生成关于"${topic}"的教学对话，以JSON格式返回。` }
      ],
      temperature: 0.7,
      stream: false
    });

    // 尝试解析JSON响应
    try {
      // 提取JSON部分（可能包含其他文本）
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[0];
        const data = JSON.parse(jsonStr);
        
        if (data.dialogue && Array.isArray(data.dialogue)) {
          // 逐条发送对话
          for (const line of data.dialogue) {
            onChunk({
              speaker: line.speaker || 'ai',
              content: line.content || '',
              delay: line.delay || 800
            });
          }
          return;
        }
      }
    } catch (jsonError) {
      console.warn('JSON解析失败，使用备用方案', jsonError);
    }

    // 备用方案：将响应分割成句子
    const sentences = response.split(/[。！？.!?]/).filter(s => s.trim());
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      if (sentence) {
        // 交替使用AI和用户角色
        const speaker = i % 2 === 0 ? 'ai' : 'user';
        onChunk({
          speaker,
          content: sentence + (response.includes('。') ? '。' : '.'),
          delay: speaker === 'ai' ? 800 : 600
        });
      }
    }
  } catch (error) {
    console.error('生成流式对话失败:', error);
    // 返回一个简单的备用对话
    onChunk({
      speaker: 'ai',
      content: `让我们开始学习${topic}吧！`,
      delay: 800
    });
    onChunk({
      speaker: 'user',
      content: '好的，我准备好了！',
      delay: 600
    });
    onChunk({
      speaker: 'ai',
      content: `首先，我们来了解一下${topic}的基本概念。`,
      delay: 800
    });
  }
}
