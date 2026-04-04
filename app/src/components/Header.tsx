/**
 * CodeSpirit 顶部导航组件
 */

import { Menu, Bell, Search, Flame, Trophy, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
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

export function Header({ onToggleSidebar, isSidebarOpen, user }: HeaderProps) {
  const [stats, setStats] = useState({
    streakDays: 0,
    totalXp: 0,
    badges: 0
  });

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
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </Button>
      </div>
    </header>
  );
}
