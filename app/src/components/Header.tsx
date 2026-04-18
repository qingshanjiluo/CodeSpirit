/**
 * CodeSpirit 顶部导航组件
 */

import { Menu, Bell, Search, Flame, Trophy, Zap, X, CheckCircle2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState, useEffect, useRef } from 'react';
import { get, STORES } from '@/db';

interface HeaderProps {
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  user: {
    nickname: string;
    avatar: string;
    level: number;
    xp: number;
  } | null;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning';
  read: boolean;
  time: string;
}

export function Header({ onToggleSidebar, isSidebarOpen, user }: HeaderProps) {
  const [stats, setStats] = useState({
    streakDays: 0,
    totalXp: 0,
    badges: 0
  });
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([
    { id: '1', title: '欢迎回来', message: '今天也是学习的好日子！', type: 'info', read: false, time: '刚刚' },
    { id: '2', title: '新课程', message: '你创建的课程已准备就绪', type: 'success', read: false, time: '10分钟前' },
  ]);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadStats = async () => {
      const userStats = await get<{ value: { streakDays: number; xp: number; badges: Array<any> } }>(
        STORES.USER_DATA,
        'stats'
      );
      if (userStats) {
        setStats({
          streakDays: userStats.value.streakDays || 0,
          totalXp: userStats.value.xp || 0,
          badges: userStats.value.badges?.length || 0
        });
      }
    };
    loadStats();
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  return (
    <header className="h-16 glass-panel border-b border-slate-700/50 flex items-center justify-between px-6 sticky top-0 z-30">
      {/* 左侧 */}
      <div className="flex items-center gap-4">
        {!isSidebarOpen && (
          <Button variant="ghost" size="icon" onClick={onToggleSidebar}>
            <Menu className="w-5 h-5" />
          </Button>
        )}
        
        {/* 搜索框 */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="搜索课程、笔记..."
            className="pl-10 w-64 bg-slate-800/50 border-slate-700"
          />
        </div>
      </div>

      {/* 右侧统计 */}
      <div className="flex items-center gap-6">
        {/* 连续打卡 */}
        <div className="flex items-center gap-2 text-orange-400">
          <Flame className="w-5 h-5" />
          <span className="font-bold">{stats.streakDays}</span>
          <span className="text-sm text-slate-400 hidden sm:inline">天</span>
        </div>

        {/* 总经验值 */}
        <div className="flex items-center gap-2 text-yellow-400">
          <Zap className="w-5 h-5" />
          <span className="font-bold">{stats.totalXp}</span>
          <span className="text-sm text-slate-400 hidden sm:inline">XP</span>
        </div>

        {/* 徽章数 */}
        <div className="flex items-center gap-2 text-purple-400">
          <Trophy className="w-5 h-5" />
          <span className="font-bold">{stats.badges}</span>
        </div>

        {/* 通知 */}
        <div className="relative" ref={notifRef}>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </Button>

          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-80 glass-panel rounded-xl border border-slate-700/50 shadow-xl overflow-hidden z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/30">
                <span className="font-medium text-sm">通知</span>
                <button onClick={clearAll} className="text-xs text-slate-400 hover:text-slate-200">
                  清空全部
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-500">
                    暂无通知
                  </div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => markAsRead(n.id)}
                      className={`px-4 py-3 border-b border-slate-700/20 cursor-pointer hover:bg-slate-800/30 transition-colors ${
                        !n.read ? 'bg-slate-800/20' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {n.type === 'success' ? (
                          <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                        ) : (
                          <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{n.title}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{n.message}</p>
                          <p className="text-[10px] text-slate-500 mt-1">{n.time}</p>
                        </div>
                        {!n.read && <span className="w-2 h-2 bg-indigo-400 rounded-full shrink-0 mt-1.5" />}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
