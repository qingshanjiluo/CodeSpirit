/**
 * CodeSpirit 工具函数
 */

import type { UserStats, Badge, CheckInRecord } from '@/types';

/**
 * 生成唯一ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 格式化日期
 */
export function formatDate(timestamp: number | string | Date, format = 'YYYY-MM-DD'): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes);
}

/**
 * 格式化时长（分钟转可读字符串）
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}分钟`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours}小时`;
  }
  return `${hours}小时${mins}分钟`;
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => void>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * 深拷贝
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * 下载文件
 */
export function downloadFile(content: string | Blob, filename: string, type?: string): void {
  const blob = content instanceof Blob 
    ? content 
    : new Blob([content], { type: type || 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 读取文件内容
 */
export function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

/**
 * 读取图片文件为 Data URL
 */
export function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 压缩图片
 */
export function compressImage(
  dataUrl: string,
  maxWidth: number = 800,
  quality: number = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * AES-GCM 加密
 */
export async function encryptData(data: string, password: string): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  // 从密码生成密钥
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(data)
  );

  // 组合 salt + iv + ciphertext
  const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  result.set(salt);
  result.set(iv, salt.length);
  result.set(new Uint8Array(encrypted), salt.length + iv.length);

  return btoa(String.fromCharCode(...result));
}

/**
 * AES-GCM 解密
 */
export async function decryptData(encryptedData: string, password: string): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const data = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

  const salt = data.slice(0, 16);
  const iv = data.slice(16, 28);
  const ciphertext = data.slice(28);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  return decoder.decode(decrypted);
}

/**
 * 计算等级
 */
export function calculateLevel(xp: number): { level: number; currentLevelXp: number; nextLevelXp: number } {
  const xpPerLevel = 200;
  const level = Math.floor(xp / xpPerLevel) + 1;
  const currentLevelXp = xp % xpPerLevel;
  const nextLevelXp = xpPerLevel;
  return { level, currentLevelXp, nextLevelXp };
}

/**
 * 检查是否升级
 */
export function checkLevelUp(oldXp: number, newXp: number): boolean {
  const oldLevel = Math.floor(oldXp / 200) + 1;
  const newLevel = Math.floor(newXp / 200) + 1;
  return newLevel > oldLevel;
}

/**
 * 计算连续打卡天数
 */
export function calculateStreak(checkInHistory: CheckInRecord[]): number {
  if (checkInHistory.length === 0) return 0;

  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  const dates = checkInHistory.map(r => r.date).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );

  if (dates[0] !== today && dates[0] !== yesterday) {
    return 0;
  }

  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const diff = (prev.getTime() - curr.getTime()) / 86400000;
    if (diff === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * 检查今日是否已打卡
 */
export function hasCheckedInToday(checkInHistory: CheckInRecord[]): boolean {
  const today = new Date().toDateString();
  return checkInHistory.some(r => r.date === today);
}

/**
 * 生成徽章
 */
export function generateBadges(stats: UserStats): Badge[] {
  const badges: Badge[] = [];

  // 首次学习徽章
  if (stats.totalStudyTime > 0) {
    badges.push({
      id: 'first-step',
      name: '初出茅庐',
      description: '完成首次学习',
      icon: '🌱',
      unlockedAt: Date.now(),
      category: 'milestone'
    });
  }

  // 连续打卡徽章
  if (stats.streakDays >= 7) {
    badges.push({
      id: 'week-streak',
      name: '坚持不懈',
      description: '连续打卡7天',
      icon: '🔥',
      unlockedAt: Date.now(),
      category: 'achievement'
    });
  }

  if (stats.streakDays >= 30) {
    badges.push({
      id: 'month-streak',
      name: '学习达人',
      description: '连续打卡30天',
      icon: '⭐',
      unlockedAt: Date.now(),
      category: 'achievement'
    });
  }

  // 课程完成徽章
  if (stats.coursesCompleted >= 1) {
    badges.push({
      id: 'course-complete',
      name: '课程结业',
      description: '完成首个课程',
      icon: '🎓',
      unlockedAt: Date.now(),
      category: 'milestone'
    });
  }

  // 代码提交徽章
  if (stats.totalCodeSubmissions >= 100) {
    badges.push({
      id: 'code-master',
      name: '代码大师',
      description: '提交代码100次',
      icon: '💻',
      unlockedAt: Date.now(),
      category: 'achievement'
    });
  }

  // 等级徽章
  if (stats.level >= 10) {
    badges.push({
      id: 'level-10',
      name: '进阶学习者',
      description: '达到10级',
      icon: '🏆',
      unlockedAt: Date.now(),
      category: 'milestone'
    });
  }

  return badges;
}

/**
 * 解析课程内容中的游戏组件
 */
export function parseGameComponents(content: string): Array<{ type: string; content: string; data?: any }> {
  const games: Array<{ type: string; content: string; data?: any }> = [];
  const gameRegex = /<game-(\w+)[^>]*>([\s\S]*?)<\/game-\1>/g;
  let match;

  while ((match = gameRegex.exec(content)) !== null) {
    const [, type, innerContent] = match;
    let data = {};
    try {
      const dataAttr = match[0].match(/data='([^']*)'/);
      if (dataAttr) {
        data = JSON.parse(dataAttr[1]);
      }
    } catch {
      // 忽略解析错误
    }

    games.push({
      type: `game-${type}`,
      content: innerContent.trim(),
      data
    });
  }

  return games;
}

/**
 * 解析代码编辑器标记
 */
export function parseCodeEditors(content: string): Array<{ language: string; code: string }> {
  const editors: Array<{ language: string; code: string }> = [];
  const regex = /<code-editor\s+lang="([^"]*)"[^>]*>([\s\S]*?)<\/code-editor>/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    editors.push({
      language: match[1],
      code: match[2].trim()
    });
  }

  return editors;
}

/**
 * 本地存储封装（带类型）
 */
export const storage = {
  get<T>(key: string, defaultValue?: T): T | undefined {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  },

  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Storage set error:', e);
    }
  },

  remove(key: string): void {
    localStorage.removeItem(key);
  },

  clear(): void {
    localStorage.clear();
  }
};

/**
 * 检测网络状态
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * 监听网络状态变化
 */
export function onNetworkChange(callback: (online: boolean) => void): () => void {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

/**
 * 语音合成（TTS）
 */
export function speak(text: string, lang = 'zh-CN'): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      reject(new Error('浏览器不支持语音合成'));
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.onend = () => resolve();
    utterance.onerror = reject;
    speechSynthesis.speak(utterance);
  });
}

/**
 * 语音识别
 */
export function startSpeechRecognition(
  onResult: (text: string) => void,
  onError?: (error: Error) => void,
  lang = 'zh-CN'
): { stop: () => void } {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    onError?.(new Error('浏览器不支持语音识别'));
    return { stop: () => {} };
  }

  const recognition = new SpeechRecognition();
  recognition.lang = lang;
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onresult = (event: any) => {
    const text = event.results[0][0].transcript;
    onResult(text);
  };

  recognition.onerror = (event: any) => {
    onError?.(new Error(event.error));
  };

  recognition.start();

  return {
    stop: () => recognition.stop()
  };
}
