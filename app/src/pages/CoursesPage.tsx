/**
 * CodeSpirit 课程列表页面
 */

import { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  MoreVertical,
  Play,
  Trash2,
  Edit3,
  Download,
  Share2,
  Clock,
  CheckCircle2,
  Lock,
  Upload
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
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
import { getAll, remove, put, STORES } from '@/db';
import { exportCourse, importCourse } from '@/utils/exportImport';
import type { Course, Chapter } from '@/types';
import type { PageType } from '@/App';
import { toast } from 'sonner';

interface CoursesPageProps {
  onNavigate: (page: PageType, params?: any) => void;
}

export function CoursesPage({ onNavigate }: CoursesPageProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [chapters, setChapters] = useState<Record<string, Chapter[]>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteCourseId, setDeleteCourseId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      const allCourses = await getAll<Course>(STORES.COURSES);
      setCourses(allCourses.sort((a, b) => b.createdAt - a.createdAt));

      // 加载每个课程的章节
      const allChapters = await getAll<Chapter>(STORES.CHAPTERS);
      const chaptersByCourse: Record<string, Chapter[]> = {};
      for (const chapter of allChapters) {
        if (!chaptersByCourse[chapter.courseId]) {
          chaptersByCourse[chapter.courseId] = [];
        }
        chaptersByCourse[chapter.courseId].push(chapter);
      }
      setChapters(chaptersByCourse);
    } catch (error) {
      console.error('[CoursesPage] Load error:', error);
      toast.error('加载课程失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (courseId: string) => {
    try {
      // 删除课程
      await remove(STORES.COURSES, courseId);
      
      // 级联删除章节
      const courseChapters = chapters[courseId] || [];
      for (const chapter of courseChapters) {
        await remove(STORES.CHAPTERS, chapter.id);
      }

      setCourses(courses.filter(c => c.id !== courseId));
      toast.success('课程已删除');
    } catch (error) {
      console.error('[CoursesPage] Delete error:', error);
      toast.error('删除失败');
    } finally {
      setDeleteCourseId(null);
    }
  };

  const handleExport = async (course: Course) => {
    try {
      const courseChapters = chapters[course.id] || [];
      await exportCourse(course, courseChapters);
      toast.success('课程已导出');
    } catch (error) {
      console.error('[CoursesPage] Export error:', error);
      toast.error('导出失败');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importCourse(file);
      toast.success('课程导入成功');
      await loadCourses();
    } catch (error) {
      console.error('[CoursesPage] Import error:', error);
      toast.error('导入失败: ' + (error instanceof Error ? error.message : '未知错误'));
    }
    e.target.value = '';
  };

  const filteredCourses = courses.filter(course =>
    course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    course.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    course.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getStatusBadge = (status: Course['status']) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/20 text-green-400">进行中</Badge>;
      case 'completed':
        return <Badge className="bg-blue-500/20 text-blue-400">已完成</Badge>;
      case 'draft':
        return <Badge className="bg-slate-500/20 text-slate-400">草稿</Badge>;
      case 'generating':
        return <Badge className="bg-amber-500/20 text-amber-400">生成中</Badge>;
      default:
        return null;
    }
  };

  const getDifficultyColor = (difficulty: Course['difficulty']) => {
    switch (difficulty) {
      case 'beginner':
        return 'text-green-400';
      case 'easy':
        return 'text-blue-400';
      case 'medium':
        return 'text-yellow-400';
      case 'hard':
        return 'text-orange-400';
      case 'expert':
        return 'text-red-400';
      default:
        return 'text-slate-400';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-12 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton h-64 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 页面标题 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-400" />
            我的课程
          </h1>
          <p className="text-slate-400 mt-1">共 {courses.length} 个课程</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="搜索课程..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64 bg-slate-800/50 border-slate-700"
            />
          </div>
          <input
            type="file"
            accept=".lingcheng,.json,.encrypted"
            ref={fileInputRef}
            className="hidden"
            onChange={handleImport}
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" />
            导入课程
          </Button>
          <Button onClick={() => onNavigate('create-course')}>
            <Plus className="w-4 h-4 mr-2" />
            新建课程
          </Button>
        </div>
      </div>

      {/* 课程列表 */}
      {filteredCourses.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">
            {searchQuery ? '没有找到匹配的课程' : '还没有课程'}
          </h3>
          <p className="text-slate-400 mb-6">
            {searchQuery ? '尝试其他关键词' : '创建你的第一个AI编程课程吧'}
          </p>
          {!searchQuery && (
            <Button onClick={() => onNavigate('create-course')}>
              <Plus className="w-4 h-4 mr-2" />
              创建课程
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => {
            const progress = course.totalChapters > 0
              ? (course.completedChapters / course.totalChapters) * 100
              : 0;
            const courseChapters = chapters[course.id] || [];

            return (
              <Card
                key={course.id}
                className="glass-card overflow-hidden group hover:border-indigo-500/30 transition-all"
              >
                {/* 封面 */}
                <div className="h-40 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 relative overflow-hidden">
                  {course.coverImage ? (
                    <img
                      src={course.coverImage}
                      alt={course.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen className="w-16 h-16 text-slate-600" />
                    </div>
                  )}
                  
                  {/* 状态标签 */}
                  <div className="absolute top-3 left-3">
                    {getStatusBadge(course.status)}
                  </div>

                  {/* 操作菜单 */}
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="bg-slate-900/50 hover:bg-slate-900/80">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="glass-panel">
                        <DropdownMenuItem onClick={() => onNavigate('course-detail', { courseId: course.id })}>
                          <Play className="w-4 h-4 mr-2" />
                          查看详情
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport(course)}>
                          <Download className="w-4 h-4 mr-2" />
                          导出课程
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => setDeleteCourseId(course.id)}
                          className="text-red-400"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* 内容 */}
                <CardContent className="p-4">
                  <h3 className="font-semibold text-lg mb-1 truncate">{course.title}</h3>
                  <p className="text-slate-400 text-sm mb-3 line-clamp-2">
                    {course.description || '暂无描述'}
                  </p>

                  {/* 标签 */}
                  {course.tags && course.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {course.tags.slice(0, 3).map((tag, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* 元信息 */}
                  <div className="flex items-center justify-between text-sm text-slate-400 mb-3">
                    <span className={getDifficultyColor(course.difficulty)}>
                      {course.difficulty === 'beginner' && '入门'}
                      {course.difficulty === 'easy' && '简单'}
                      {course.difficulty === 'medium' && '中等'}
                      {course.difficulty === 'hard' && '困难'}
                      {course.difficulty === 'expert' && '专家'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {course.estimatedHours}h
                    </span>
                  </div>

                  {/* 进度 */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">进度</span>
                      <span className="font-medium">{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                    <p className="text-xs text-slate-500">
                      {course.completedChapters}/{course.totalChapters} 节已完成
                    </p>
                  </div>

                  {/* 继续学习按钮 */}
                  {progress < 100 && course.status === 'active' && (
                    <Button
                      className="w-full mt-4"
                      onClick={() => onNavigate('learning', { courseId: course.id })}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      {progress === 0 ? '开始学习' : '继续学习'}
                    </Button>
                  )}

                  {progress === 100 && (
                    <div className="flex items-center justify-center gap-2 mt-4 text-green-400">
                      <CheckCircle2 className="w-5 h-5" />
                      <span>已完成</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 删除确认对话框 */}
      <AlertDialog open={!!deleteCourseId} onOpenChange={() => setDeleteCourseId(null)}>
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
              onClick={() => deleteCourseId && handleDelete(deleteCourseId)}
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
