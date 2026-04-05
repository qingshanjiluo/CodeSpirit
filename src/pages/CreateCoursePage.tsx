/**
 * CodeSpirit 创建课程向导
 */

import { useState } from 'react';
import { 
  ArrowLeft, 
  ArrowRight, 
  Sparkles, 
  Check,
  Loader2,
  BookOpen,
  Target,
  Clock,
  Globe,
  Image as ImageIcon,
  Upload
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { generateCoursePlans, generateCourseContent } from '@/ai';
import { put, STORES } from '@/db';
import { generateId, readImageFile, compressImage } from '@/utils';
import type { Course, Chapter, CoursePlan, Difficulty, CourseLanguage } from '@/types';
import type { PageType } from '@/App';
import { toast } from 'sonner';

interface CreateCoursePageProps {
  onNavigate: (page: PageType, params?: any) => void;
}

type Step = 
  | 'input' 
  | 'plans' 
  | 'customize' 
  | 'cover' 
  | 'generating' 
  | 'complete';

export function CreateCoursePage({ onNavigate }: CreateCoursePageProps) {
  const [currentStep, setCurrentStep] = useState<Step>('input');
  const [progress, setProgress] = useState(0);
  
  // 表单数据
  const [description, setDescription] = useState('');
  const [plans, setPlans] = useState<CoursePlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<CoursePlan | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner');
  const [timePerWeek, setTimePerWeek] = useState(5);
  const [goal, setGoal] = useState<'interest' | 'project' | 'certification'>('interest');
  const [language, setLanguage] = useState<CourseLanguage>('zh-CN');
  const [coverImage, setCoverImage] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  
  // 生成的课程
  const [generatedCourse, setGeneratedCourse] = useState<Course | null>(null);

  const steps = [
    { id: 'input', label: '描述需求', progress: 20 },
    { id: 'plans', label: '选择方案', progress: 40 },
    { id: 'customize', label: '定制参数', progress: 60 },
    { id: 'cover', label: '选择封面', progress: 80 },
    { id: 'generating', label: '生成课程', progress: 90 },
    { id: 'complete', label: '完成', progress: 100 },
  ];

  const handleGeneratePlans = async () => {
    if (!description.trim()) {
      toast.error('请输入学习需求');
      return;
    }

    setCurrentStep('plans');
    setProgress(40);

    try {
      const generatedPlans = await generateCoursePlans(description, 'beginner', timePerWeek);
      setPlans(generatedPlans);
    } catch (error) {
      console.error('[CreateCourse] Generate plans error:', error);
      toast.error('生成方案失败，请重试');
      setCurrentStep('input');
      setProgress(20);
    }
  };

  const handleSelectPlan = (plan: CoursePlan) => {
    setSelectedPlan(plan);
    setCurrentStep('customize');
    setProgress(60);
  };

  const handleCustomize = () => {
    setCurrentStep('cover');
    setProgress(80);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const dataUrl = await readImageFile(file);
      const compressed = await compressImage(dataUrl, 800, 0.8);
      setCoverImage(compressed);
      toast.success('封面上传成功');
    } catch (error) {
      console.error('[CreateCourse] Image upload error:', error);
      toast.error('上传失败');
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerateCourse = async () => {
    if (!selectedPlan) return;

    setCurrentStep('generating');
    setProgress(90);

    try {
      // 创建课程
      const course: Course = {
        id: generateId(),
        title: selectedPlan.title,
        description: selectedPlan.description,
        coverImage,
        language,
        status: 'generating',
        difficulty,
        totalChapters: Math.min(Math.max(Math.floor(timePerWeek * selectedPlan.estimatedWeeks / 2), 5), 15),
        completedChapters: 0,
        estimatedHours: timePerWeek * selectedPlan.estimatedWeeks,
        tags: [selectedPlan.focus],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastStudiedAt: null
      };

      await put(STORES.COURSES, course);

      // 生成第一节内容
      const firstChapterContent = await generateCourseContent(
        course.title,
        0,
        course.totalChapters,
        '',
        difficulty
      );

      const firstChapter: Chapter = {
        id: generateId(),
        courseId: course.id,
        order: 0,
        title: '第一节：入门介绍',
        status: 'available',
        content: firstChapterContent,
        currentStageIndex: 0,
        estimatedMinutes: 20,
        xpReward: 50,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await put(STORES.CHAPTERS, firstChapter);

      // 更新课程状态
      course.status = 'active';
      await put(STORES.COURSES, course);

      setGeneratedCourse(course);
      setCurrentStep('complete');
      setProgress(100);
      toast.success('课程创建成功！');
    } catch (error) {
      console.error('[CreateCourse] Generate course error:', error);
      toast.error('生成课程失败，请重试');
      setCurrentStep('cover');
      setProgress(80);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'input':
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">你想学习什么？</h2>
              <p className="text-slate-400">用自然语言描述你的学习目标，AI会为你生成个性化课程</p>
            </div>

            <div className="space-y-4">
              <Label>学习需求描述</Label>
              <Textarea
                placeholder="例如：我想用Python做数据分析，从零基础开始，希望能在2个月内掌握基本的数据处理和可视化技能..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[150px] bg-slate-800/50 border-slate-700"
              />
              <p className="text-sm text-slate-500">
                提示：描述越详细，生成的课程越符合你的需求
              </p>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleGeneratePlans} size="lg">
                <Sparkles className="w-5 h-5 mr-2" />
                生成课程方案
              </Button>
            </div>
          </div>
        );

      case 'plans':
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">选择一个课程方案</h2>
              <p className="text-slate-400">AI为你生成了以下学习路径</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.map((plan, index) => (
                <Card
                  key={index}
                  className="glass-card cursor-pointer hover:border-indigo-500/50 transition-all hover:scale-[1.02]"
                  onClick={() => handleSelectPlan(plan)}
                >
                  <CardContent className="p-6">
                    {/* 方案编号和标题 */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center mr-3">
                          <span className="text-indigo-400 font-bold">{index + 1}</span>
                        </div>
                        <h3 className="font-semibold text-lg">{plan.title}</h3>
                      </div>
                      <Badge variant="secondary" className="bg-indigo-500/20 text-indigo-400">
                        {plan.estimatedWeeks} 周
                      </Badge>
                    </div>
                    
                    {/* 课程描述 */}
                    <p className="text-slate-300 text-sm mb-4 line-clamp-3">{plan.description}</p>
                    
                    {/* 关键信息 */}
                    <div className="space-y-3">
                      {/* 侧重点和风格 */}
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="bg-slate-800/50">
                          {plan.focus}
                        </Badge>
                        {plan.style && (
                          <Badge variant="outline" className="bg-purple-500/10 text-purple-400">
                            {plan.style}
                          </Badge>
                        )}
                        {plan.learningStyle && (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400">
                            {plan.learningStyle}
                          </Badge>
                        )}
                      </div>
                      
                      {/* 关键特色 */}
                      {plan.keyFeatures && plan.keyFeatures.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs text-slate-500 font-medium">特色：</p>
                          <div className="flex flex-wrap gap-1">
                            {plan.keyFeatures.slice(0, 3).map((feature, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 text-xs rounded-full bg-slate-800/50 text-slate-300"
                              >
                                {feature}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* 时间估算 */}
                      <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-800/50">
                        <div className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          <span>约 {plan.estimatedWeeks * timePerWeek} 小时</span>
                        </div>
                        <div className="flex items-center">
                          <Target className="w-3 h-3 mr-1" />
                          <span>{plan.focus}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep('input')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回
              </Button>
              <Button variant="outline" onClick={handleGeneratePlans}>
                <Sparkles className="w-4 h-4 mr-2" />
                重新生成
              </Button>
            </div>
          </div>
        );

      case 'customize':
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">定制你的课程</h2>
              <p className="text-slate-400">调整参数以获得最适合的学习体验</p>
            </div>

            <div className="space-y-6">
              {/* 难度选择 */}
              <div className="space-y-2">
                <Label>难度级别</Label>
                <RadioGroup
                  value={difficulty}
                onValueChange={(v) => setDifficulty(v as Difficulty)}
                  className="flex flex-wrap gap-2"
                >
                  {[
                    { value: 'beginner', label: '入门' },
                    { value: 'easy', label: '简单' },
                    { value: 'medium', label: '中等' },
                    { value: 'hard', label: '困难' },
                    { value: 'expert', label: '专家' },
                  ].map((opt) => (
                    <div key={opt.value}>
                      <RadioGroupItem
                        value={opt.value}
                        id={opt.value}
                        className="peer sr-only"
                      />
                      <Label
                        htmlFor={opt.value}
                        className="flex items-center justify-center px-4 py-2 rounded-lg border border-slate-700 bg-slate-800/50 cursor-pointer peer-data-[state=checked]:border-indigo-500 peer-data-[state=checked]:bg-indigo-500/20"
                      >
                        {opt.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {/* 每周时间 */}
              <div className="space-y-2">
                <Label>每周可用时间：{timePerWeek} 小时</Label>
                <Slider
                  value={[timePerWeek]}
                  onValueChange={(v) => setTimePerWeek(v[0])}
                  min={1}
                  max={20}
                  step={1}
                />
              </div>

              {/* 学习目标 */}
              <div className="space-y-2">
                <Label>学习目标</Label>
                <RadioGroup
                  value={goal}
                  onValueChange={(v) => setGoal(v as typeof goal)}
                  className="grid grid-cols-3 gap-2"
                >
                  {[
                    { value: 'interest', label: '兴趣学习' },
                    { value: 'project', label: '项目实战' },
                    { value: 'certification', label: '考证/求职' },
                  ].map((opt) => (
                    <div key={opt.value}>
                      <RadioGroupItem
                        value={opt.value}
                        id={opt.value}
                        className="peer sr-only"
                      />
                      <Label
                        htmlFor={opt.value}
                        className="flex flex-col items-center justify-center p-4 rounded-lg border border-slate-700 bg-slate-800/50 cursor-pointer peer-data-[state=checked]:border-indigo-500 peer-data-[state=checked]:bg-indigo-500/20"
                      >
                        <Target className="w-5 h-5 mb-2" />
                        {opt.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {/* 语言选择 */}
              <div className="space-y-2">
                <Label>课程语言</Label>
                <RadioGroup
                  value={language}
                  onValueChange={(v) => setLanguage(v as CourseLanguage)}
                  className="flex gap-2"
                >
                  <div>
                    <RadioGroupItem
                      value="zh-CN"
                      id="zh"
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor="zh"
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 bg-slate-800/50 cursor-pointer peer-data-[state=checked]:border-indigo-500 peer-data-[state=checked]:bg-indigo-500/20"
                    >
                      <Globe className="w-4 h-4" />
                      中文
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem
                      value="en-US"
                      id="en"
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor="en"
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 bg-slate-800/50 cursor-pointer peer-data-[state=checked]:border-indigo-500 peer-data-[state=checked]:bg-indigo-500/20"
                    >
                      <Globe className="w-4 h-4" />
                      English
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep('plans')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回
              </Button>
              <Button onClick={handleCustomize}>
                下一步
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        );

      case 'cover':
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">选择课程封面</h2>
              <p className="text-slate-400">上传一张图片或使用默认封面</p>
            </div>

            <div className="space-y-4">
              {/* 封面预览 */}
              <div className="aspect-video rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center overflow-hidden">
                {coverImage ? (
                  <img src={coverImage} alt="封面" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center">
                    <ImageIcon className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-500">暂无封面</p>
                  </div>
                )}
              </div>

              {/* 上传按钮 */}
              <div className="flex justify-center">
                <Label
                  htmlFor="cover-upload"
                  className="cursor-pointer"
                >
                  <div className="flex items-center gap-2 px-6 py-3 rounded-lg border border-dashed border-slate-600 hover:border-indigo-500 hover:bg-indigo-500/10 transition-all">
                    <Upload className="w-5 h-5" />
                    <span>{isUploading ? '上传中...' : '上传封面'}</span>
                  </div>
                  <input
                    id="cover-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={isUploading}
                  />
                </Label>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep('customize')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回
              </Button>
              <Button onClick={handleGenerateCourse}>
                <Sparkles className="w-4 h-4 mr-2" />
                生成课程
              </Button>
            </div>
          </div>
        );

      case 'generating':
        return (
          <div className="text-center py-16">
            <Loader2 className="w-16 h-16 animate-spin mx-auto mb-6 text-indigo-500" />
            <h2 className="text-2xl font-bold mb-2">正在生成课程...</h2>
            <p className="text-slate-400 mb-8">AI正在为你创建个性化的学习内容</p>
            <div className="max-w-md mx-auto">
              <Progress value={progress} className="h-2" />
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2">课程创建成功！</h2>
            <p className="text-slate-400 mb-8">
              你的专属课程已准备就绪，开始你的学习之旅吧
            </p>
            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={() => onNavigate('courses')}>
                <BookOpen className="w-4 h-4 mr-2" />
                查看课程
              </Button>
              <Button
                onClick={() => onNavigate('learning', { courseId: generatedCourse?.id })}
                className="bg-gradient-to-r from-indigo-500 to-purple-600"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                立即学习
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      {/* 进度条 */}
      {currentStep !== 'complete' && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`flex items-center ${index < steps.length - 1 ? 'flex-1' : ''}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    steps.findIndex(s => s.id === currentStep) >= index
                      ? 'bg-indigo-500 text-white'
                      : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  {index + 1}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      steps.findIndex(s => s.id === currentStep) > index
                        ? 'bg-indigo-500'
                        : 'bg-slate-700'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="text-center text-sm text-slate-400">
            {steps.find(s => s.id === currentStep)?.label}
          </div>
        </div>
      )}

      {/* 步骤内容 */}
      <Card className="glass-card">
        <CardContent className="p-8">
          {renderStep()}
        </CardContent>
      </Card>
    </div>
  );
}
