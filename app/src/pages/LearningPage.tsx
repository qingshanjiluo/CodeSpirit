/**
 * CodeSpirit 学习页面
 */

import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  MessageCircle,
  Send,
  Play,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  Trophy,
  Lightbulb,
  Volume2,
  VolumeX,
  Mic,
  Puzzle,
  MousePointerClick,
  ListChecks,
  Code2,
  ChevronDown,
  ChevronUp,
  FileText,
  Gamepad2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { get, getAllByIndex, put, STORES, saveDialogue, getLatestDialogue } from '@/db';
import { chatWithAI, getCodeOptimization, generateStructuredCourseContent, generateStreamingDialogue } from '@/ai';
import { executeCode } from '@/utils/codeSandbox';
import { speak, startSpeechRecognition, generateId, isOnline } from '@/utils';
import type { Course, Chapter, Progress as ProgressType, AIMessage } from '@/types';
import type { PageType } from '@/App';
import { toast } from 'sonner';
import { marked } from 'marked';

// 游戏组件类型
interface GameComponent {
  type: 'fill-blank' | 'puzzle' | 'drag-drop' | 'multi-choice' | 'maze' | 'code-exec' | 'mini-project';
  data: any;
  instructions: string;
  solution?: any;
  hints?: string[];
}

// 对话行类型
interface DialogueLine {
  speaker: 'ai' | 'user';
  content: string;
  delay?: number;
}

// 结构化阶段类型
interface StructuredStage {
  id: string;
  name: string;
  type: 'explanation' | 'example' | 'practice' | 'test' | 'summary';
  content: string;
  gameComponents?: GameComponent[];
  dialogue?: DialogueLine[];
}

interface LearningPageProps {
  courseId: string;
  chapterId: string | null;
  onNavigate: (page: PageType, params?: any) => void;
}

export function LearningPage({ courseId, chapterId, onNavigate }: LearningPageProps) {
  const [course, setCourse] = useState<Course | null>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [stage, setStage] = useState<'explanation' | 'practice' | 'test' | 'summary'>('explanation');
  const [code, setCode] = useState('');
  const [codeOutput, setCodeOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  
  // 结构化内容相关状态
  const [structuredStages, setStructuredStages] = useState<StructuredStage[]>([]);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [currentDialogueIndex, setCurrentDialogueIndex] = useState(0);
  const [isStreamingDialogue, setIsStreamingDialogue] = useState(false);
  const [activeGameComponent, setActiveGameComponent] = useState<GameComponent | null>(null);
  const [gameComponentAnswer, setGameComponentAnswer] = useState<any>(null);
  const [showGameComponent, setShowGameComponent] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const dialogueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadLearningData();
  }, [courseId, chapterId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadLearningData = async () => {
    try {
      // 加载课程
      const courseData = await get<Course>(STORES.COURSES, courseId);
      if (!courseData) {
        toast.error('课程不存在');
        onNavigate('courses');
        return;
      }
      setCourse(courseData);

      // 加载所有章节
      const chaptersData = await getAllByIndex<Chapter>(STORES.CHAPTERS, 'courseId', courseId);
      console.log('[LearningPage] 加载的章节数据:', chaptersData, '类型:', typeof chaptersData, '是数组?', Array.isArray(chaptersData));
      
      // 确保是数组
      let chaptersArray: Chapter[] = [];
      if (Array.isArray(chaptersData)) {
        chaptersArray = chaptersData;
      } else if (chaptersData) {
        // 如果是单个对象，包装成数组
        chaptersArray = [chaptersData];
      }
      
      console.log('[LearningPage] 处理后的章节数组:', chaptersArray.length, '个');
      
      if (chaptersArray.length === 0) {
        console.warn('[LearningPage] 没有找到章节数据');
        toast.error('该课程暂无章节内容');
        return;
      }
      
      const sortedChapters = chaptersArray.sort((a: Chapter, b: Chapter) => (a.order || 0) - (b.order || 0));
      console.log('[LearningPage] 排序后的章节:', sortedChapters.length, '个');
      setChapters(sortedChapters);

      // 确定当前章节
      let currentChapter: Chapter | null = null;
      if (chapterId) {
        currentChapter = sortedChapters.find((c: Chapter) => c.id === chapterId) || null;
      } else {
        // 找到第一个未完成的章节
        currentChapter = sortedChapters.find((c: Chapter) => c.status !== 'completed') || sortedChapters[0];
      }

      if (currentChapter) {
        setChapter(currentChapter);
        
        // 加载保存的对话记录
        try {
          const savedDialogue = await getLatestDialogue(courseId, currentChapter.id);
          if (savedDialogue && savedDialogue.messages && savedDialogue.messages.length > 0) {
            console.log('[LearningPage] 加载保存的对话:', savedDialogue.messages.length, '条消息');
            setMessages(savedDialogue.messages);
          }
        } catch (dialogueError) {
          console.warn('[LearningPage] 加载对话记录失败:', dialogueError);
        }
        
        // 生成或加载结构化内容
        await loadOrGenerateStructuredContent(courseData, currentChapter);
        
        // 更新课程最后学习时间
        courseData.lastStudiedAt = Date.now();
        await put(STORES.COURSES, courseData);
      }
    } catch (error) {
      console.error('[LearningPage] Load error:', error);
      toast.error('加载学习数据失败');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 加载或生成结构化内容
   */
  const loadOrGenerateStructuredContent = async (course: Course, chapter: Chapter) => {
    try {
      // 检查章节是否已有结构化内容
      if (chapter.structuredContent) {
        // 如果有结构化内容，直接使用
        const structuredContent = typeof chapter.structuredContent === 'string'
          ? JSON.parse(chapter.structuredContent)
          : chapter.structuredContent;
        
        setStructuredStages(structuredContent.stages || []);
        setCurrentStageIndex(0);
        setCurrentDialogueIndex(0);
        
        // 开始流式显示对话
        startDialogueStreaming(structuredContent.stages?.[0]?.dialogue || []);
      } else {
        // 生成新的结构化内容
        toast.info('正在生成交互式学习内容...');
        
        const structuredContent = await generateStructuredCourseContent(
          course.title,
          chapter.order || 0,
          chapters.length,
          '', // 前一节上下文
          course.difficulty || 'beginner'
        );
        
        // 保存结构化内容到章节
        chapter.structuredContent = JSON.stringify(structuredContent);
        await put(STORES.CHAPTERS, chapter);
        
        setStructuredStages(structuredContent.stages || []);
        setCurrentStageIndex(0);
        setCurrentDialogueIndex(0);
        
        // 开始流式显示对话
        startDialogueStreaming(structuredContent.stages?.[0]?.dialogue || []);
      }
    } catch (error) {
      console.error('[LearningPage] 加载/生成结构化内容失败:', error);
      toast.error('生成交互内容失败，使用传统模式');
      
      // 降级处理：使用传统内容
      const initialMessage: AIMessage = {
        role: 'assistant',
        content: chapter.content || `欢迎来到「${course.title}」的第${chapter.order + 1}节：${chapter.title}。让我们开始学习吧！`,
        timestamp: Date.now()
      };
      setMessages([initialMessage]);
    }
  };

  /**
   * 开始流式显示对话
   */
  const startDialogueStreaming = (dialogue: DialogueLine[]) => {
    if (!dialogue || dialogue.length === 0) return;
    
    setIsStreamingDialogue(true);
    setCurrentDialogueIndex(0);
    
    // 清空现有消息
    setMessages([]);
    
    // 显示第一条对话
    const firstDialogue = dialogue[0];
    if (firstDialogue) {
      const initialMessage: AIMessage = {
        role: firstDialogue.speaker === 'ai' ? 'assistant' : 'user',
        content: firstDialogue.content,
        timestamp: Date.now()
      };
      setMessages([initialMessage]);
    }
    
    // 设置定时器显示后续对话
    let currentIndex = 1;
    const showNextDialogue = () => {
      if (currentIndex < dialogue.length) {
        const dialogueLine = dialogue[currentIndex];
        const newMessage: AIMessage = {
          role: dialogueLine.speaker === 'ai' ? 'assistant' : 'user',
          content: dialogueLine.content,
          timestamp: Date.now()
        };
        
        setMessages(prev => [...prev, newMessage]);
        setCurrentDialogueIndex(currentIndex);
        currentIndex++;
        
        // 设置下一个对话的延迟
        const delay = dialogueLine.delay || 1000;
        dialogueTimerRef.current = setTimeout(showNextDialogue, delay);
      } else {
        // 所有对话显示完毕
        setIsStreamingDialogue(false);
        
        // 保存对话记录
        setTimeout(() => {
          saveCurrentDialogue();
        }, 1000);
      }
    };
    
    // 启动第一个定时器
    const firstDelay = dialogue[0]?.delay || 1000;
    dialogueTimerRef.current = setTimeout(showNextDialogue, firstDelay);
  };

  /**
   * 清理对话定时器
   */
  const cleanupDialogueTimer = () => {
    if (dialogueTimerRef.current) {
      clearTimeout(dialogueTimerRef.current);
      dialogueTimerRef.current = null;
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const saveCurrentDialogue = async () => {
    if (!course || !chapter || messages.length === 0) return;
    
    try {
      const dialogueId = `dialogue_${course.id}_${chapter.id}_${Date.now()}`;
      await saveDialogue({
        id: dialogueId,
        courseId: course.id,
        chapterId: chapter.id,
        messages: messages,
        title: `${course.title} - ${chapter.title} 对话`,
        createdAt: Date.now()
      });
      console.log('[LearningPage] 对话已保存:', dialogueId, messages.length, '条消息');
    } catch (error) {
      console.warn('[LearningPage] 保存对话失败:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isAiTyping) return;

    const userMessage: AIMessage = {
      role: 'user',
      content: inputMessage,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsAiTyping(true);

    try {
      const response = await chatWithAI([
        ...messages,
        userMessage
      ]);

      const aiMessage: AIMessage = {
        role: 'assistant',
        content: response,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, aiMessage]);

      // 如果开启了TTS，朗读AI回复
      if (ttsEnabled) {
        speak(response);
      }

      // 保存对话
      setTimeout(() => {
        saveCurrentDialogue();
      }, 500);
    } catch (error) {
      console.error('[LearningPage] Chat error:', error);
      toast.error('AI回复失败，请重试');
    } finally {
      setIsAiTyping(false);
    }
  };

  const handleVoiceInput = () => {
    if (isListening) return;

    setIsListening(true);
    const recognition = startSpeechRecognition(
      (text) => {
        setInputMessage(text);
        setIsListening(false);
      },
      (error) => {
        console.error('[LearningPage] Speech recognition error:', error);
        toast.error('语音识别失败');
        setIsListening(false);
      }
    );

    // 5秒后自动停止
    setTimeout(() => {
      recognition.stop();
      setIsListening(false);
    }, 5000);
  };

  const detectCodeLanguage = (code: string): string => {
    const trimmedCode = code.trim().toLowerCase();
    
    // Python检测
    if (trimmedCode.includes('def ') ||
        trimmedCode.includes('import ') ||
        trimmedCode.includes('print(') ||
        trimmedCode.includes('for ') && trimmedCode.includes(' in ') ||
        trimmedCode.includes('if __name__') ||
        trimmedCode.startsWith('#') && !trimmedCode.includes('//')) {
      return 'python';
    }
    
    // HTML检测
    if (trimmedCode.includes('<!doctype') ||
        trimmedCode.includes('<html') ||
        trimmedCode.includes('<div') ||
        trimmedCode.includes('<style') ||
        trimmedCode.includes('<script')) {
      return 'html';
    }
    
    // JavaScript/JSX检测
    if (trimmedCode.includes('function ') ||
        trimmedCode.includes('const ') ||
        trimmedCode.includes('let ') ||
        trimmedCode.includes('console.log') ||
        trimmedCode.includes('import ') && (trimmedCode.includes('from ') || trimmedCode.includes('require(')) ||
        trimmedCode.includes('export ') ||
        trimmedCode.includes('</') || trimmedCode.includes('/>') ||
        trimmedCode.includes('react')) {
      return 'javascript';
    }
    
    // 默认返回JavaScript
    return 'javascript';
  };

  const handleRunCode = async () => {
    if (!code.trim()) {
      toast.error('请输入代码');
      return;
    }

    setIsRunning(true);
    setCodeOutput('');

    // 检测代码语言
    const language = detectCodeLanguage(code);
    console.log(`[LearningPage] 检测到语言: ${language}, 代码长度: ${code.length}`);

    try {
      const result = await executeCode(code, language);
      setCodeOutput(result.output || result.error || '无输出');

      if (result.success) {
        toast.success('代码执行成功');
      } else {
        toast.error('代码执行失败');
        
        // 如果代码执行失败，使用AI生成模拟结果
        try {
          const aiResponse = await chatWithAI([
            {
              role: 'system',
              content: `你是一个代码执行模拟器。用户运行了以下${language}代码但执行失败：
\`\`\`${language}
${code}
\`\`\`

错误信息：${result.error || '未知错误'}

请生成一个模拟的执行结果，包括：
1. 如果代码语法正确，应该输出什么
2. 解释代码的作用
3. 提供修复建议（如果有错误）

请用中文回答，格式清晰易读。`
            },
            {
              role: 'user',
              content: '请生成模拟执行结果'
            }
          ]);
          
          // 在原有错误信息后添加AI生成的模拟结果
          setCodeOutput(prev => prev + '\n\n--- AI模拟结果 ---\n' + aiResponse);
        } catch (aiError) {
          console.warn('[LearningPage] AI模拟失败:', aiError);
        }
      }
    } catch (error) {
      console.error('[LearningPage] Code execution error:', error);
      toast.error('代码执行出错');
      
      // 完全失败时也尝试使用AI
      try {
        const aiResponse = await chatWithAI([
          {
            role: 'system',
            content: `你是一个代码执行模拟器。用户尝试运行以下${language}代码但执行器完全失败：
\`\`\`${language}
${code}
\`\`\`

请生成一个模拟的执行结果，包括：
1. 如果代码语法正确，应该输出什么
2. 解释代码的作用
3. 提供可能的错误原因

请用中文回答，格式清晰易读。`
          },
          {
            role: 'user',
            content: '请生成模拟执行结果'
          }
        ]);
        
        setCodeOutput(`代码执行器出错（${language}）。AI模拟结果：\n` + aiResponse);
      } catch (aiError) {
        console.warn('[LearningPage] AI模拟失败:', aiError);
        setCodeOutput('代码执行出错，且AI模拟也失败。请检查代码语法。');
      }
    } finally {
      setIsRunning(false);
    }
  };

  const handleCompleteChapter = async () => {
    if (!chapter || !course) return;

    try {
      // 更新章节状态
      chapter.status = 'completed';
      await put(STORES.CHAPTERS, chapter);

      // 更新课程进度
      course.completedChapters++;
      if (course.completedChapters >= course.totalChapters) {
        course.status = 'completed';
      }
      await put(STORES.COURSES, course);

      // 解锁下一章
      const nextChapter = chapters.find(c => c.order === chapter.order + 1);
      if (nextChapter && nextChapter.status === 'locked') {
        nextChapter.status = 'available';
        await put(STORES.CHAPTERS, nextChapter);
      }

      toast.success('章节完成！获得经验值');

      // 进入下一章或返回课程详情
      if (nextChapter) {
        onNavigate('learning', { courseId, chapterId: nextChapter.id });
      } else {
        onNavigate('course-detail', { courseId });
      }
    } catch (error) {
      console.error('[LearningPage] Complete chapter error:', error);
      toast.error('完成章节失败');
    }
  };

  /**
   * 显示游戏组件
   */
  const displayGameComponent = (component: GameComponent) => {
    setActiveGameComponent(component);
    setShowGameComponent(true);
    setGameComponentAnswer(null);
  };

  /**
   * 提交游戏组件答案
   */
  const submitGameComponentAnswer = () => {
    if (!activeGameComponent) return;

    // 简单的答案验证逻辑
    let isCorrect = false;
    
    if (activeGameComponent.type === 'fill-blank') {
      // 代码填空验证
      const userAnswers = Array.isArray(gameComponentAnswer) ? gameComponentAnswer : [gameComponentAnswer];
      const correctAnswers = activeGameComponent.solution || [];
      isCorrect = userAnswers.length === correctAnswers.length &&
                  userAnswers.every((ans, idx) =>
                    ans?.toString().toLowerCase() === correctAnswers[idx]?.toString().toLowerCase()
                  );
    } else if (activeGameComponent.type === 'multi-choice') {
      // 多选题验证
      isCorrect = gameComponentAnswer === activeGameComponent.solution;
    }

    if (isCorrect) {
      toast.success('回答正确！');
      // 添加AI回复
      const aiMessage: AIMessage = {
        role: 'assistant',
        content: '太棒了！你答对了！让我们继续学习吧。',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, aiMessage]);
    } else {
      toast.error('回答不正确，请再试一次');
      // 提供提示
      if (activeGameComponent.hints && activeGameComponent.hints.length > 0) {
        const hint = activeGameComponent.hints[0];
        const hintMessage: AIMessage = {
          role: 'assistant',
          content: `提示：${hint}`,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, hintMessage]);
      }
    }

    // 关闭游戏组件
    setTimeout(() => {
      setShowGameComponent(false);
      setActiveGameComponent(null);
    }, 2000);
  };

  /**
   * 渲染游戏组件
   */
  const renderGameComponent = () => {
    if (!activeGameComponent || !showGameComponent) return null;

    switch (activeGameComponent.type) {
      case 'fill-blank':
        return (
          <Card className="glass-card mt-4">
            <CardContent className="p-6">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Puzzle className="w-5 h-5" />
                代码填空挑战
              </h3>
              <p className="text-sm text-slate-400 mb-4">{activeGameComponent.instructions}</p>
              
              <div className="bg-slate-900/50 p-4 rounded-lg font-mono text-sm mb-4">
                <pre>{activeGameComponent.data?.code || '// 代码填空'}</pre>
              </div>
              
              <div className="space-y-2">
                {activeGameComponent.data?.blanks?.map((blank: any, index: number) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-sm">空白 {index + 1}:</span>
                    <input
                      type="text"
                      className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-1 text-sm"
                      placeholder="请输入答案"
                      onChange={(e) => {
                        const answers = [...(Array.isArray(gameComponentAnswer) ? gameComponentAnswer : [])];
                        answers[index] = e.target.value;
                        setGameComponentAnswer(answers);
                      }}
                    />
                  </div>
                ))}
              </div>
              
              <Button onClick={submitGameComponentAnswer} className="w-full mt-4">
                提交答案
              </Button>
            </CardContent>
          </Card>
        );

      case 'multi-choice':
        return (
          <Card className="glass-card mt-4">
            <CardContent className="p-6">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <ListChecks className="w-5 h-5" />
                选择题
              </h3>
              <p className="text-sm text-slate-400 mb-4">{activeGameComponent.instructions}</p>
              
              <div className="space-y-2">
                {activeGameComponent.data?.options?.map((option: string, index: number) => (
                  <Button
                    key={index}
                    variant={gameComponentAnswer === option ? 'default' : 'outline'}
                    className="w-full justify-start"
                    onClick={() => setGameComponentAnswer(option)}
                  >
                    {option}
                  </Button>
                ))}
              </div>
              
              <Button onClick={submitGameComponentAnswer} className="w-full mt-4">
                提交答案
              </Button>
            </CardContent>
          </Card>
        );

      case 'code-exec':
        return (
          <Card className="glass-card mt-4">
            <CardContent className="p-6">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Code2 className="w-5 h-5" />
                代码执行挑战
              </h3>
              <p className="text-sm text-slate-400 mb-4">{activeGameComponent.instructions}</p>
              
              <Textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="在此输入代码..."
                className="font-mono text-sm min-h-[120px] bg-slate-900/50 mb-4"
              />
              
              <div className="flex gap-2">
                <Button onClick={handleRunCode} disabled={isRunning}>
                  <Play className="w-4 h-4 mr-2" />
                  {isRunning ? '运行中...' : '运行代码'}
                </Button>
                <Button onClick={submitGameComponentAnswer} variant="outline">
                  完成挑战
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      default:
        return (
          <Card className="glass-card mt-4">
            <CardContent className="p-6">
              <h3 className="font-semibold mb-2">游戏挑战</h3>
              <p className="text-sm text-slate-400">{activeGameComponent.instructions}</p>
              <Button onClick={submitGameComponentAnswer} className="w-full mt-4">
                完成挑战
              </Button>
            </CardContent>
          </Card>
        );
    }
  };

  /**
   * 渲染当前阶段的游戏组件
   */
  const renderCurrentStageGameComponents = () => {
    const currentStage = structuredStages[currentStageIndex];
    if (!currentStage || !currentStage.gameComponents || currentStage.gameComponents.length === 0) {
      return null;
    }

    // 只显示第一个游戏组件
    const component = currentStage.gameComponents[0];
    return (
      <div className="mt-4">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => displayGameComponent(component)}
        >
          <MousePointerClick className="w-4 h-4 mr-2" />
          开始游戏挑战
        </Button>
      </div>
    );
  };

  const getStageLabel = () => {
    switch (stage) {
      case 'explanation': return '讲解中';
      case 'practice': return '练习中';
      case 'test': return '测试中';
      case 'summary': return '总结';
    }
  };

  /**
   * 渲染Markdown内容
   */
  const renderMarkdown = (content: string) => {
    try {
      // 配置marked选项
      marked.setOptions({
        gfm: true, // GitHub Flavored Markdown
        breaks: true, // 将换行符转换为<br>
      });

      // 简单的代码高亮处理
      const html = marked.parse(content);
      return { __html: html };
    } catch (error) {
      console.error('Markdown渲染错误:', error);
      return { __html: `<div class="text-red-400">Markdown渲染失败: ${content}</div>` };
    }
  };

  /**
   * 获取当前阶段
   */
  const getCurrentStage = () => {
    if (structuredStages.length > 0 && currentStageIndex < structuredStages.length) {
      return structuredStages[currentStageIndex];
    }
    return null;
  };

  /**
   * 切换到下一个阶段
   */
  const goToNextStage = () => {
    if (currentStageIndex < structuredStages.length - 1) {
      const nextIndex = currentStageIndex + 1;
      setCurrentStageIndex(nextIndex);
      setCurrentDialogueIndex(0);
      
      // 开始新阶段的对话流
      const nextStage = structuredStages[nextIndex];
      if (nextStage?.dialogue && nextStage.dialogue.length > 0) {
        startDialogueStreaming(nextStage.dialogue);
      }
      
      toast.success(`进入${nextStage.name}阶段`);
    } else {
      toast.info('已经是最后一个阶段');
    }
  };

  /**
   * 切换到上一个阶段
   */
  const goToPrevStage = () => {
    if (currentStageIndex > 0) {
      const prevIndex = currentStageIndex - 1;
      setCurrentStageIndex(prevIndex);
      setCurrentDialogueIndex(0);
      
      // 开始前一阶段的对话流
      const prevStage = structuredStages[prevIndex];
      if (prevStage?.dialogue && prevStage.dialogue.length > 0) {
        startDialogueStreaming(prevStage.dialogue);
      }
      
      toast.success(`返回${prevStage.name}阶段`);
    } else {
      toast.info('已经是第一个阶段');
    }
  };

  /**
   * 渲染阶段导航
   */
  const renderStageNavigation = () => {
    if (structuredStages.length <= 1) return null;

    const currentStage = getCurrentStage();
    
    return (
      <div className="flex items-center justify-between mb-4 p-4 bg-slate-800/30 rounded-lg">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-400" />
          <span className="font-medium">学习阶段:</span>
          <Badge variant="outline" className="ml-2">
            {currentStage?.name || '未知阶段'}
          </Badge>
          <span className="text-sm text-slate-400">
            ({currentStageIndex + 1}/{structuredStages.length})
          </span>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPrevStage}
            disabled={currentStageIndex === 0}
          >
            <ChevronUp className="w-4 h-4 mr-1" />
            上一阶段
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={goToNextStage}
            disabled={currentStageIndex >= structuredStages.length - 1}
          >
            下一阶段
            <ChevronDown className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    );
  };

  /**
   * 渲染阶段内容
   */
  const renderStageContent = () => {
    const currentStage = getCurrentStage();
    if (!currentStage) return null;

    // 检查是否有对话内容
    const hasDialogue = currentStage.dialogue && currentStage.dialogue.length > 0;
    const hasMessages = messages.length > 0;

    return (
      <div className="space-y-4">
        {/* 阶段标题 */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            {currentStage.type === 'explanation' && <BookOpen className="w-5 h-5" />}
            {currentStage.type === 'example' && <FileText className="w-5 h-5" />}
            {currentStage.type === 'practice' && <Gamepad2 className="w-5 h-5" />}
            {currentStage.type === 'test' && <ListChecks className="w-5 h-5" />}
            {currentStage.type === 'summary' && <Trophy className="w-5 h-5" />}
            {currentStage.name}
          </h3>
          <Badge variant={currentStage.type === 'practice' ? 'default' : 'outline'}>
            {currentStage.type === 'explanation' && '讲解'}
            {currentStage.type === 'example' && '示例'}
            {currentStage.type === 'practice' && '练习'}
            {currentStage.type === 'test' && '测试'}
            {currentStage.type === 'summary' && '总结'}
          </Badge>
        </div>

        {/* 对话内容显示区域 */}
        {(hasDialogue || hasMessages) && (
          <div className="space-y-3 p-4 rounded-lg bg-slate-800/30">
            <h4 className="font-medium flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              教学对话
            </h4>
            
            {/* 显示结构化对话 */}
            {hasDialogue && currentStage.dialogue?.map((line, index) => (
              <div
                key={index}
                className={`flex ${line.speaker === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    line.speaker === 'user'
                      ? 'bg-indigo-500 text-white'
                      : 'bg-slate-700/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs opacity-70">
                      {line.speaker === 'ai' ? 'AI导师' : '你'}
                    </span>
                  </div>
                  <p>{line.content}</p>
                </div>
              </div>
            ))}
            
            {/* 显示实时对话消息 */}
            {hasMessages && !hasDialogue && messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-indigo-500 text-white'
                      : 'bg-slate-700/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs opacity-70">
                      {msg.role === 'assistant' ? 'AI导师' : '你'}
                    </span>
                  </div>
                  <div
                    className="prose prose-invert max-w-none text-sm"
                    dangerouslySetInnerHTML={renderMarkdown(msg.content)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 阶段内容 */}
        {currentStage.content && (
          <div
            className="prose prose-invert max-w-none p-4 rounded-lg bg-slate-800/30"
            dangerouslySetInnerHTML={renderMarkdown(currentStage.content)}
          />
        )}

        {/* 游戏组件入口 */}
        {renderCurrentStageGameComponents()}
      </div>
    );
  };

  /**
   * 渲染所有阶段概览
   */
  const renderStagesOverview = () => {
    if (structuredStages.length === 0) return null;

    return (
      <div className="mb-6">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <ChevronDown className="w-4 h-4" />
          学习阶段概览
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          {structuredStages.map((stage, index) => (
            <Button
              key={stage.id}
              variant={index === currentStageIndex ? 'default' : 'outline'}
              size="sm"
              className="flex flex-col items-center justify-center h-20"
              onClick={() => {
                setCurrentStageIndex(index);
                setCurrentDialogueIndex(0);
                if (stage.dialogue && stage.dialogue.length > 0) {
                  startDialogueStreaming(stage.dialogue);
                }
              }}
            >
              <div className="text-xs mb-1">
                {stage.type === 'explanation' && <BookOpen className="w-4 h-4" />}
                {stage.type === 'example' && <FileText className="w-4 h-4" />}
                {stage.type === 'practice' && <Gamepad2 className="w-4 h-4" />}
                {stage.type === 'test' && <ListChecks className="w-4 h-4" />}
                {stage.type === 'summary' && <Trophy className="w-4 h-4" />}
              </div>
              <span className="text-xs font-medium">{stage.name}</span>
              <span className="text-xs text-slate-400 mt-1">阶段 {index + 1}</span>
            </Button>
          ))}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!course || !chapter) {
    return (
      <div className="text-center py-16">
        <BookOpen className="w-16 h-16 text-slate-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold">课程加载失败</h3>
        <Button onClick={() => onNavigate('courses')} className="mt-4">
          返回课程列表
        </Button>
      </div>
    );
  }

  const progress = chapters.length > 0
    ? ((chapter.order + 1) / chapters.length) * 100
    : 0;

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-6 animate-fade-in">
      {/* 左侧：讲解和对话区域 (2/3宽度) */}
      <div className="flex-1 flex flex-col w-2/3">
        {/* 顶部导航 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => onNavigate('course-detail', { courseId })}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-semibold">{chapter.title}</h1>
              <p className="text-sm text-slate-400">{course.title}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Badge className="bg-indigo-500/20 text-indigo-400">
              {getStageLabel()}
            </Badge>
            <div className="w-32">
              <Progress value={progress} className="h-2" />
            </div>
          </div>
        </div>

        {/* 阶段概览 */}
        {renderStagesOverview()}

        {/* 学习区域 */}
        <Card className="flex-1 glass-card overflow-hidden flex flex-col">
          {/* 阶段导航 */}
          {renderStageNavigation()}
          
          {/* 内容区域 - 使用Tabs切换对话和阶段内容 */}
          <Tabs defaultValue="content" className="flex-1 flex flex-col">
            <TabsList className="glass-card mx-4 mt-4">
              <TabsTrigger value="content" className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                学习内容
              </TabsTrigger>
              <TabsTrigger value="dialogue" className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                对话记录
              </TabsTrigger>
              <TabsTrigger value="games" className="flex items-center gap-2">
                <Gamepad2 className="w-4 h-4" />
                游戏挑战
              </TabsTrigger>
            </TabsList>
            
            {/* 学习内容标签页 - 可滚动 */}
            <TabsContent value="content" className="flex-1 overflow-y-auto p-4" style={{ maxHeight: '400px' }}>
              {renderStageContent()}
              
              {/* 游戏组件显示区域 */}
              {renderGameComponent()}
              
              {/* 如果没有结构化内容，显示传统对话 */}
              {structuredStages.length === 0 && messages.length > 0 && (
                <div className="mt-4 p-4 rounded-lg bg-slate-800/30">
                  <h3 className="font-semibold mb-2">课程内容</h3>
                  <div
                    className="prose prose-invert max-w-none"
                    dangerouslySetInnerHTML={renderMarkdown(messages[0]?.content || '')}
                  />
                </div>
              )}
            </TabsContent>
            
            {/* 对话记录标签页 - 可滚动 */}
            <TabsContent value="dialogue" className="flex-1 overflow-y-auto p-4 space-y-4" style={{ maxHeight: '400px' }}>
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-indigo-500 text-white'
                        : 'glass-card'
                    }`}
                  >
                    <div
                      className="prose prose-invert max-w-none"
                      dangerouslySetInnerHTML={renderMarkdown(msg.content)}
                    />
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => speak(msg.content)}
                        >
                          <Volume2 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {isAiTyping && (
                <div className="flex justify-start">
                  <div className="glass-card rounded-2xl px-4 py-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100" />
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200" />
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </TabsContent>
            
            {/* 游戏挑战标签页 - 可滚动 */}
            <TabsContent value="games" className="flex-1 overflow-y-auto p-4" style={{ maxHeight: '400px' }}>
              {structuredStages.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="font-semibold mb-4">本课游戏挑战</h3>
                  {structuredStages.map((stage, index) => (
                    <Card key={stage.id} className="glass-card">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium flex items-center gap-2">
                            {stage.type === 'practice' && <Gamepad2 className="w-4 h-4" />}
                            {stage.type === 'test' && <ListChecks className="w-4 h-4" />}
                            阶段 {index + 1}: {stage.name}
                          </h4>
                          <Badge variant="outline">
                            {stage.gameComponents?.length || 0} 个挑战
                          </Badge>
                        </div>
                        
                        {stage.gameComponents && stage.gameComponents.length > 0 ? (
                          <div className="space-y-2">
                            {stage.gameComponents.map((component, compIndex) => (
                              <Button
                                key={compIndex}
                                variant="outline"
                                className="w-full justify-start"
                                onClick={() => displayGameComponent(component)}
                              >
                                <MousePointerClick className="w-4 h-4 mr-2" />
                                {component.instructions}
                              </Button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400">此阶段暂无游戏挑战</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Gamepad2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold">暂无游戏挑战</h3>
                  <p className="text-sm text-slate-400 mt-2">
                    此课程章节尚未生成游戏化内容
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* 代码编辑器（练习模式） */}
          {stage === 'practice' && (
            <div className="border-t border-slate-700 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">代码编辑器</span>
                <Button size="sm" onClick={handleRunCode} disabled={isRunning}>
                  <Play className="w-4 h-4 mr-2" />
                  {isRunning ? '运行中...' : '运行'}
                </Button>
              </div>
              <Textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="在此输入代码..."
                className="font-mono text-sm min-h-[120px] bg-slate-900/50"
              />
              {codeOutput && (
                <div className="mt-2 p-3 rounded-lg bg-slate-900/50 font-mono text-sm">
                  <pre>{codeOutput}</pre>
                </div>
              )}
            </div>
          )}

          {/* 输入区域 */}
          <div className="border-t border-slate-700 p-4">
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTtsEnabled(!ttsEnabled)}
                className={ttsEnabled ? 'text-indigo-400' : ''}
              >
                {ttsEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={handleVoiceInput}
                className={isListening ? 'text-red-400 animate-pulse' : ''}
              >
                <Mic className="w-5 h-5" />
              </Button>
              
              <Textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="输入消息或问题..."
                className="flex-1 min-h-[44px] max-h-[120px] resize-none"
              />
              
              <Button onClick={handleSendMessage} disabled={isAiTyping || !inputMessage.trim()}>
                <Send className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </Card>

        {/* 底部操作 */}
        <div className="flex justify-between mt-4">
          <Button
            variant="outline"
            disabled={chapter.order === 0}
            onClick={() => {
              const prev = chapters.find(c => c.order === chapter.order - 1);
              if (prev) onNavigate('learning', { courseId, chapterId: prev.id });
            }}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            上一节
          </Button>
          
          <Button onClick={handleCompleteChapter} className="bg-green-500 hover:bg-green-600">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            完成本节
          </Button>
          
          <Button
            variant="outline"
            disabled={chapter.order >= chapters.length - 1}
            onClick={() => {
              const next = chapters.find(c => c.order === chapter.order + 1);
              if (next) onNavigate('learning', { courseId, chapterId: next.id });
            }}
          >
            下一节
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>

      {/* 右侧：代码编辑器区域 (1/3宽度) */}
      <div className="w-1/3 flex flex-col gap-4">
        {/* 代码编辑器卡片 */}
        <Card className="glass-card flex-1 flex flex-col">
          <CardContent className="p-4 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Code2 className="w-5 h-5" />
                代码编辑器
              </h3>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    // 根据课程内容自动填充示例代码
                    if (course.title.includes('JavaScript') || course.title.includes('前端')) {
                      setCode(`// JavaScript示例代码
function greet(name) {
  return "Hello, " + name + "!";
}

console.log(greet("World"));`);
                    } else if (course.title.includes('Python')) {
                      setCode(`# Python示例代码
def greet(name):
    return f"Hello, {name}!"

print(greet("World"))`);
                    } else if (course.title.includes('React')) {
                      setCode(`// React组件示例
import React from 'react';

function App() {
  return (
    <div className="App">
      <h1>Hello, World!</h1>
      <p>这是一个React组件示例</p>
    </div>
  );
}

export default App;`);
                    }
                  }}
                >
                  示例代码
                </Button>
                <Button size="sm" onClick={handleRunCode} disabled={isRunning}>
                  <Play className="w-4 h-4 mr-2" />
                  {isRunning ? '运行中...' : '运行'}
                </Button>
              </div>
            </div>
            
            {/* 代码编辑器 */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-xs">
                    {course.title.includes('JavaScript') ? 'JavaScript' :
                     course.title.includes('Python') ? 'Python' :
                     course.title.includes('React') ? 'JSX' : 'Text'}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    自动检测
                  </Badge>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setCode('')}
                  className="h-6 px-2"
                >
                  清空
                </Button>
              </div>
              
              <Textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={`在此输入${course.title.includes('JavaScript') ? 'JavaScript' : course.title.includes('Python') ? 'Python' : ''}代码...`}
                className="font-mono text-sm flex-1 min-h-[300px] bg-slate-900/50 resize-none"
                style={{ minHeight: '300px', maxHeight: '400px' }}
              />
            </div>
            
            {/* 运行结果 */}
            {codeOutput && (
              <div className="mt-4">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Play className="w-4 h-4" />
                  运行结果
                </h4>
                <div className="p-3 rounded-lg bg-slate-900/50 font-mono text-sm overflow-auto max-h-[200px]">
                  <pre className="whitespace-pre-wrap">{codeOutput}</pre>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* 章节导航卡片 */}
        <Card className="glass-card">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-4">章节列表</h3>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {chapters.map((c, index) => (
                <button
                  key={c.id}
                  onClick={() => onNavigate('learning', { courseId, chapterId: c.id })}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-all ${
                    c.id === chapter.id
                      ? 'bg-indigo-500/20 border border-indigo-500/30'
                      : 'hover:bg-slate-800/50'
                  } ${c.status === 'locked' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={c.status === 'locked'}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                    c.status === 'completed'
                      ? 'bg-green-500/20 text-green-400'
                      : c.id === chapter.id
                      ? 'bg-indigo-500 text-white'
                      : 'bg-slate-700 text-slate-400'
                  }`}>
                    {c.status === 'completed' ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span className="text-sm truncate flex-1">{c.title}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
