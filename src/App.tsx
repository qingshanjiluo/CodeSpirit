/**
 * CodeSpirit 主应用组件
 */

import { useState, useEffect, useCallback } from 'react';
import { openDB } from '@/db';
import { get, STORES } from '@/db';
import { storage, onNetworkChange } from '@/utils';
import { Toaster, toast } from 'sonner';

// 页面组件
import { HomePage } from '@/pages/HomePage';
import { CoursesPage } from '@/pages/CoursesPage';
import { CourseDetailPage } from '@/pages/CourseDetailPage';
import { LearningPage } from '@/pages/LearningPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { NotesPage } from '@/pages/NotesPage';
import { WorksPage } from '@/pages/WorksPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { CreateCoursePage } from '@/pages/CreateCoursePage';

// 全局组件
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { InstallPrompt } from '@/components/InstallPrompt';
import { OfflineIndicator } from '@/components/OfflineIndicator';

export type PageType = 
  | 'home' 
  | 'courses' 
  | 'course-detail' 
  | 'learning' 
  | 'dashboard' 
  | 'notes' 
  | 'works' 
  | 'settings' 
  | 'create-course';

export interface AppState {
  currentPage: PageType;
  selectedCourseId: string | null;
  selectedChapterId: string | null;
  isSidebarOpen: boolean;
  isOffline: boolean;
  isLoading: boolean;
  user: {
    nickname: string;
    avatar: string;
    level: number;
    xp: number;
  } | null;
}

function App() {
  const [state, setState] = useState<AppState>({
    currentPage: 'home',
    selectedCourseId: null,
    selectedChapterId: null,
    isSidebarOpen: true,
    isOffline: !navigator.onLine,
    isLoading: true,
    user: null
  });

  // 初始化数据库
  useEffect(() => {
    const init = async () => {
      // 设置超时，防止无限加载
      const timeoutId = setTimeout(() => {
        console.warn('[App] 初始化超时，强制结束加载状态');
        setState(prev => ({
          ...prev,
          isLoading: false,
          user: {
            nickname: '学习者',
            avatar: '',
            level: 1,
            xp: 0
          }
        }));
      }, 5000); // 5秒超时

      try {
        console.log('[App] 开始初始化数据库...');
        await openDB();
        
        // 加载用户数据
        const stats = await get<{ value: { level: number; xp: number } }>(
          STORES.USER_DATA,
          'stats'
        );
        const profile = await get<{ value: { nickname: string; avatar: string } }>(
          STORES.USER_DATA,
          'profile'
        );

        console.log('[App] 数据库初始化成功', { stats, profile });
        clearTimeout(timeoutId);

        setState(prev => ({
          ...prev,
          isLoading: false,
          user: {
            nickname: profile?.value?.nickname || '学习者',
            avatar: profile?.value?.avatar || '',
            level: stats?.value?.level || 1,
            xp: stats?.value?.xp || 0
          }
        }));

        // 注册 Service Worker
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker
            .register('/sw.js')
            .then(reg => console.log('[App] SW registered:', reg))
            .catch(err => console.error('[App] SW registration failed:', err));
        }
      } catch (error) {
        console.error('[App] Initialization error:', error);
        clearTimeout(timeoutId);
        
        // 即使出错也结束加载状态，显示应用
        setState(prev => ({
          ...prev,
          isLoading: false,
          user: {
            nickname: '学习者',
            avatar: '',
            level: 1,
            xp: 0
          }
        }));
        
        toast.error('初始化遇到问题，部分功能可能受限');
      }
    };

    init();
  }, []);

  // 监听网络状态
  useEffect(() => {
    const unsubscribe = onNetworkChange((online) => {
      setState(prev => ({ ...prev, isOffline: !online }));
      if (online) {
        toast.success('网络已恢复');
      } else {
        toast.warning('进入离线模式，部分功能可能受限');
      }
    });

    return unsubscribe;
  }, []);

  // 页面导航
  const navigate = useCallback((page: PageType, params?: { courseId?: string; chapterId?: string }) => {
    setState(prev => ({
      ...prev,
      currentPage: page,
      selectedCourseId: params?.courseId || prev.selectedCourseId,
      selectedChapterId: params?.chapterId || null
    }));
    window.scrollTo(0, 0);
  }, []);

  // 切换侧边栏
  const toggleSidebar = useCallback(() => {
    setState(prev => ({ ...prev, isSidebarOpen: !prev.isSidebarOpen }));
  }, []);

  // 渲染当前页面
  const renderPage = () => {
    switch (state.currentPage) {
      case 'home':
        return <HomePage onNavigate={navigate} />;
      case 'courses':
        return <CoursesPage onNavigate={navigate} />;
      case 'course-detail':
        return state.selectedCourseId ? (
          <CourseDetailPage 
            courseId={state.selectedCourseId} 
            onNavigate={navigate} 
          />
        ) : (
          <CoursesPage onNavigate={navigate} />
        );
      case 'learning':
        return state.selectedCourseId ? (
          <LearningPage
            courseId={state.selectedCourseId}
            chapterId={state.selectedChapterId}
            onNavigate={navigate}
          />
        ) : (
          <CoursesPage onNavigate={navigate} />
        );
      case 'dashboard':
        return <DashboardPage onNavigate={navigate} />;
      case 'notes':
        return <NotesPage onNavigate={navigate} />;
      case 'works':
        return <WorksPage onNavigate={navigate} />;
      case 'settings':
        return <SettingsPage onNavigate={navigate} />;
      case 'create-course':
        return <CreateCoursePage onNavigate={navigate} />;
      default:
        return <HomePage onNavigate={navigate} />;
    }
  };

  if (state.isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-slate-400">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <Toaster 
        position="top-right" 
        toastOptions={{
          style: {
            background: 'rgba(30, 41, 59, 0.9)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#f8fafc'
          }
        }}
      />
      
      {/* 离线指示器 */}
      <OfflineIndicator isOffline={state.isOffline} />
      
      {/* 安装提示 */}
      <InstallPrompt />

      <div className="flex min-h-screen">
        {/* 侧边栏 */}
        <Sidebar
          currentPage={state.currentPage}
          isOpen={state.isSidebarOpen}
          onNavigate={navigate}
          onToggle={toggleSidebar}
          user={state.user}
        />

        {/* 主内容区 */}
        <div className={`flex-1 flex flex-col transition-all duration-300 ${
          state.isSidebarOpen ? 'ml-64' : 'ml-16'
        }`}>
          {/* 顶部导航 */}
          <Header
            onToggleSidebar={toggleSidebar}
            isSidebarOpen={state.isSidebarOpen}
            user={state.user}
          />

          {/* 页面内容 */}
          <main className="flex-1 p-6 overflow-auto">
            <div className="max-w-7xl mx-auto">
              {renderPage()}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;
