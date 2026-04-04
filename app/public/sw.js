/**
 * CodeSpirit Service Worker
 * 缓存策略：静态资源 + 课程数据
 * 支持离线学习体验
 */

const CACHE_NAME = 'codespirit-v1';
const STATIC_CACHE = 'codespirit-static-v1';
const COURSE_CACHE = 'codespirit-courses-v1';
const IMAGE_CACHE = 'codespirit-images-v1';

// 静态资源列表（构建后自动生成）
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico'
];

// 安装时缓存核心资源
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        // 使用更安全的缓存方式，避免单个资源失败导致整个安装失败
        return Promise.allSettled(
          STATIC_ASSETS.map(asset =>
            cache.add(asset).catch(err => {
              console.warn(`[SW] Failed to cache ${asset}:`, err);
              return null;
            })
          )
        ).then(() => cache);
      })
      .then(() => {
        console.log('[SW] Installation complete');
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('[SW] Installation failed:', err);
        // 即使缓存失败也继续安装
        return self.skipWaiting();
      })
  );
});

// 激活时清理旧缓存
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return name.startsWith('codespirit-') && 
                   name !== STATIC_CACHE && 
                   name !== COURSE_CACHE &&
                   name !== IMAGE_CACHE;
          })
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// 网络请求拦截
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 跳过非GET请求
  if (request.method !== 'GET') {
    return;
  }

  // API请求：网络优先，失败时返回离线提示
  if (url.pathname.startsWith('/api/') || url.hostname.includes('api.')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // 课程数据：缓存优先，后台更新
  if (url.pathname.includes('/courses/') || url.pathname.endsWith('.lingcheng')) {
    event.respondWith(cacheFirst(request, COURSE_CACHE));
    return;
  }

  // 图片资源：缓存优先
  if (request.destination === 'image') {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  // 静态资源：缓存优先
  if (request.destination === 'script' || 
      request.destination === 'style' ||
      request.destination === 'document') {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // 其他请求：网络优先
  event.respondWith(networkFirst(request));
});

// 缓存优先策略
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  if (cached) {
    // 后台更新缓存
    fetch(request).then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
    }).catch(() => {});
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[SW] Network failed for:', request.url);
    return new Response('Offline', { status: 503 });
  }
}

// 网络优先策略
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    return new Response('Offline', { status: 503 });
  }
}

// 后台同步（用于离线数据同步）
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-progress') {
    event.waitUntil(syncProgress());
  }
});

async function syncProgress() {
  // 同步学习进度到服务器（如果有后端）
  console.log('[SW] Syncing progress...');
}

// 推送通知（可选功能）
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        data: data.data,
        actions: data.actions || []
      })
    );
  }
});

// 通知点击处理
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});

// 消息处理（来自主线程）
self.addEventListener('message', (event) => {
  if (event.data.type === 'CACHE_COURSE') {
    cacheCourse(event.data.courseId, event.data.data);
  } else if (event.data.type === 'GET_CACHED_COURSE') {
    getCachedCourse(event.data.courseId).then((data) => {
      event.ports[0].postMessage({ data });
    });
  } else if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 缓存课程数据
async function cacheCourse(courseId, data) {
  const cache = await caches.open(COURSE_CACHE);
  const response = new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' }
  });
  await cache.put(`/courses/${courseId}`, response);
  console.log('[SW] Course cached:', courseId);
}

// 获取缓存的课程
async function getCachedCourse(courseId) {
  const cache = await caches.open(COURSE_CACHE);
  const response = await cache.match(`/courses/${courseId}`);
  if (response) {
    return response.json();
  }
  return null;
}
