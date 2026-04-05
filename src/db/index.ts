/**
 * CodeSpirit IndexedDB 数据库模块 - 修复版本
 * 管理课程、章节、用户数据、笔记、作品等
 */

const DB_NAME = 'CodeSpiritDB';
const DB_VERSION = 1;

// 数据库表名
export const STORES = {
  COURSES: 'courses',
  CHAPTERS: 'chapters',
  USER_DATA: 'userData',
  NOTES: 'notes',
  WORKS: 'works',
  PROGRESS: 'progress',
  SETTINGS: 'settings',
  AI_CONFIG: 'aiConfig',
  STATS: 'stats',
  DIALOGUES: 'dialogues'
} as const;

// 数据库连接实例
let dbInstance: IDBDatabase | null = null;
let dbOpeningPromise: Promise<IDBDatabase> | null = null;

/**
 * 打开数据库连接（修复版本）
 */
export function openDB(): Promise<IDBDatabase> {
  // 如果已有实例，直接返回
  if (dbInstance) return Promise.resolve(dbInstance);
  
  // 如果正在打开中，等待同一个Promise
  if (dbOpeningPromise) {
    return dbOpeningPromise;
  }

  dbOpeningPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[DB] Failed to open database:', request.error);
      dbOpeningPromise = null;
      reject(request.error);
    };
    
    request.onblocked = () => {
      console.warn('[DB] Database opening blocked by other connections');
    };

    request.onsuccess = () => {
      console.log('[DB] Database opened successfully');
      dbInstance = request.result;
      dbOpeningPromise = null;
      
      dbInstance.onclose = () => {
        console.log('[DB] Database connection closed');
        dbInstance = null;
      };
      
      dbInstance.onerror = (event) => {
        console.error('[DB] Database error:', event);
      };
      
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      console.log('[DB] Database upgrade needed, version:', event.oldVersion, '→', DB_VERSION);
      const db = (event.target as IDBOpenDBRequest).result;
      const oldVersion = event.oldVersion;

      // 创建课程表
      if (!db.objectStoreNames.contains(STORES.COURSES)) {
        const courseStore = db.createObjectStore(STORES.COURSES, { keyPath: 'id' });
        courseStore.createIndex('createdAt', 'createdAt', { unique: false });
        courseStore.createIndex('language', 'language', { unique: false });
        courseStore.createIndex('status', 'status', { unique: false });
      }

      // 创建章节表
      if (!db.objectStoreNames.contains(STORES.CHAPTERS)) {
        const chapterStore = db.createObjectStore(STORES.CHAPTERS, { keyPath: 'id' });
        chapterStore.createIndex('courseId', 'courseId', { unique: false });
        chapterStore.createIndex('order', 'order', { unique: false });
        chapterStore.createIndex('status', 'status', { unique: false });
      }

      // 创建用户数据表（key-value存储）
      if (!db.objectStoreNames.contains(STORES.USER_DATA)) {
        const userDataStore = db.createObjectStore(STORES.USER_DATA, { keyPath: 'key' });
        userDataStore.createIndex('category', 'category', { unique: false });
      }

      // 创建笔记表
      if (!db.objectStoreNames.contains(STORES.NOTES)) {
        const noteStore = db.createObjectStore(STORES.NOTES, { keyPath: 'id' });
        noteStore.createIndex('courseId', 'courseId', { unique: false });
        noteStore.createIndex('chapterId', 'chapterId', { unique: false });
        noteStore.createIndex('category', 'category', { unique: false });
        noteStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // 创建作品表
      if (!db.objectStoreNames.contains(STORES.WORKS)) {
        const workStore = db.createObjectStore(STORES.WORKS, { keyPath: 'id' });
        workStore.createIndex('courseId', 'courseId', { unique: false });
        workStore.createIndex('category', 'category', { unique: false });
        workStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // 创建进度表
      if (!db.objectStoreNames.contains(STORES.PROGRESS)) {
        const progressStore = db.createObjectStore(STORES.PROGRESS, { keyPath: 'id' });
        progressStore.createIndex('courseId', 'courseId', { unique: false });
        progressStore.createIndex('chapterId', 'chapterId', { unique: false });
        progressStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // 创建设置表
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }

      // 创建AI配置表
      if (!db.objectStoreNames.contains(STORES.AI_CONFIG)) {
        db.createObjectStore(STORES.AI_CONFIG, { keyPath: 'key' });
      }

      // 创建统计表
      if (!db.objectStoreNames.contains(STORES.STATS)) {
        const statsStore = db.createObjectStore(STORES.STATS, { keyPath: 'key' });
        statsStore.createIndex('date', 'date', { unique: false });
      }
    
      // 创建对话表（新增）
      if (!db.objectStoreNames.contains('dialogues')) {
        const dialogueStore = db.createObjectStore('dialogues', { keyPath: 'id' });
        dialogueStore.createIndex('courseId', 'courseId', { unique: false });
        dialogueStore.createIndex('chapterId', 'chapterId', { unique: false });
        dialogueStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // 数据迁移逻辑
      if (oldVersion < 1) {
        // 简化初始化，避免事务冲突
        try {
          // 初始化用户数据
          const userDataTx = db.transaction(STORES.USER_DATA, 'readwrite');
          const userDataStore = userDataTx.objectStore(STORES.USER_DATA);
          
          const defaultStats = {
            key: 'stats',
            category: 'stats',
            value: { xp: 0, level: 1 },
            updatedAt: Date.now()
          };
          userDataStore.put(defaultStats);
          
          const defaultProfile = {
            key: 'profile',
            category: 'profile',
            value: { nickname: '学习者', avatar: '' },
            updatedAt: Date.now()
          };
          userDataStore.put(defaultProfile);

          // 初始化AI配置
          const aiConfigTx = db.transaction(STORES.AI_CONFIG, 'readwrite');
          const aiConfigStore = aiConfigTx.objectStore(STORES.AI_CONFIG);
          
          const defaultAIConfig = {
            key: 'aiConfig',
            category: 'aiConfig',
            value: {
              provider: 'deepseek',
              endpoint: 'https://api.deepseek.com/chat/completions',
              model: 'deepseek-chat',
              apiKeys: [],
              temperature: 0.7,
              maxTokens: 4096,
              keyIndex: 0
            },
            updatedAt: Date.now()
          };
          aiConfigStore.put(defaultAIConfig);

          console.log('[DB] 默认AI配置已初始化');
        } catch (error) {
          console.warn('[DB] Failed to initialize default data:', error);
        }
      }
    };
  });

  return dbOpeningPromise;
}

/**
 * 通用CRUD操作 - 简化版本
 */
export async function get<T>(storeName: string, key: string): Promise<T | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[DB] Get operation failed:', error);
    return null;
  }
}

export async function getAll<T>(storeName: string): Promise<T[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[DB] GetAll operation failed:', error);
    return [];
  }
}

/**
 * 插入或更新数据
 */
export async function put(storeName: string, data: any): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[DB] Put operation failed:', error);
    throw error;
  }
}

/**
 * 通过索引查询数据
 */
export async function getByIndex<T>(
  storeName: string,
  indexName: string,
  key: any
): Promise<T | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.get(key);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[DB] GetByIndex operation failed:', error);
    return null;
  }
}

/**
 * 通过索引获取所有数据
 */
export async function getAllByIndex<T>(
  storeName: string,
  indexName: string,
  key: any
): Promise<T[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(key);

      request.onsuccess = () => {
        const result = request.result;
        console.log(`[DB] getAllByIndex: store=${storeName}, index=${indexName}, key=${key}, result=`, result);
        
        // 确保返回数组
        if (!result) {
          console.log('[DB] 结果为空，返回空数组');
          resolve([]);
        } else if (Array.isArray(result)) {
          console.log(`[DB] 返回数组，长度: ${result.length}`);
          resolve(result);
        } else {
          console.log('[DB] 结果不是数组，包装成数组');
          resolve([result]);
        }
      };
      
      request.onerror = () => {
        console.error('[DB] getAllByIndex error:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[DB] GetAllByIndex operation failed:', error);
    return [];
  }
}

/**
 * 删除数据
 */
export async function remove(storeName: string, key: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[DB] Remove operation failed:', error);
    throw error;
  }
}

/**
 * 清空表
 */
export async function clear(storeName: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[DB] Clear operation failed:', error);
    throw error;
  }
}

/**
 * 获取表记录数量
 */
export async function count(storeName: string): Promise<number> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[DB] Count operation failed:', error);
    return 0;
  }
}

/**
 * 重置所有数据（清空所有表）
 */
export async function resetAllData(): Promise<void> {
  try {
    const db = await openDB();
    
    // 创建事务批量清空所有表
    const transaction = db.transaction([
      STORES.COURSES,
      STORES.CHAPTERS,
      STORES.USER_DATA,
      STORES.NOTES,
      STORES.WORKS,
      STORES.PROGRESS,
      STORES.SETTINGS,
      STORES.AI_CONFIG,
      STORES.STATS
    ], 'readwrite');
    
    const promises = [];
    
    // 清空每个表
    for (const storeName of [
      STORES.COURSES,
      STORES.CHAPTERS,
      STORES.USER_DATA,
      STORES.NOTES,
      STORES.WORKS,
      STORES.PROGRESS,
      STORES.SETTINGS,
      STORES.AI_CONFIG,
      STORES.STATS
    ]) {
      const store = transaction.objectStore(storeName);
      promises.push(new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve(null);
        request.onerror = () => reject(request.error);
      }));
    }
    
    await Promise.all(promises);
    console.log('[DB] All data reset successfully');
  } catch (error) {
    console.error('[DB] Reset all data failed:', error);
    throw error;
  }
}

/**
 * 保存对话记录
 */
export async function saveDialogue(dialogue: {
  id: string;
  courseId: string;
  chapterId: string;
  messages: any[];
  title?: string;
  createdAt?: number;
}): Promise<void> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.DIALOGUES, 'readwrite');
    const store = transaction.objectStore(STORES.DIALOGUES);
    
    const dialogueData = {
      ...dialogue,
      createdAt: dialogue.createdAt || Date.now(),
      updatedAt: Date.now()
    };
    
    const request = store.put(dialogueData);
    
    request.onsuccess = () => {
      console.log('[DB] Dialogue saved:', dialogue.id);
      resolve();
    };
    
    request.onerror = () => {
      console.error('[DB] Failed to save dialogue:', request.error);
      reject(request.error);
    };
  });
}

/**
 * 获取课程的对话记录
 */
export async function getDialoguesByCourse(courseId: string): Promise<any[]> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.DIALOGUES, 'readonly');
    const store = transaction.objectStore(STORES.DIALOGUES);
    const index = store.index('courseId');
    
    const request = index.getAll(courseId);
    
    request.onsuccess = () => {
      resolve(request.result || []);
    };
    
    request.onerror = () => {
      console.error('[DB] Failed to get dialogues:', request.error);
      reject(request.error);
    };
  });
}

/**
 * 获取章节的对话记录
 */
export async function getDialoguesByChapter(courseId: string, chapterId: string): Promise<any[]> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.DIALOGUES, 'readonly');
    const store = transaction.objectStore(STORES.DIALOGUES);
    
    // 需要手动过滤，因为IndexedDB不支持复合索引查询
    const request = store.getAll();
    
    request.onsuccess = () => {
      const dialogues = request.result || [];
      const filtered = dialogues.filter(d =>
        d.courseId === courseId && d.chapterId === chapterId
      );
      resolve(filtered);
    };
    
    request.onerror = () => {
      console.error('[DB] Failed to get dialogues:', request.error);
      reject(request.error);
    };
  });
}

/**
 * 获取最新的对话记录
 */
export async function getLatestDialogue(courseId: string, chapterId: string): Promise<any | null> {
  const dialogues = await getDialoguesByChapter(courseId, chapterId);
  if (dialogues.length === 0) return null;
  
  // 按创建时间排序，返回最新的
  dialogues.sort((a, b) => b.createdAt - a.createdAt);
  return dialogues[0];
}

/**
 * 删除对话记录
 */
export async function deleteDialogue(dialogueId: string): Promise<void> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.DIALOGUES, 'readwrite');
    const store = transaction.objectStore(STORES.DIALOGUES);
    
    const request = store.delete(dialogueId);
    
    request.onsuccess = () => {
      console.log('[DB] Dialogue deleted:', dialogueId);
      resolve();
    };
    
    request.onerror = () => {
      console.error('[DB] Failed to delete dialogue:', request.error);
      reject(request.error);
    };
  });
}