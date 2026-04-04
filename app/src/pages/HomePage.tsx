/**
 * CodeSpirit 首页
 */

import { useState, useEffect } from 'react';
import { 
  Sparkles, 
  BookOpen, 
  Trophy, 
  Zap, 
  ArrowRight,
  Play,
  Clock,
  Target,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { getAll, get, STORES } from '@/db';
import type { Course, UserStats, Note } from '@/types';
import type { PageType } from '@/App';

interface HomePageProps {
  onNavigate: (page: PageType, params?: any) => void;
}

export function HomePage({ onNavigate }: HomePageProps) {
  const [recentCourses, setRecentCourses] = useState<Course[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [recentNotes, setRecentNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        // 加载最近学习的课程
        const courses = await getAll<Course>(STORES.COURSES);
        const sorted = courses
          .filter(c => c.lastStudiedAt)
          .sort((a, b) => (b.lastStudiedAt || 0) - (a.lastStudiedAt || 0))
          .slice(0, 3);
        setRecentCourses(sorted);

        // 加载统计数据
        const userStats = await get<{ value: UserStats }>(STORES.USER_DATA, 'stats');
        if (userStats) {
          setStats(userStats.value);
        }

        // 加载最近笔记
        const notes = await getAll<Note>(STORES.NOTES);
        const sortedNotes = notes
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, 3);
        setRecentNotes(sortedNotes);
      } catch (error) {
        console.error('[HomePage] Load error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return '夜深了';
    if (hour < 12) return '早上好';
    if (hour < 18) return '下午好';
    return '晚上好';
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-32 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="skeleton h-40 rounded-xl" />
          <div className="skeleton h-40 rounded-xl" />
          <div className="skeleton h-40 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* 欢迎横幅 */}
      <div className="glass-card rounded-2xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="w-6 h-6 text-indigo-400" />
            <span className="text-indigo-400 font-medium">AI 编程学习平台</span>
          </div>
          
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            {getGreeting()}，{stats ? '继续你的编程之旅吧！' : '准备好开始学习了吗？'}
          </h1>
          
          <p className="text-slate-400 text-lg mb-6 max-w-2xl">
            灵程是你的AI编程导师，通过个性化课程和游戏化学习，让编程学习变得有趣而高效。
          </p>
          
          <div className="flex flex-wrap gap-4">
            <Button
              size="lg"
              onClick={() => onNavigate('create-course')}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              创建新课程
            </Button>
            
            {recentCourses.length > 0 && (
              <Button
                size="lg"
                variant="outline"
                onClick={() => onNavigate('learning', { courseId: recentCourses[0].id })}
              >
                <Play className="w-5 h-5 mr-2" />
                继续学习
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">总经验值</p>
                  <p className="text-2xl font-bold">{stats.xp}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">当前等级</p>
                  <p className="text-2xl font-bold">LV.{stats.level}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">已完成课程</p>
                  <p className="text-2xl font-bold">{stats.coursesCompleted}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-orange-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">学习时长</p>
                  <p className="text-2xl font-bold">{Math.floor(stats.totalStudyTime / 60)}h</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 最近课程 */}
      {recentCourses.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-400" />
              最近学习
            </h2>
            <Button variant="ghost" onClick={() => onNavigate('courses')}>
              查看全部
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recentCourses.map((course) => (
              <Card
                key={course.id}
                className="glass-card cursor-pointer hover:border-indigo-500/50 transition-all"
                onClick={() => onNavigate('course-detail', { courseId: course.id })}
              >
                <div className="h-32 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-t-lg overflow-hidden">
                  {course.coverImage ? (
                    <img
                      src={course.coverImage}
                      alt={course.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen className="w-12 h-12 text-slate-600" />
                    </div>
                  )}
                </div>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-2 truncate">{course.title}</h3>
                  <div className="flex items-center justify-between text-sm text-slate-400">
                    <span>进度 {Math.round((course.completedChapters / course.totalChapters) * 100)}%</span>
                    <span>{course.completedChapters}/{course.totalChapters} 节</span>
                  </div>
                  <Progress
                    value={(course.completedChapters / course.totalChapters) * 100}
                    className="mt-2 h-1.5"
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 快速操作 */}
      <div>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-indigo-400" />
          快速操作
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button
            variant="outline"
            className="h-auto py-6 flex flex-col items-center gap-3 glass-card"
            onClick={() => onNavigate('dashboard')}
          >
            <TrendingUp className="w-8 h-8 text-indigo-400" />
            <span>查看进度</span>
          </Button>
          
          <Button
            variant="outline"
            className="h-auto py-6 flex flex-col items-center gap-3 glass-card"
            onClick={() => onNavigate('notes')}
          >
            <BookOpen className="w-8 h-8 text-purple-400" />
            <span>我的笔记</span>
          </Button>
          
          <Button
            variant="outline"
            className="h-auto py-6 flex flex-col items-center gap-3 glass-card"
            onClick={() => onNavigate('works')}
          >
            <Trophy className="w-8 h-8 text-green-400" />
            <span>作品集</span>
          </Button>
          
          <Button
            variant="outline"
            className="h-auto py-6 flex flex-col items-center gap-3 glass-card"
            onClick={() => onNavigate('settings')}
          >
            <Sparkles className="w-8 h-8 text-orange-400" />
            <span>设置</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
