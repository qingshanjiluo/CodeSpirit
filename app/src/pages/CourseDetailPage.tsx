/**
 * CodeSpirit 课程详情页面
 */

import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Play,
  Lock,
  CheckCircle2,
  Clock,
  BookOpen,
  Trophy,
  MoreVertical,
  Edit3,
  Download,
  Share2,
  Trash2,
  Sparkles,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { get, getAllByIndex, remove, put, STORES } from '@/db';
import { exportCourse } from '@/utils/exportImport';
import { generateId } from '@/utils';
import type { Course, Chapter, Progress as ProgressType } from '@/types';
import type { PageType } from '@/App';
import { toast } from 'sonner';

interface CourseDetailPageProps {
  courseId: string;
  onNavigate: (page: PageType, params?: any) => void;
}

export function CourseDetailPage({ courseId, onNavigate }: CourseDetailPageProps) {
  const [course, setCourse] = useState<Course | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [progress, setProgress] = useState<Record<string, ProgressType>>({});
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCourseData();
  }, [courseId]);

  const loadCourseData = async () => {
    try {
      // 加载课程
      const courseData = await get<Course>(STORES.COURSES, courseId);
      if (!courseData) {
        toast.error('课程不存在');
        onNavigate('courses');
        return;
      }
      setCourse(courseData);

      // 加载章节
      const chaptersData = await getAllByIndex<Chapter>(STORES.CHAPTERS, 'courseId', courseId);
      setChapters(chaptersData.sort((a: Chapter, b: Chapter) => a.order - b.order));

      // 加载进度
      const progressData = await getAllByIndex<ProgressType>(STORES.PROGRESS, 'courseId', courseId);
      const progressMap: Record<string, ProgressType> = {};
      for (const p of progressData) {
        progressMap[p.chapterId] = p;
      }
      setProgress(progressMap);
    } catch (error) {
      console.error('[CourseDetailPage] Load error:', error);
      toast.error('加载课程失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await remove(STORES.COURSES, courseId);
      for (const chapter of chapters) {
        await remove(STORES.CHAPTERS, chapter.id);
      }
      toast.success('课程已删除');
      onNavigate('courses');
    } catch (error) {
      console.error('[CourseDetailPage] Delete error:', error);
      toast.error('删除失败');
    }
  };

  const handleExport = async () => {
    if (!course) return;
    try {
      await exportCourse(course, chapters);
      toast.success('课程已导出');
    } catch (error) {
      console.error('[CourseDetailPage] Export error:', error);
      toast.error('导出失败');
    }
  };

  const handleGenerateMissingChapters = async () => {
    if (!course) return;
    const existingCount = chapters.length;
    const missingCount = course.totalChapters - existingCount;
    if (missingCount <= 0) {
      toast.info('所有章节已生成');
      return;
    }
    const newChapters: Chapter[] = [];
    for (let i = 0; i < missingCount; i++) {
      const order = existingCount + i;
      const newChapter: Chapter = {
        id: generateId(),
        courseId: course.id,
        order,
        title: `第 ${order + 1} 节`,
        status: order === existingCount ? 'available' : 'locked',
        content: '',
        currentStageIndex: 0,
        estimatedMinutes: 20,
        xpReward: 50,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await put(STORES.CHAPTERS, newChapter);
      newChapters.push(newChapter);
    }
    setChapters((prev) => [...prev, ...newChapters].sort((a, b) => a.order - b.order));
    toast.success(`已生成 ${missingCount} 个新章节`);
  };

  const getChapterStatusIcon = (chapter: Chapter) => {
    const chapterProgress = progress[chapter.id];
    if (chapterProgress?.completed) {
      return <CheckCircle2 className="w-5 h-5 text-green-400" />;
    }
    if (chapter.status === 'locked') {
      return <Lock className="w-5 h-5 text-slate-500" />;
    }
    if (chapter.status === 'available' || chapter.status === 'in_progress') {
      return <Play className="w-5 h-5 text-indigo-400" />;
    }
    return <BookOpen className="w-5 h-5 text-slate-400" />;
  };

  const getDifficultyText = (difficulty: Course['difficulty']) => {
    switch (difficulty) {
      case 'beginner': return '入门';
      case 'easy': return '简单';
      case 'medium': return '中等';
      case 'hard': return '困难';
      case 'expert': return '专家';
      default: return '未知';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-64 rounded-xl" />
        <div className="skeleton h-96 rounded-xl" />
      </div>
    );
  }

  if (!course) return null;

  const overallProgress = course.totalChapters > 0
    ? (course.completedChapters / course.totalChapters) * 100
    : 0;

  const nextChapter = chapters.find(c => c.status !== 'completed' && c.status !== 'locked');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 返回按钮 */}
      <Button variant="ghost" onClick={() => onNavigate('courses')}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        返回课程列表
      </Button>

      {/* 课程封面 */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="h-64 bg-gradient-to-br from-indigo-500/30 to-purple-500/30 relative">
          {course.coverImage ? (
            <img
              src={course.coverImage}
              alt={course.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="w-24 h-24 text-slate-600" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent" />
          
          {/* 课程信息 */}
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-indigo-500/20 text-indigo-400">
                    {getDifficultyText(course.difficulty)}
                  </Badge>
                  <Badge className="bg-slate-500/20 text-slate-400">
                    {course.language === 'zh-CN' ? '中文' : 'English'}
                  </Badge>
                </div>
                <h1 className="text-3xl font-bold mb-2">{course.title}</h1>
                <p className="text-slate-300 max-w-2xl">{course.description}</p>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="bg-slate-900/50">
                    <MoreVertical className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="glass-panel">
                  <DropdownMenuItem onClick={handleExport}>
                    <Download className="w-4 h-4 mr-2" />
                    导出课程
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-red-400"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    删除课程
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* 进度和操作 */}
        <div className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400">学习进度</span>
                <span className="font-bold">{Math.round(overallProgress)}%</span>
              </div>
              <Progress value={overallProgress} className="h-2" />
              <p className="text-sm text-slate-500 mt-2">
                已完成 {course.completedChapters}/{course.totalChapters} 节 · 预计 {course.estimatedHours} 小时
              </p>
            </div>
            
            {nextChapter && (
              <Button
                size="lg"
                onClick={() => onNavigate('learning', { courseId, chapterId: nextChapter.id })}
                className="bg-gradient-to-r from-indigo-500 to-purple-600"
              >
                <Play className="w-5 h-5 mr-2" />
                {overallProgress === 0 ? '开始学习' : '继续学习'}
              </Button>
            )}
            {!nextChapter && course.totalChapters > chapters.length && (
              <Button
                size="lg"
                onClick={handleGenerateMissingChapters}
                className="bg-gradient-to-r from-amber-500 to-orange-600"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                生成后续章节
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 章节列表 */}
      <Tabs defaultValue="chapters" className="w-full">
        <TabsList className="glass-card">
          <TabsTrigger value="chapters">章节列表</TabsTrigger>
          <TabsTrigger value="overview">课程概览</TabsTrigger>
        </TabsList>

        <TabsContent value="chapters" className="mt-6">
          <div className="space-y-3">
            {chapters.map((chapter, index) => {
              const chapterProgress = progress[chapter.id];
              const isLocked = chapter.status === 'locked';
              const isCompleted = chapterProgress?.completed;

              return (
                <Card
                  key={chapter.id}
                  className={`glass-card transition-all ${
                    isLocked 
                      ? 'opacity-60 cursor-not-allowed' 
                      : 'cursor-pointer hover:border-indigo-500/30'
                  }`}
                  onClick={() => {
                    if (!isLocked) {
                      onNavigate('learning', { courseId, chapterId: chapter.id });
                    }
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {/* 序号/状态 */}
                      <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                        {getChapterStatusIcon(chapter)}
                      </div>

                      {/* 内容 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-500">第 {index + 1} 节</span>
                          {isCompleted && (
                            <Badge className="bg-green-500/20 text-green-400 text-xs">已完成</Badge>
                          )}
                        </div>
                        <h3 className="font-medium truncate">{chapter.title}</h3>
                        <div className="flex items-center gap-4 text-sm text-slate-400 mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {chapter.estimatedMinutes} 分钟
                          </span>
                          <span className="flex items-center gap-1">
                            <Trophy className="w-3 h-3" />
                            {chapter.xpReward} XP
                          </span>
                        </div>
                      </div>

                      {/* 操作 */}
                      {!isLocked && (
                        <Button variant="ghost" size="sm">
                          <Play className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="overview" className="mt-6">
          <Card className="glass-card">
            <CardContent className="p-6">
              <h3 className="font-semibold mb-4">课程信息</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-400">创建时间</span>
                  <p>{new Date(course.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="text-slate-400">最后学习</span>
                  <p>{course.lastStudiedAt 
                    ? new Date(course.lastStudiedAt).toLocaleDateString() 
                    : '未开始'}</p>
                </div>
                <div>
                  <span className="text-slate-400">总章节</span>
                  <p>{course.totalChapters} 节</p>
                </div>
                <div>
                  <span className="text-slate-400">预计时长</span>
                  <p>{course.estimatedHours} 小时</p>
                </div>
              </div>

              {course.tags && course.tags.length > 0 && (
                <>
                  <h3 className="font-semibold mt-6 mb-4">标签</h3>
                  <div className="flex flex-wrap gap-2">
                    {course.tags.map((tag, i) => (
                      <Badge key={i} variant="secondary">{tag}</Badge>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 删除确认对话框 */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="glass-panel">
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除课程？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将永久删除该课程及其所有章节内容，无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500 hover:bg-red-600"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
