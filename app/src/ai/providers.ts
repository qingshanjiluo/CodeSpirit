/**
 * AI Provider 配置与适配器
 * 所有 Provider 统一使用 OpenAI-compatible 格式
 * endpoint 填写 base URL（如 https://api.deepseek.com/v1），内部自动追加 /chat/completions
 */

import { get, STORES } from '@/db';

export type AIProvider = 'deepseek' | 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'kimi' | 'qwen' | 'custom';

export interface ProviderConfig {
  name: string;
  defaultEndpoint: string; // base URL，如 https://api.deepseek.com/v1
  defaultModel: string;
  supportsStream: boolean;
}

export const PROVIDER_PRESETS: Record<AIProvider, ProviderConfig> = {
  deepseek: {
    name: 'DeepSeek',
    defaultEndpoint: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    supportsStream: true,
  },
  openai: {
    name: 'OpenAI',
    defaultEndpoint: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    supportsStream: true,
  },
  anthropic: {
    name: 'Anthropic Claude',
    defaultEndpoint: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-sonnet-20240229',
    supportsStream: true,
  },
  gemini: {
    name: 'Google Gemini',
    defaultEndpoint: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-1.5-flash',
    supportsStream: true,
  },
  ollama: {
    name: 'Ollama (本地)',
    defaultEndpoint: 'http://localhost:11434/v1',
    defaultModel: 'llama3',
    supportsStream: true,
  },
  kimi: {
    name: 'Kimi (Moonshot)',
    defaultEndpoint: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
    supportsStream: true,
  },
  qwen: {
    name: '通义千问 (Qwen)',
    defaultEndpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-turbo',
    supportsStream: true,
  },
  custom: {
    name: '自定义',
    defaultEndpoint: '',
    defaultModel: '',
    supportsStream: true,
  },
};

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * 构建请求头 - 统一 OpenAI-compatible 格式
 */
export function buildHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };
}

/**
 * 构建请求体 - 统一 OpenAI-compatible 格式
 */
export function buildBody(
  model: string,
  messages: Message[],
  temperature: number,
  maxTokens: number,
  stream: boolean
): any {
  return {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream,
  };
}

/**
 * 构建完整请求 URL - 在 base endpoint 后追加 /chat/completions
 */
export function buildUrl(endpoint: string): string {
  // 移除末尾斜杠
  const base = endpoint.replace(/\/+$/, '');
  return `${base}/chat/completions`;
}

/**
 * 解析响应 - 统一 OpenAI-compatible 格式
 */
export function parseResponse(data: any): { content: string; tokens?: number } {
  return {
    content: data.choices?.[0]?.message?.content || '',
    tokens: data.usage?.total_tokens,
  };
}

/**
 * 解析流式响应块 - 统一 OpenAI-compatible 格式
 */
export function parseStreamChunk(parsed: any): string {
  return parsed.choices?.[0]?.delta?.content || '';
}

/**
 * 获取当前配置的 provider
 */
export async function getProvider(): Promise<AIProvider> {
  const config = await get<{ value: { provider?: string } }>(STORES.AI_CONFIG, 'aiConfig');
  return (config?.value?.provider as AIProvider) || 'deepseek';
}
