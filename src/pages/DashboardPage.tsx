/**
 * CodeSpirit 学习看板页面
 */

import { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Target,
  Zap,
  Trophy,
  Flame,
  Code2,
  Calendar
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { get, getAll, STORES } from '@/db';
import { getAIStats } from '@/ai';
import type { UserStats, Course, Badge as BadgeType } from '@/types';
import type { PageType } from '@/App';

interface DashboardPageProps {
  onNavigate: (page: PageType, params?: any) => void;
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [aiStats, setAiStats] = useState({ totalCalls: 0, todayCalls: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // 加载用户统计
      const userStats = await get<{ value: UserStats }>(STORES.USER_DATA, 'stats');
      if (userStats) {
        setStats(userStats.value);
      }

      // 加载课程
      const coursesData = await getAll<Course>(STORES.COURSES);
      setCourses(coursesData);

      // 加载AI统计
      setAiStats(getAIStats());
    } catch (error) {
      console.error('[DashboardPage] Load error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getWeeklyData = () => {
    if (!stats) return [];
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const today = new Date();
    const data = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toDateString();
      
      const checkIn = stats.checkInHistory.find(h => h.date === dateStr);
      data.push({
        day: days[date.getDay()],
        xp: checkIn ? checkIn.xpEarned : 0,
        studied: !!checkIn
      });
    }
    
    return data;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton h-32 rounded-xl" />
          ))}
        </div>
        <div className="skeleton h-96 rounded-xl" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-16">
        <BarChart3 className="w-16 h-16 text-slate-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold">暂无数据</h3>
        <p className="text-slate-400 mt-2">开始学习后，你的进度统计将显示在这里</p>
      </div>
    );
  }

  const weeklyData = getWeeklyData();
  const activeCourses = courses.filter(c => c.status === 'active').length;
  const completedCourses = courses.filter(c => c.status === 'completed').length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-indigo-400" />
          学习看板
        </h1>
        <p className="text-slate-400 mt-1">追踪你的学习进度和成就</p>
      </div>

      {/* 核心统计 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">总经验值</p>
                <p className="text-3xl font-bold">{stats.xp}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                <Zap className="w-6 h-6 text-indigo-400" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">等级 {stats.level}</span>
                <span>{stats.xp % 200}/200 XP</span>
              </div>
              <Progress value={(stats.xp % 200) / 2} className="h-1.5 mt-1" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">连续打卡</p>
                <p className="text-3xl font-bold">{stats.streakDays}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
                <Flame className="w-6 h-6 text-orange-400" />
              </div>
            </div>
            <p className="text-sm text-slate-400 mt-4">
              {stats.streakDays > 0 ? '继续保持！' : '今天开始学习吧'}
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">学习时长</p>
                <p className="text-3xl font-bold">{Math.floor(stats.totalStudyTime / 60)}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                <Clock className="w-6 h-6 text-green-400" />
              </div>
            </div>
            <p className="text-sm text-slate-400 mt-4">小时</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">代码提交</p>
                <p className="text-3xl font-bold">{stats.totalCodeSubmissions}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Code2 className="w-6 h-6 text-purple-400" />
              </div>
            </div>
            <p className="text-sm text-slate-400 mt-4">次</p>
          </CardContent>
        </Card>
      </div>

      {/* 详细统计 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 学习活动 */}
        <Card className="glass-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-400" />
              本周学习活动
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between h-40 gap-2">
              {weeklyData.map((day, index) => (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div 
                    className={`w-full rounded-t-lg transition-all ${
                      day.studied ? 'bg-indigo-500' : 'bg-slate-700'
                    }`}
                    style={{ height: `${Math.max(day.xp / 5, 10)}%` }}
                  />
                  <span className="text-xs text-slate-400 mt-2">{day.day}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 课程统计 */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-400" />
              课程统计
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">进行中</span>
              <Badge className="bg-indigo-500/20 text-indigo-400">{activeCourses}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">已完成</span>
              <Badge className="bg-green-500/20 text-green-400">{completedCourses}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">总课程</span>
              <Badge className="bg-slate-500/20 text-slate-400">{courses.length}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">正确率</span>
              <Badge className="bg-yellow-500/20 text-yellow-400">
                {Math.round(stats.correctRate * 100)}%
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 徽章墙 */}
      {stats.badges.length > 0 && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-indigo-400" />
              获得的徽章
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {stats.badges.map((badge) => (
                <div
                  key={badge.id}
                  className="text-center p-4 rounded-xl bg-slate-800/50 hover:bg-slate-800 transition-all"
                >
                  <div className="text-4xl mb-2">{badge.icon}</div>
                  <p className="font-medium text-sm">{badge.name}</p>
                  <p className="text-xs text-slate-400">{badge.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI 使用统计 */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-400" />
            AI 使用统计
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-xl bg-slate-800/50">
              <p className="text-3xl font-bold">{aiStats.totalCalls}</p>
              <p className="text-slate-400 text-sm">总调用次数</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-slate-800/50">
              <p className="text-3xl font-bold">{aiStats.todayCalls}</p>
              <p className="text-slate-400 text-sm">今日调用</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-slate-800/50">
              <p className="text-3xl font-bold">
                {aiStats.totalCalls > 0 ? Math.round(aiStats.totalCalls / 30) : 0}
              </p>
              <p className="text-slate-400 text-sm">日均调用</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
