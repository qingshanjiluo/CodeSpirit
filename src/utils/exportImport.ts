/**
 * CodeSpirit 课程导出/导入工具
 */

import { getAll, put, STORES } from '@/db';
import { downloadFile, readFile, encryptData, decryptData, generateId } from '@/utils';
import type { Course, Chapter, ExportData } from '@/types';

/**
 * 导出单个课程
 */
export async function exportCourse(
  course: Course,
  chapters: Chapter[],
  password?: string
): Promise<void> {
  const exportData = {
    version: 1,
    exportDate: new Date().toISOString(),
    type: 'single-course',
    course,
    chapters
  };

  let content = JSON.stringify(exportData, null, 2);

  // 如果设置了密码，加密数据
  if (password) {
    content = await encryptData(content, password);
  }

  const filename = `${course.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}.${password ? 'encrypted' : 'lingcheng'}`;
  downloadFile(content, filename, 'application/json');
}

/**
 * 导出多个课程
 */
export async function exportCourses(
  courses: Course[],
  password?: string
): Promise<void> {
  const allChapters = await getAll<Chapter>(STORES.CHAPTERS);
  
  const exportData = {
    version: 1,
    exportDate: new Date().toISOString(),
    type: 'multi-course',
    courses,
    chapters: allChapters.filter(c => courses.some(course => course.id === c.courseId))
  };

  let content = JSON.stringify(exportData, null, 2);

  if (password) {
    content = await encryptData(content, password);
  }

  const filename = `courses_${new Date().toISOString().split('T')[0]}.${password ? 'encrypted' : 'lingcheng'}`;
  downloadFile(content, filename, 'application/json');
}

/**
 * 导出所有数据（完整备份）
 */
export async function exportAllData(password?: string): Promise<void> {
  const userData = await getAll(STORES.USER_DATA);
  const statsItem = userData.find((d: any) => d.key === 'stats');
  
  const data = {
    version: 1,
    exportDate: new Date().toISOString(),
    courses: await getAll(STORES.COURSES),
    chapters: await getAll(STORES.CHAPTERS),
    notes: await getAll(STORES.NOTES),
    works: await getAll(STORES.WORKS),
    progress: await getAll(STORES.PROGRESS),
    stats: statsItem ? (statsItem as any).value : {}
  };

  let content = JSON.stringify(data, null, 2);

  if (password) {
    content = await encryptData(content, password);
  }

  const filename = `codespirit_backup_${new Date().toISOString().split('T')[0]}.${password ? 'encrypted' : 'json'}`;
  downloadFile(content, filename, 'application/json');
}

/**
 * 导入课程
 */
export async function importCourse(
  file: File,
  password?: string
): Promise<{ course: Course; chapters: Chapter[] }> {
  const content = await readFile(file);
  let data: any;

  try {
    // 尝试解析为JSON
    data = JSON.parse(content);
  } catch {
    // 如果不是JSON，尝试解密
    if (!password) {
      throw new Error('此文件需要密码才能导入');
    }
    const decrypted = await decryptData(content, password);
    data = JSON.parse(decrypted);
  }

  // 验证数据结构
  if (!data.course || !data.chapters) {
    throw new Error('无效的课程文件格式');
  }

  // 生成新的ID避免冲突
  const newCourseId = generateId();
  
  const course: Course = {
    ...data.course,
    id: newCourseId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastStudiedAt: null,
    completedChapters: 0,
    status: 'active'
  };

  const chapters: Chapter[] = data.chapters.map((c: Chapter) => ({
    ...c,
    id: generateId(),
    courseId: newCourseId,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }));

  // 保存到数据库
  await put(STORES.COURSES, course);
  for (const chapter of chapters) {
    await put(STORES.CHAPTERS, chapter);
  }

  return { course, chapters };
}

/**
 * 导入完整备份
 */
export async function importBackup(
  file: File,
  mode: 'merge' | 'overwrite' = 'merge',
  password?: string
): Promise<void> {
  const content = await readFile(file);
  let data: ExportData;

  try {
    data = JSON.parse(content);
  } catch {
    if (!password) {
      throw new Error('此备份需要密码才能导入');
    }
    const decrypted = await decryptData(content, password);
    data = JSON.parse(decrypted);
  }

  if (mode === 'overwrite') {
    // 清空现有数据 - 简化处理，实际应用中需要实现删除逻辑
    console.log('Overwrite mode - clearing existing data');
  }

  // 导入数据
  if (data.courses) {
    for (const course of data.courses) {
      await put(STORES.COURSES, { ...course, id: generateId() });
    }
  }

  if (data.chapters) {
    for (const chapter of data.chapters) {
      await put(STORES.CHAPTERS, { ...chapter, id: generateId() });
    }
  }

  if (data.notes) {
    for (const note of data.notes) {
      await put(STORES.NOTES, { ...note, id: generateId() });
    }
  }

  if (data.works) {
    for (const work of data.works) {
      await put(STORES.WORKS, { ...work, id: generateId() });
    }
  }
}

/**
 * 分享课程（生成分享链接）
 */
export async function shareCourse(
  course: Course,
  chapters: Chapter[],
  options: {
    password?: string;
    watermark?: string;
    expireDays?: number;
  } = {}
): Promise<string> {
  const shareData = {
    version: 1,
    shareDate: new Date().toISOString(),
    expireAt: options.expireDays 
      ? new Date(Date.now() + options.expireDays * 86400000).toISOString()
      : null,
    watermark: options.watermark,
    course: {
      ...course,
      creatorInfo: {
        name: options.watermark || '匿名用户',
        watermark: options.watermark
      }
    },
    chapters
  };

  let content = JSON.stringify(shareData);

  if (options.password) {
    content = await encryptData(content, options.password);
  }

  // 压缩并转为 Base64
  const compressed = btoa(content);
  
  // 生成分享链接
  const shareUrl = `${window.location.origin}/import?data=${encodeURIComponent(compressed)}`;
  
  return shareUrl;
}
