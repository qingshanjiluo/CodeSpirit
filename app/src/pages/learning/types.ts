/**
 * 学习页面共享类型定义
 */
import type { AIMessage } from '@/types';

export interface ChatMessage extends AIMessage {
  id?: string;
}

export interface GameComponentData {
  type: 'fill-blank' | 'puzzle' | 'drag-drop' | 'multi-choice' | 'maze' | 'code-exec' | 'mini-project';
  data: any;
  instructions: string;
  solution?: any;
  hints?: string[];
}

export interface StageInfo {
  id: string;
  name: string;
  type: 'explanation' | 'example' | 'practice' | 'test' | 'summary';
  content: string;
  completed?: boolean;
}
