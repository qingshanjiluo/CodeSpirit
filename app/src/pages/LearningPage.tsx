/**
 * CodeSpirit 学习页面 - AI驱动式四区布局
 * 左上: 教学文本区(动态更新) | 右上: 代码区(课程语言)
 * 左下: 教学交互区(AI生成)   | 右下: 对话区(实时流式)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  PanelLeftClose,
  PanelLeft,
  PanelRightClose,
  PanelRight,
  Play,
  Send,
  Loader2,
  SkipForward,
  Volume2,
  VolumeX,
  Mic,
  MessageCircle,
  Sparkles,
  Code2,
  Terminal,
  Trash2,
  Copy,
  Check,
  FileCode,
  Lightbulb,
  RotateCcw,
  Puzzle,
  ListChecks,
  Folder,
  FolderOpen,
  Plus,
  X,
  FileText,
  Library,
  Wand2,
  Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { get, getAllByIndex, put, STORES, saveDialogue, getLatestDialogue } from '@/db';
import { chatWithAI, getAIConfig, getCodeOptimization } from '@/ai';
import { executeCode } from '@/utils/codeSandbox';
import { speak, startSpeechRecognition, generateId } from '@/utils';
import {
  createDefaultProject,
  createFile,
  createDirectory,
  deleteNode,
  updateFileContent,
  renameNode,
  findNode,
  flattenFiles,
  buildHtmlEntry,
} from '@/utils/vfs';
import type { Course, Chapter, AIMessage, Note, VirtualProject, VFSNode } from '@/types';
import type { PageType } from '@/App';
import { toast } from 'sonner';
import { marked } from 'marked';

// ============ 类型 ============
interface GameComponent {
  type: 'fill-blank' | 'multi-choice' | 'code-exec';
  data: any;
  instructions: string;
  solution?: any;
  hints?: string[];
}

interface ParsedResponse {
  content: string;
  gameComponent: GameComponent | null;
  codeBlock: { lang: string; code: string } | null;
  stageIntent: string | null;
}

// ============ 工具函数 ============
function parseAIResponse(raw: string): ParsedResponse {
  let content = raw;

  // 解析交互组件 [INTERACTION:...] — 使用嵌套深度扫描找到匹配的 ]
  let gameComponent: GameComponent | null = null;
  const startIdx = raw.indexOf('[INTERACTION:');
  if (startIdx !== -1) {
    try {
      let depth = 0;
      let endIdx = -1;
      for (let i = startIdx; i < raw.length; i++) {
        if (raw[i] === '[') depth++;
        else if (raw[i] === ']') {
          depth--;
          if (depth === 0) { endIdx = i; break; }
        }
      }
      if (endIdx !== -1) {
        const inner = raw.slice(startIdx + 13, endIdx).trim();
        const params: Record<string, string> = {};
        // 按已知参数名提取，避免 JSON 内部 '|' 干扰
        const knownKeys = ['type', 'data', 'instructions', 'solution', 'hints'];
        let pos = 0;
        while (pos < inner.length) {
          const eqIdx = inner.indexOf('=', pos);
          if (eqIdx === -1) break;
          const key = inner.slice(pos, eqIdx).trim();
          let valEnd = inner.length;
          for (const k of knownKeys) {
            const idx = inner.indexOf('|' + k + '=', eqIdx + 1);
            if (idx !== -1 && idx < valEnd) valEnd = idx;
          }
          params[key] = inner.slice(eqIdx + 1, valEnd).trim();
          pos = valEnd + 1;
        }
        gameComponent = {
          type: (params.type as any) || 'multi-choice',
          data: params.data ? JSON.parse(params.data) : {},
          instructions: params.instructions || '请完成以下挑战',
          solution: params.solution ? JSON.parse(params.solution) : undefined,
          hints: params.hints ? JSON.parse(params.hints) : undefined,
        };
        content = content.slice(0, startIdx) + content.slice(endIdx + 1);
        content = content.trim();
      }
    } catch (e) {
      console.warn('解析交互组件失败', e);
    }
  }

  // 提取代码块
  let codeBlock: { lang: string; code: string } | null = null;
  const codeMatch = raw.match(/```(\w+)?\n([\s\S]*?)```/);
  if (codeMatch) {
    codeBlock = {
      lang: codeMatch[1] || 'javascript',
      code: codeMatch[2].trim(),
    };
  }

  // 检测阶段意图
  let stageIntent: string | null = null;
  if (raw.includes('[STAGE:explanation]')) stageIntent = 'explanation';
  else if (raw.includes('[STAGE:example]')) stageIntent = 'example';
  else if (raw.includes('[STAGE:practice]')) stageIntent = 'practice';
  else if (raw.includes('[STAGE:test]')) stageIntent = 'test';
  else if (raw.includes('[STAGE:summary]')) stageIntent = 'summary';
  if (stageIntent) {
    content = content.replace(/\[STAGE:\w+\]/g, '').trim();
  }

  return { content, gameComponent, codeBlock, stageIntent };
}

function inferLanguage(courseTitle: string): string {
  const t = courseTitle.toLowerCase();
  if (t.includes('python')) return 'python';
  if (t.includes('html') || t.includes('css')) return 'html';
  if (t.includes('typescript') || t.includes('ts')) return 'typescript';
  if (t.includes('java') && !t.includes('javascript') && !t.includes('js')) return 'java';
  if (t.includes('go ') || t.includes('golang')) return 'go';
  if (t.includes('rust')) return 'rust';
  if (t.includes('c++') || t.includes('cpp')) return 'cpp';
  if (t.includes('c#') || t.includes('csharp')) return 'csharp';
  return 'javascript';
}

function renderMarkdown(content: string) {
  try {
    marked.setOptions({ gfm: true, breaks: true });
    return { __html: marked.parse(content) };
  } catch {
    return { __html: `<p>${content}</p>` };
  }
}

// ============ 主组件 ============
interface LearningPageProps {
  courseId: string;
  chapterId: string | null;
  onNavigate: (page: PageType, params?: any) => void;
}

export function LearningPage({ courseId, chapterId, onNavigate }: LearningPageProps) {
  // --- 数据 ---
  const [course, setCourse] = useState<Course | null>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasAI, setHasAI] = useState(true);

  // --- 教学区 ---
  const [teachingContent, setTeachingContent] = useState('');
  const [currentStage, setCurrentStage] = useState('讲解');
  const [stageHistory, setStageHistory] = useState<string[]>(['讲解']);

  // --- 代码区 ---
  const [project, setProject] = useState<VirtualProject>(createDefaultProject('javascript'));
  const activeFile = project.activeFileId ? findNode(project.root, project.activeFileId) : null;
  const [codeOutput, setCodeOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [codeLang, setCodeLang] = useState('javascript');
  const [copied, setCopied] = useState(false);
  const [newFileDialog, setNewFileDialog] = useState<{ open: boolean; type: 'file' | 'directory'; targetDirId?: string }>({ open: false, type: 'file' });
  const [newFileName, setNewFileName] = useState('');
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const [renamingNode, setRenamingNode] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // --- 交互区 ---
  const [gameComponent, setGameComponent] = useState<GameComponent | null>(null);
  const [interactionAnswer, setInteractionAnswer] = useState<any>(null);
  const [interactionSubmitted, setInteractionSubmitted] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // --- AI优化 ---
  const [optimization, setOptimization] = useState<{
    original: string;
    optimized: string;
    feedback: string;
    explanation: string;
    timeComplexity: string;
    spaceComplexity: string;
  } | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // --- 依赖库面板 ---
  const [libPanelOpen, setLibPanelOpen] = useState(false);
  const [hoverLib, setHoverLib] = useState<string | null>(null);

  // --- 对话区 ---
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [autoNoteEnabled, setAutoNoteEnabled] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isAiTyping && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isAiTyping]);

  // --- 布局 ---
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  // 初始化展开根目录
  useEffect(() => {
    setExpandedDirs(new Set([project.root.id]));
  }, []);

  // ========== 初始化 ==========
  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, chapterId]);

  // 对话自动滚动
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiTyping]);

  const init = async () => {
    setIsLoading(true);
    try {
      // 检查AI配置
      try {
        const cfg = await getAIConfig();
        setHasAI(cfg.apiKeys.length > 0);
      } catch {
        setHasAI(false);
      }

      const courseData = await get<Course>(STORES.COURSES, courseId);
      if (!courseData) {
        toast.error('课程不存在');
        onNavigate('courses');
        return;
      }
      setCourse(courseData);
      const inferredLang = inferLanguage(courseData.title);
      setCodeLang(inferredLang);
      setProject(createDefaultProject(inferredLang));

      const chaptersData = await getAllByIndex<Chapter>(STORES.CHAPTERS, 'courseId', courseId);
      let arr: Chapter[] = Array.isArray(chaptersData) ? chaptersData : chaptersData ? [chaptersData] : [];
      arr = arr.sort((a, b) => (a.order || 0) - (b.order || 0));
      setChapters(arr);

      let curr = chapterId ? arr.find((c) => c.id === chapterId) || arr[0] : arr.find((c) => c.status !== 'completed') || arr[0];
      if (curr) {
        setChapter(curr);
        // 尝试加载历史对话
        try {
          const saved = await getLatestDialogue(courseId, curr.id);
          if (saved?.messages?.length) {
            setMessages(saved.messages);
            // 从最后一条AI消息恢复教学区内容
            const lastAi = [...saved.messages].reverse().find((m) => m.role === 'assistant');
            if (lastAi) {
              const parsed = parseAIResponse(lastAi.content);
              setTeachingContent(parsed.content);
              if (parsed.gameComponent) setGameComponent(parsed.gameComponent);
              if (parsed.codeBlock) {
                const lang = parsed.codeBlock.lang;
                setCodeLang(lang);
                setProject(prev => {
                  const files = flattenFiles(prev.root);
                  if (files.length === 1) {
                    return updateFileContent(prev, files[0].id, parsed.codeBlock!.code);
                  }
                  const match = files.find(f => f.language === lang);
                  if (match) {
                    return { ...updateFileContent(prev, match.id, parsed.codeBlock!.code), activeFileId: match.id };
                  }
                  const ext = lang === 'javascript' ? 'js' : lang === 'typescript' ? 'ts' : lang === 'python' ? 'py' : lang === 'html' ? 'html' : 'txt';
                  return createFile(prev, prev.root.id, `example.${ext}`, parsed.codeBlock!.code);
                });
              }
            }
          } else {
            // 新章节：发送欢迎消息
            const welcome = `欢迎来到「${courseData.title}」第${curr.order + 1}节：${curr.title}。\n\n我是你的AI导师，我们将通过对话的方式一起学习本节内容。你可以随时提问，我会根据你的理解情况调整教学节奏。\n\n准备好了吗？让我们开始吧！`;
            setMessages([{ role: 'assistant', content: welcome, timestamp: Date.now() }]);
            setTeachingContent(welcome);
          }
        } catch (e) {
          console.warn('加载对话失败', e);
        }

        courseData.lastStudiedAt = Date.now();
        await put(STORES.COURSES, courseData);
      }
    } catch (err) {
      console.error(err);
      toast.error('加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  // ========== AI对话核心 ==========
  const buildSystemPrompt = useCallback((): string => {
    const stageStr = stageHistory.join(' -> ');
    return `你是一个专业的AI编程导师，正在教授《${course?.title || ''}》第${(chapter?.order || 0) + 1}节：${chapter?.title || ''}。

教学流程规则：
1. 当前教学进度：${stageStr}
2. 使用对话式教学，一次只讲解一个知识点，然后停下来等待学生回应
3. 必须在适当的时候（每1-3轮对话后）生成交互练习来检验学生理解：
   - 填空题：[INTERACTION:type=fill-blank|data={"code":"function greet(){\\n  return \\"___\\";\\n}","blanks":["Hello"]}|instructions=补全代码|solution=["Hello"]|hints=["返回问候语"]]
   - 选择题：[INTERACTION:type=multi-choice|data={"options":["A. const","B. let","C. var","D. function"]}|instructions=选择正确答案|solution="B. let"]
   - 代码执行：[INTERACTION:type=code-exec|data={"code":"console.log(1+1)","language":"javascript"}|instructions=预测输出|solution="2"]
4. 如需切换阶段，在回复末尾添加 [STAGE:practice] 等标记（可选值：explanation, example, practice, test, summary）
5. 提供代码时，使用代码块格式 \`\`\`language 并指定语言
6. 根据学生的回答判断理解程度，决定是否进入下一阶段
7. 如果学生回答正确，给予鼓励并继续；如果错误，耐心解释并给出提示
8. 每次讲解完知识点后，主动提出一个练习或思考题
9. 语言：中文`;
  }, [course, chapter, stageHistory]);

  const handleSendMessage = async (manualContent?: string) => {
    const content = manualContent || inputMessage.trim();
    if (!content || isAiTyping) return;

    const userMsg: AIMessage = { role: 'user', content, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsAiTyping(true);

    try {
      const allMsgs: AIMessage[] = [
        { role: 'system', content: buildSystemPrompt(), timestamp: Date.now() },
        ...messages,
        userMsg,
      ];
      const response = await chatWithAI(allMsgs);
      const parsed = parseAIResponse(response);

      // 更新教学区
      setTeachingContent(parsed.content);

      // 更新代码区
      if (parsed.codeBlock) {
        const lang = parsed.codeBlock.lang;
        setCodeLang(lang);
        setProject(prev => {
          const files = flattenFiles(prev.root);
          if (files.length === 1) {
            return updateFileContent(prev, files[0].id, parsed.codeBlock!.code);
          }
          const match = files.find(f => f.language === lang);
          if (match) {
            return { ...updateFileContent(prev, match.id, parsed.codeBlock!.code), activeFileId: match.id };
          }
          const ext = lang === 'javascript' ? 'js' : lang === 'typescript' ? 'ts' : lang === 'python' ? 'py' : lang === 'html' ? 'html' : 'txt';
          return createFile(prev, prev.root.id, `example.${ext}`, parsed.codeBlock!.code);
        });
      }

      // 更新交互区
      if (parsed.gameComponent) {
        setGameComponent(parsed.gameComponent);
        setInteractionAnswer(null);
        setInteractionSubmitted(false);
        setShowHint(false);
      } else {
        setGameComponent(null);
      }

      // 更新阶段
      if (parsed.stageIntent) {
        const stageMap: Record<string, string> = {
          explanation: '讲解',
          example: '示例',
          practice: '练习',
          test: '测试',
          summary: '总结',
        };
        const newStage = stageMap[parsed.stageIntent] || parsed.stageIntent;
        setCurrentStage(newStage);
        setStageHistory((prev) => [...prev, newStage]);
      }

      const aiMsg: AIMessage = { role: 'assistant', content: response, timestamp: Date.now() };
      setMessages((prev) => [...prev, aiMsg]);

      // 自动生成笔记
      if (autoNoteEnabled && parsed.content) {
        try {
          const noteContent = parsed.content.length > 200
            ? parsed.content.slice(0, 200) + '...'
            : parsed.content;
          const note: Note = {
            id: generateId(),
            title: `${chapter?.title || '课堂笔记'} - ${new Date().toLocaleTimeString()}`,
            content: `## 教学内容\n\n${noteContent}\n\n---\n\n**课程**: ${course?.title || ''}\n**章节**: ${chapter?.title || ''}\n**阶段**: ${currentStage}\n**时间**: ${new Date().toLocaleString()}`,
            category: '课堂笔记',
            tags: [course?.title || '', chapter?.title || '', currentStage],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          await put(STORES.NOTES, note);
          toast.success('已自动生成笔记');
        } catch (e) {
          console.error('Auto note error:', e);
        }
      }

      if (ttsEnabled) speak(parsed.content);
    } catch (error) {
      console.error('Chat error:', error);
      toast.error('AI回复失败');
      const failMsg: AIMessage = {
        role: 'assistant',
        content: '抱歉，我遇到了一些问题。请稍后再试，或者继续提问。',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, failMsg]);
    } finally {
      setIsAiTyping(false);
    }
  };

  // 保存对话
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!course || !chapter || messages.length === 0) return;
      try {
        await saveDialogue({
          id: `dialogue_${course.id}_${chapter.id}_${Date.now()}`,
          courseId: course.id,
          chapterId: chapter.id,
          messages,
          title: `${course.title} - ${chapter.title}`,
          createdAt: Date.now(),
        });
      } catch (e) {
        /* ignore */
      }
    }, 2000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // ========== 代码区 ==========
  const handleRunCode = async () => {
    const files = flattenFiles(project.root);
    if (files.length === 0) {
      toast.error('项目中没有文件');
      return;
    }
    const entry = activeFile || files[0];
    if (!entry || entry.type !== 'file') {
      toast.error('请先选择一个文件');
      return;
    }
    if (!entry.content?.trim()) {
      toast.error('请输入代码');
      return;
    }
    setIsRunning(true);
    setCodeOutput('');
    try {
      let result;
      if (codeLang === 'html') {
        const html = buildHtmlEntry(project);
        result = { success: true, output: html || '<p>空项目</p>', executionTime: 0 };
      } else {
        result = await executeCode(entry.content || '', codeLang);
      }
      setCodeOutput(result.output || result.error || '无输出');
      if (result.success) {
        toast.success('运行成功');
      } else {
        toast.error('运行失败，AI正在分析...');
        await handleSendMessage(
          `我运行了以下${codeLang}代码但出错了：\n\`\`\`${codeLang}\n${entry.content || ''}\n\`\`\`\n\n错误信息：${result.error || '未知错误'}\n\n请帮我分析错误原因并给出修复建议。`
        );
      }
    } catch (e) {
      setCodeOutput('执行异常: ' + String(e));
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(activeFile?.content || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success('已复制');
  };

  const handleLoadSample = () => {
    const lang = codeLang;
    setProject(prev => {
      const p = createDefaultProject(lang);
      if (lang === 'html') {
        const rootId = p.root.id;
        return {
          ...p,
          root: {
            ...p.root,
            children: [
              { id: generateId(), name: 'index.html', type: 'file', content: '<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8">\n  <title>示例页面</title>\n</head>\n<body>\n  <h1>Hello, World!</h1>\n  <p>这是一个多文件 HTML 项目示例。</p>\n</body>\n</html>', language: 'html', parentId: rootId },
              { id: generateId(), name: 'style.css', type: 'file', content: 'body { font-family: system-ui; padding: 40px; background: #0f172a; color: #e2e8f0; }\nh1 { color: #818cf8; }', language: 'css', parentId: rootId },
              { id: generateId(), name: 'script.js', type: 'file', content: 'console.log("Hello from script.js!");\ndocument.querySelector("h1").addEventListener("click", () => {\n  alert("你点击了标题！");\n});', language: 'javascript', parentId: rootId },
            ]
          },
          activeFileId: p.root.children![0].id,
          entryFileId: p.root.children![0].id,
        };
      }
      const samples: Record<string, string> = {
        javascript: `// JavaScript 示例\nfunction greet(name) {\n  return \`Hello, \${name}!\`;\n}\nconsole.log(greet("World"));`,
        python: `# Python 示例\ndef greet(name):\n    return f"Hello, {name}!"\n\nprint(greet("World"))`,
        typescript: `// TypeScript 示例\nfunction greet(name: string): string {\n  return \`Hello, \${name}!\`;\n}\nconsole.log(greet("World"));`,
      };
      const sample = samples[lang] || samples.javascript;
      return { ...p, root: { ...p.root, children: [{ ...p.root.children![0], content: sample }] } };
    });
  };

  // ========== AI 优化 ==========
  const handleOptimizeCode = async () => {
    if (!activeFile || !activeFile.content?.trim()) {
      toast.error('请先选择一个文件并输入代码');
      return;
    }
    setIsOptimizing(true);
    try {
      const result = await getCodeOptimization(
        activeFile.content,
        activeFile.language || codeLang,
        '优化当前代码'
      );
      setOptimization({
        original: activeFile.content,
        optimized: result.optimizedCode,
        feedback: result.feedback,
        explanation: result.explanation,
        timeComplexity: result.timeComplexity,
        spaceComplexity: result.spaceComplexity,
      });
      toast.success('优化完成');
    } catch {
      toast.error('优化失败');
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleAcceptOptimization = () => {
    if (!optimization || !activeFile) return;
    setProject(prev => updateFileContent(prev, activeFile.id, optimization.optimized));
    setOptimization(null);
    toast.success('已应用优化');
  };

  const handleRejectOptimization = () => {
    setOptimization(null);
  };

  // ========== 依赖库快捷插入 ==========
  const libraries: Record<string, Array<{ name: string; description: string; snippet: string }>> = {
    html: [
      { name: 'Tailwind CSS', description: '通过 CDN 引入', snippet: '<script src="https://cdn.tailwindcss.com"></script>' },
      { name: 'Vue 3', description: 'Vue 3 全局构建版', snippet: '<script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>' },
      { name: 'React 18', description: 'UMD 构建版', snippet: '<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>\n<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>' },
      { name: 'jQuery', description: '3.x 最新版', snippet: '<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>' },
      { name: 'Bootstrap', description: 'CSS + JS', snippet: '<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">\n<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>' },
      { name: 'FontAwesome', description: '图标库', snippet: '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">' },
      { name: 'Three.js', description: '3D 渲染库', snippet: '<script type="importmap">\n  {"imports": {"three": "https://unpkg.com/three@0.160.0/build/three.module.js"}}\n</script>' },
      { name: 'Chart.js', description: '图表库', snippet: '<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>' },
    ],
    javascript: [
      { name: 'lodash', description: '工具函数库', snippet: "import _ from 'https://cdn.skypack.dev/lodash';" },
      { name: 'axios', description: 'HTTP 请求库', snippet: "import axios from 'https://cdn.skypack.dev/axios';" },
      { name: 'dayjs', description: '日期处理', snippet: "import dayjs from 'https://cdn.skypack.dev/dayjs';" },
      { name: 'uuid', description: '生成唯一ID', snippet: "import { v4 as uuid } from 'https://cdn.skypack.dev/uuid';" },
    ],
    python: [
      { name: 'numpy', description: '数值计算', snippet: 'import numpy as np' },
      { name: 'pandas', description: '数据分析', snippet: 'import pandas as pd' },
      { name: 'matplotlib', description: '绘图', snippet: 'import matplotlib.pyplot as plt' },
      { name: 'requests', description: 'HTTP 请求', snippet: 'import requests' },
      { name: 'json', description: 'JSON 处理（内置）', snippet: 'import json' },
      { name: 'random', description: '随机数（内置）', snippet: 'import random' },
      { name: 'datetime', description: '日期时间（内置）', snippet: 'from datetime import datetime' },
    ],
  };

  const currentLibs = libraries[codeLang] || [];

  const handleInsertLibrary = (snippet: string) => {
    if (!activeFile) return;
    const current = activeFile.content || '';
    setProject(prev => updateFileContent(prev, activeFile.id, current + '\n' + snippet + '\n'));
    toast.success('已插入依赖');
  };

  const handleAddFile = (dirId?: string) => setNewFileDialog({ open: true, type: 'file', targetDirId: dirId });
  const handleAddFolder = (dirId?: string) => setNewFileDialog({ open: true, type: 'directory', targetDirId: dirId });
  
  const handleConfirmNewFile = () => {
    if (!newFileName.trim()) return;
    const targetId = newFileDialog.targetDirId || project.root.id;
    setProject(prev => {
      if (newFileDialog.type === 'file') {
        return createFile(prev, targetId, newFileName.trim());
      }
      return createDirectory(prev, targetId, newFileName.trim());
    });
    // 自动展开目标目录
    if (newFileDialog.targetDirId) {
      setExpandedDirs(prev => new Set(prev).add(newFileDialog.targetDirId!));
    }
    setNewFileName('');
    setNewFileDialog({ open: false, type: 'file' });
  };

  const handleDeleteNode = (nodeId: string) => {
    setProject(prev => deleteNode(prev, nodeId));
    setContextMenu(null);
  };

  const handleSelectFile = (nodeId: string) => {
    setProject(prev => ({ ...prev, activeFileId: nodeId }));
  };

  const toggleDir = (dirId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedDirs(prev => {
      const next = new Set(prev);
      if (next.has(dirId)) next.delete(dirId);
      else next.add(dirId);
      return next;
    });
  };

  const handleContextMenu = (nodeId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ nodeId, x: e.clientX, y: e.clientY });
  };

  const handleRenameStart = (node: VFSNode) => {
    setRenamingNode(node.id);
    setRenameValue(node.name);
    setContextMenu(null);
  };

  const handleRenameConfirm = () => {
    if (!renamingNode || !renameValue.trim()) {
      setRenamingNode(null);
      return;
    }
    setProject(prev => renameNode(prev, renamingNode, renameValue.trim()));
    setRenamingNode(null);
    setRenameValue('');
  };

  const handleSaveToWorks = async () => {
    if (!course || !project) return;
    try {
      const files = flattenFiles(project.root);
      const mainFile = files.find(f => f.language === codeLang) || files[0];
      const work: any = {
        id: generateId(),
        title: `${course.title} - ${project.name}`,
        description: `包含 ${files.length} 个文件的 ${codeLang} 项目`,
        content: mainFile?.content || '',
        language: codeLang,
        category: course.title,
        tags: [codeLang, 'project'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await put(STORES.WORKS, work);
      toast.success('已保存到作品集');
    } catch {
      toast.error('保存失败');
    }
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const iconMap: Record<string, { color: string }> = {
      js: { color: '#f7df1e' },
      ts: { color: '#3178c6' },
      jsx: { color: '#61dafb' },
      tsx: { color: '#61dafb' },
      html: { color: '#e34c26' },
      css: { color: '#264de4' },
      py: { color: '#3776ab' },
      json: { color: '#f5f5f5' },
      md: { color: '#ffffff' },
      cpp: { color: '#00599c' },
      c: { color: '#555555' },
      java: { color: '#b07219' },
    };
    return iconMap[ext || ''] || { color: '#94a3b8' };
  };

  const renderFileTree = (node: VFSNode, depth = 0) => {
    const isExpanded = expandedDirs.has(node.id);
    
    if (node.type === 'file') {
      const isActive = node.id === project.activeFileId;
      const icon = getFileIcon(node.name);
      return (
        <div
          key={node.id}
          className={`flex items-center gap-1.5 px-2 py-1 cursor-pointer text-xs group ${isActive ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-800/60'}`}
          style={{ paddingLeft: `${8 + depth * 12}px` }}
          onClick={() => handleSelectFile(node.id)}
          onContextMenu={(e) => handleContextMenu(node.id, e)}
        >
          <span className="w-3.5 h-3.5 shrink-0 rounded-sm flex items-center justify-center text-[8px] font-bold" style={{ backgroundColor: icon.color + '30', color: icon.color }}>
            {node.name.split('.').pop()?.[0]?.toUpperCase() || '?'}
          </span>
          {renamingNode === node.id ? (
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameConfirm(); if (e.key === 'Escape') setRenamingNode(null); }}
              onBlur={handleRenameConfirm}
              className="h-5 text-xs bg-slate-800 border-slate-600 py-0 px-1 flex-1"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="truncate flex-1">{node.name}</span>
          )}
        </div>
      );
    }
    
    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:bg-slate-800/40 cursor-pointer select-none"
          style={{ paddingLeft: `${4 + depth * 12}px` }}
          onClick={(e) => toggleDir(node.id, e)}
          onContextMenu={(e) => handleContextMenu(node.id, e)}
        >
          <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center text-[10px] text-slate-500">
            {isExpanded ? '▼' : '▶'}
          </span>
          {isExpanded ? (
            <FolderOpen className="w-3.5 h-3.5 shrink-0 text-indigo-400/60" />
          ) : (
            <Folder className="w-3.5 h-3.5 shrink-0 text-slate-500" />
          )}
          {renamingNode === node.id ? (
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameConfirm(); if (e.key === 'Escape') setRenamingNode(null); }}
              onBlur={handleRenameConfirm}
              className="h-5 text-xs bg-slate-800 border-slate-600 py-0 px-1 flex-1"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="truncate font-medium">{node.name}</span>
          )}
        </div>
        {isExpanded && node.children?.map(child => renderFileTree(child, depth + 1))}
      </div>
    );
  };

  // ========== 交互区 ==========
  const handleSubmitInteraction = async () => {
    if (!gameComponent || interactionSubmitted) return;
    setInteractionSubmitted(true);

    let isCorrect = false;
    if (gameComponent.type === 'fill-blank') {
      const correct = gameComponent.solution || [];
      const userArr = Array.isArray(interactionAnswer) ? interactionAnswer : [interactionAnswer];
      isCorrect =
        userArr.length === correct.length &&
        userArr.every((a: any, i: number) => a?.toString().trim().toLowerCase() === correct[i]?.toString().trim().toLowerCase());
    } else if (gameComponent.type === 'multi-choice') {
      isCorrect = interactionAnswer === gameComponent.solution;
    } else if (gameComponent.type === 'code-exec') {
      isCorrect = !!interactionAnswer;
    }

    if (isCorrect) {
      toast.success('回答正确！');
      await handleSendMessage('我答对了，请继续下一步。');
    } else {
      toast.error('回答不正确');
      if (gameComponent.hints?.length) {
        toast.info(`提示：${gameComponent.hints[0]}`);
      }
    }
  };

  // ========== 语音输入 ==========
  const handleVoiceInput = () => {
    if (isListening) return;
    setIsListening(true);
    const rec = startSpeechRecognition(
      (text) => {
        setInputMessage(text);
        setIsListening(false);
      },
      () => {
        toast.error('语音识别失败');
        setIsListening(false);
      }
    );
    setTimeout(() => {
      rec.stop();
      setIsListening(false);
    }, 5000);
  };

  // ========== 完成章节 ==========
  const handleCompleteChapter = async () => {
    if (!chapter || !course) return;
    try {
      chapter.status = 'completed';
      await put(STORES.CHAPTERS, chapter);
      course.completedChapters++;
      if (course.completedChapters >= course.totalChapters) course.status = 'completed';
      await put(STORES.COURSES, course);

      let next = chapters.find((c) => c.order === chapter.order + 1);

      // 如果没有下一章但课程还没完成，自动创建新章节
      if (!next && course.completedChapters < course.totalChapters) {
        const nextOrder = chapter.order + 1;
        next = {
          id: generateId(),
          courseId: course.id,
          order: nextOrder,
          title: `第 ${nextOrder + 1} 节`,
          status: 'available',
          content: '',
          currentStageIndex: 0,
          estimatedMinutes: 20,
          xpReward: 50,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        await put(STORES.CHAPTERS, next);
        setChapters((prev) => [...prev, next!].sort((a, b) => a.order - b.order));
      }

      if (next) {
        if (next.status === 'locked') {
          next.status = 'available';
          await put(STORES.CHAPTERS, next);
        }
        toast.success('章节完成！');
        onNavigate('learning', { courseId, chapterId: next.id });
      } else {
        toast.success('课程全部完成！');
        onNavigate('course-detail', { courseId });
      }
    } catch {
      toast.error('完成失败');
    }
  };

  // ========== 渲染 ==========
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!course || !chapter) {
    return (
      <div className="text-center py-16">
        <BookOpen className="w-14 h-14 text-slate-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold">课程加载失败</h3>
        <Button onClick={() => onNavigate('courses')} className="mt-4">
          返回课程列表
        </Button>
      </div>
    );
  }

  const progress = chapters.length > 0 ? ((chapter.order + 1) / chapters.length) * 100 : 0;

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col gap-3 animate-fade-in">
      {/* === 顶部导航 === */}
      <div className="flex items-center justify-between px-1 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => onNavigate('course-detail', { courseId })}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-sm font-semibold">{chapter.title}</h1>
            <p className="text-xs text-slate-400">{course.title}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={chapter.order === 0} onClick={() => { const p = chapters.find((c) => c.order === chapter.order - 1); if (p) onNavigate('learning', { courseId, chapterId: p.id }); }}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs text-slate-400">{chapter.order + 1} / {chapters.length}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={chapter.order >= chapters.length - 1} onClick={() => { const n = chapters.find((c) => c.order === chapter.order + 1); if (n) onNavigate('learning', { courseId, chapterId: n.id }); }}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <Badge variant="outline" className="text-[10px] h-5">{currentStage}</Badge>
          <div className="w-24"><Progress value={progress} className="h-1.5" /></div>
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 text-xs ${autoNoteEnabled ? 'text-amber-400' : 'text-slate-400'}`}
            onClick={() => setAutoNoteEnabled(!autoNoteEnabled)}
            title={autoNoteEnabled ? '关闭自动笔记' : '开启自动笔记'}
          >
            {autoNoteEnabled ? '📝 自动笔记开' : '📝 自动笔记关'}
          </Button>
          <Button size="sm" onClick={handleCompleteChapter} className="h-7 bg-green-500 hover:bg-green-600 text-xs">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />完成
          </Button>
        </div>
      </div>

      {/* === 四区主体 === */}
      <div className="flex-1 flex gap-3 min-h-0">
        {/* 左侧 */}
        <div className={`flex flex-col gap-3 transition-all duration-300 ${leftCollapsed ? 'w-10' : rightCollapsed ? 'flex-1' : 'flex-[1.1]'}`}>
          {leftCollapsed ? (
            <button onClick={() => setLeftCollapsed(false)} className="h-full flex items-center justify-center rounded-lg bg-slate-800/40 hover:bg-slate-800/60 transition-colors" title="展开左侧">
              <PanelLeft className="w-4 h-4 text-slate-400" />
            </button>
          ) : (
            <>
              {/* 左上：教学文本 */}
              <div className="flex-1 flex flex-col min-h-0 rounded-xl border border-slate-700/40 bg-slate-900/20 overflow-hidden relative">
                <button onClick={() => setLeftCollapsed(true)} className="absolute top-2 right-2 z-10 p-1 rounded hover:bg-slate-700/50 text-slate-500 hover:text-slate-300" title="收起">
                  <PanelLeftClose className="w-3.5 h-3.5" />
                </button>
                <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700/50 bg-slate-900/30 shrink-0">
                  <BookOpen className="w-4 h-4 text-indigo-400" />
                  <span className="text-sm font-medium">教学内容</span>
                  <Badge variant="outline" className="text-[10px] h-5 ml-auto">{currentStage}</Badge>
                </div>
                <ScrollArea className="flex-1 h-full p-4">
                  {teachingContent ? (
                    <div className="prose prose-invert max-w-none prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-pre:bg-slate-900/60 prose-pre:border prose-pre:border-slate-700/50 prose-pre:rounded-lg prose-code:text-amber-300 prose-code:before:content-none prose-code:after:content-none"
                      dangerouslySetInnerHTML={renderMarkdown(teachingContent)}
                    />
                  ) : (
                    <div className="text-center py-12 text-slate-500">
                      <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">等待AI导师开始教学...</p>
                    </div>
                  )}
                </ScrollArea>
              </div>

              {/* 左下：交互区 */}
              <div className="flex-[0.85] flex flex-col min-h-0 rounded-xl border border-slate-700/40 bg-slate-900/20 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700/50 bg-slate-900/30 shrink-0">
                  <Puzzle className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-medium">交互挑战</span>
                </div>
                <ScrollArea className="flex-1 h-full p-4">
                  {!gameComponent ? (
                    <div className="text-center py-10 text-slate-500">
                      <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">暂无交互任务</p>
                      <p className="text-xs text-slate-600 mt-1">与AI导师对话后可能出现练习</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-start gap-2">
                        <Badge variant="outline" className="shrink-0 mt-0.5 capitalize">{gameComponent.type === 'fill-blank' ? '填空' : gameComponent.type === 'multi-choice' ? '选择' : '编码'}</Badge>
                        <p className="text-sm text-slate-300">{gameComponent.instructions}</p>
                      </div>

                      {gameComponent.type === 'fill-blank' && (
                        <Card className="bg-slate-900/40 border-slate-700/40">
                          <CardContent className="p-4">
                            <div className="font-mono text-sm text-slate-300 whitespace-pre-wrap leading-6">
                              {(gameComponent.data?.code || '').split('___').map((part: string, i: number, arr: string[]) => (
                                <span key={i}>
                                  {part}
                                  {i < arr.length - 1 && (
                                    <input
                                      type="text"
                                      value={(interactionAnswer?.[i]) || ''}
                                      onChange={(e) => {
                                        const ans = [...(Array.isArray(interactionAnswer) ? interactionAnswer : [])];
                                        ans[i] = e.target.value;
                                        setInteractionAnswer(ans);
                                      }}
                                      disabled={interactionSubmitted}
                                      className={`inline-block min-w-[60px] max-w-[160px] bg-slate-800 border rounded px-2 py-0.5 text-center text-amber-300 text-sm mx-1 focus:outline-none focus:border-indigo-500 ${interactionSubmitted ? (interactionAnswer?.[i]?.trim().toLowerCase() === (gameComponent.solution?.[i] || '').toString().toLowerCase() ? 'border-green-500/50' : 'border-red-500/50') : 'border-slate-600'}`}
                                      placeholder={`${i + 1}`}
                                    />
                                  )}
                                </span>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {gameComponent.type === 'multi-choice' && (
                        <div className="space-y-2">
                          {(gameComponent.data?.options || []).map((opt: string, i: number) => {
                            const sel = interactionAnswer === opt;
                            const isCorrect = interactionSubmitted && opt === gameComponent.solution;
                            const isWrong = interactionSubmitted && sel && opt !== gameComponent.solution;
                            return (
                              <button key={i} onClick={() => !interactionSubmitted && setInteractionAnswer(opt)}
                                className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left text-sm transition-all ${isCorrect ? 'bg-green-500/10 border-green-500/30 text-green-300' : isWrong ? 'bg-red-500/10 border-red-500/30 text-red-300' : sel ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300' : 'bg-slate-800/40 border-slate-700/30 text-slate-300 hover:bg-slate-800/60'}`}>
                                <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] shrink-0 ${sel || isCorrect ? (isCorrect ? 'border-green-400 text-green-400' : 'border-indigo-400 text-indigo-400') : 'border-slate-600'}`}>{String.fromCharCode(65 + i)}</span>
                                <span>{opt}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {gameComponent.type === 'code-exec' && (
                        <Textarea value={interactionAnswer || ''} onChange={(e) => setInteractionAnswer(e.target.value)} placeholder="在此输入代码..." className="font-mono text-sm min-h-[100px] bg-slate-900/40 border-slate-700/40" />
                      )}

                      {gameComponent.hints && gameComponent.hints.length > 0 && (
                        <div>
                          {!showHint ? (
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-amber-400" onClick={() => setShowHint(true)}>
                              <Lightbulb className="w-3.5 h-3.5 mr-1" />显示提示
                            </Button>
                          ) : (
                            <Card className="bg-amber-500/5 border-amber-500/20">
                              <CardContent className="p-3 text-sm text-amber-300">
                                {gameComponent.hints.map((h, i) => <p key={i}>• {h}</p>)}
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={handleSubmitInteraction} disabled={interactionSubmitted} className="bg-indigo-500 hover:bg-indigo-600">
                          <Send className="w-3.5 h-3.5 mr-1" />提交
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => { setInteractionAnswer(null); setInteractionSubmitted(false); setShowHint(false); }}>
                          <RotateCcw className="w-3.5 h-3.5 mr-1" />重置
                        </Button>
                      </div>
                    </div>
                  )}
                </ScrollArea>
              </div>
            </>
          )}
        </div>

        {/* 右侧 */}
        <div className={`flex flex-col gap-3 transition-all duration-300 ${rightCollapsed ? 'w-10' : leftCollapsed ? 'flex-1' : 'flex-1'}`}>
          {rightCollapsed ? (
            <button onClick={() => setRightCollapsed(false)} className="h-full flex items-center justify-center rounded-lg bg-slate-800/40 hover:bg-slate-800/60 transition-colors" title="展开右侧">
              <PanelRight className="w-4 h-4 text-slate-400" />
            </button>
          ) : (
            <>
              {/* 右上：代码区 */}
              <div className="flex-1 flex flex-col min-h-0 rounded-xl border border-slate-700/40 bg-slate-900/20 overflow-hidden relative">
                <button onClick={() => setRightCollapsed(true)} className="absolute top-2 right-2 z-10 p-1 rounded hover:bg-slate-700/50 text-slate-500 hover:text-slate-300" title="收起">
                  <PanelRightClose className="w-3.5 h-3.5" />
                </button>
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50 bg-slate-900/30 shrink-0">
                  <div className="flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-slate-400" />
                    <Badge variant="outline" className="text-[10px] h-5 capitalize">{codeLang}</Badge>
                    <span className="text-xs text-slate-500">{activeFile?.content?.length || 0} 字符</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className={`h-7 px-2 text-xs ${libPanelOpen ? 'text-indigo-400 bg-indigo-500/10' : ''}`} onClick={() => setLibPanelOpen(!libPanelOpen)}><Library className="w-3.5 h-3.5 mr-1" />依赖</Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleOptimizeCode} disabled={isOptimizing}><Wand2 className="w-3.5 h-3.5 mr-1" />{isOptimizing ? '优化中' : 'AI优化'}</Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleAddFile()}><Plus className="w-3.5 h-3.5 mr-1" />文件</Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleAddFolder()}><Folder className="w-3.5 h-3.5 mr-1" />文件夹</Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleLoadSample}><FileCode className="w-3.5 h-3.5 mr-1" />示例</Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleCopyCode}>{copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}</Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => { if (activeFile) setProject(prev => updateFileContent(prev, activeFile.id, '')); }}><Trash2 className="w-3.5 h-3.5 mr-1" /></Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleSaveToWorks}><Save className="w-3.5 h-3.5 mr-1" />保存</Button>
                    <Button size="sm" className="h-7 px-3 text-xs bg-indigo-500 hover:bg-indigo-600" onClick={handleRunCode} disabled={isRunning}>
                      <Play className="w-3.5 h-3.5 mr-1" />{isRunning ? '运行中' : '运行'}
                    </Button>
                  </div>
                </div>
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  {/* 文件树 + 编辑器 */}
                  <div className="flex-1 flex min-h-0 overflow-hidden">
                    {/* 文件树 */}
                    <div className="w-40 border-r border-slate-700/50 bg-slate-900/30 flex flex-col shrink-0">
                      <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-700/30">
                        <span className="text-xs text-slate-400">文件</span>
                        <div className="flex gap-0.5">
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleAddFile()}><Plus className="w-3 h-3"/></Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleAddFolder()}><Folder className="w-3 h-3"/></Button>
                        </div>
                      </div>
                      {newFileDialog.open && (
                        <div className="px-2 py-1.5 border-b border-slate-700/30">
                          <Input
                            value={newFileName}
                            onChange={(e) => setNewFileName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmNewFile(); if (e.key === 'Escape') setNewFileDialog({ open: false, type: 'file' }); }}
                            placeholder={newFileDialog.type === 'file' ? '文件名' : '文件夹名'}
                            className="h-6 text-xs bg-slate-800/60 border-slate-700/50"
                            autoFocus
                          />
                        </div>
                      )}
                      <ScrollArea className="flex-1">
                        {renderFileTree(project.root)}
                      </ScrollArea>
                      {/* 依赖库面板 */}
                      {libPanelOpen && currentLibs.length > 0 && (
                        <div className="border-t border-slate-700/30 p-2 shrink-0">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] text-slate-500">常用依赖</span>
                            <button onClick={() => setLibPanelOpen(false)} className="text-slate-600 hover:text-slate-400"><X className="w-3 h-3"/></button>
                          </div>
                          <div className="space-y-0.5 max-h-40 overflow-y-auto">
                            {currentLibs.map(lib => (
                              <button
                                key={lib.name}
                                onClick={() => handleInsertLibrary(lib.snippet)}
                                onMouseEnter={() => setHoverLib(lib.name)}
                                onMouseLeave={() => setHoverLib(null)}
                                className="w-full text-left px-2 py-1 rounded text-[10px] text-slate-400 hover:bg-indigo-500/10 hover:text-indigo-300 transition-colors flex items-center gap-1.5"
                              >
                                <Library className="w-3 h-3 opacity-50" />
                                <span className="flex-1 truncate">{lib.name}</span>
                              </button>
                            ))}
                          </div>
                          {hoverLib && (
                            <div className="mt-1 text-[10px] text-slate-500 truncate">
                              {currentLibs.find(l => l.name === hoverLib)?.description}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {/* 编辑器 */}
                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                      {activeFile && (
                        <div className="px-3 py-1.5 text-xs text-slate-400 border-b border-slate-700/30 flex items-center justify-between shrink-0">
                          <span className="font-mono">{activeFile.name}</span>
                          <span className="text-[10px] text-slate-600 uppercase">{activeFile.language}</span>
                        </div>
                      )}
                      <div className="flex-1 overflow-hidden">
                        <textarea
                          value={activeFile?.content || ''}
                          onChange={(e) => {
                            if (activeFile) {
                              setProject(prev => updateFileContent(prev, activeFile.id, e.target.value));
                            }
                          }}
                          spellCheck={false}
                          autoComplete="off"
                          autoCorrect="off"
                          className="w-full h-full min-h-[120px] bg-transparent font-mono text-sm leading-6 p-4 resize-none outline-none text-slate-200 placeholder:text-slate-600 overflow-y-auto"
                          style={{ tabSize: 2, backgroundImage: 'linear-gradient(transparent 95%, rgba(51,65,85,0.3) 95%)', backgroundSize: '100% 24px', lineHeight: '24px' }}
                          placeholder={activeFile ? `在此输入 ${activeFile.language || codeLang} 代码...` : '请选择一个文件'}
                        />
                      </div>
                    </div>
                  </div>
                  {codeOutput && (
                    <div className="border-t border-slate-700/50 max-h-[45%] flex flex-col min-h-0">
                      <div className="px-3 py-2 text-xs font-medium text-slate-400 flex items-center gap-2 shrink-0">
                        <Terminal className="w-3.5 h-3.5" />
                        {codeLang === 'html' ? '页面预览' : '运行结果'}
                      </div>
                      {codeLang === 'html' ? (
                        <iframe
                          srcDoc={codeOutput}
                          className="w-full flex-1 border-0 bg-white"
                          sandbox="allow-scripts"
                          title="HTML Preview"
                        />
                      ) : (
                        <pre className="px-4 pb-3 font-mono text-sm whitespace-pre-wrap text-slate-300 overflow-y-auto">{codeOutput}</pre>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 右下：对话区 */}
              <div className="flex-1 flex flex-col min-h-0 rounded-xl border border-slate-700/40 bg-slate-900/20 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50 bg-slate-900/30 shrink-0">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-indigo-400" />
                    <span className="text-sm font-medium">AI 导师</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400">在线</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className={`h-7 w-7 ${ttsEnabled ? 'text-indigo-400' : 'text-slate-500'}`} onClick={() => setTtsEnabled(!ttsEnabled)} title={ttsEnabled ? '关闭朗读' : '开启朗读'}>
                      {ttsEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className={`h-7 w-7 ${isListening ? 'text-red-400 animate-pulse' : 'text-slate-500'}`} onClick={handleVoiceInput} title="语音输入">
                      <Mic className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <ScrollArea className="flex-1 h-full p-3">
                  <div className="space-y-3">
                    {messages.length === 0 && (
                      <div className="text-center py-8 text-slate-500">
                        <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">向 AI 导师提问吧</p>
                        <div className="flex flex-wrap gap-2 justify-center mt-3">
                          {['开始学习', '解释这段代码', '给我一道练习题', '总结知识点'].map((q) => (
                            <button key={q} onClick={() => handleSendMessage(q)} className="text-xs px-2.5 py-1 rounded-full bg-slate-800/60 text-slate-400 hover:bg-indigo-500/10 hover:text-indigo-300 transition-colors">{q}</button>
                          ))}
                        </div>
                      </div>
                    )}

                    {messages.map((msg, idx) => {
                      const isUser = msg.role === 'user';
                      const parsed = !isUser ? parseAIResponse(msg.content) : null;
                      const displayContent = parsed ? parsed.content : msg.content;
                      return (
                        <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[90%] rounded-xl px-3 py-2.5 text-sm ${isUser ? 'bg-indigo-500 text-white' : 'bg-slate-800/60 border border-slate-700/40'}`}>
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-[10px] opacity-60">{isUser ? '你' : 'AI导师'}</span>
                              <span className="text-[10px] opacity-40 ml-auto">{msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                            </div>
                            <div className="prose prose-invert max-w-none prose-p:my-1 prose-pre:bg-slate-900/60 prose-pre:border prose-pre:border-slate-700/40 prose-pre:rounded-md prose-code:text-amber-300 prose-code:before:content-none prose-code:after:content-none"
                              dangerouslySetInnerHTML={renderMarkdown(displayContent)} />
                            {!isUser && (
                              <div className="flex items-center gap-1 mt-1">
                                <Button variant="ghost" size="icon" className="h-5 w-5 text-slate-500 hover:text-indigo-400" onClick={() => speak(displayContent)}>
                                  <Volume2 className="w-3 h-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {isAiTyping && (
                      <div className="flex justify-start">
                        <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl px-4 py-3">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" />
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-100" />
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-200" />
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                </ScrollArea>

                {/* 输入区 */}
                <div className="px-3 py-2 border-t border-slate-700/50 bg-slate-900/30 shrink-0">
                  <div className="flex items-end gap-2">
                    <Textarea ref={textareaRef} value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} placeholder="输入问题或回复..." className="flex-1 min-h-[44px] max-h-[120px] resize-none bg-slate-800/60 border-slate-700/50 text-sm py-2.5 px-3 rounded-lg focus-visible:ring-indigo-500/30" />
                    <Button size="icon" className="h-10 w-10 shrink-0 bg-indigo-500 hover:bg-indigo-600 rounded-lg" onClick={() => handleSendMessage()} disabled={isAiTyping || !inputMessage.trim()}>
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 glass-panel border border-slate-700/50 rounded-lg py-1 shadow-xl min-w-[140px]"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            {(() => {
              const node = findNode(project.root, contextMenu.nodeId);
              if (!node) return null;
              return (
                <>
                  {node.type === 'directory' && (
                    <>
                      <button
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 hover:bg-indigo-500/10 hover:text-indigo-300 transition-colors"
                        onClick={() => { handleAddFile(node.id); setContextMenu(null); }}
                      >
                        <Plus className="w-3.5 h-3.5" />新建文件
                      </button>
                      <button
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 hover:bg-indigo-500/10 hover:text-indigo-300 transition-colors"
                        onClick={() => { handleAddFolder(node.id); setContextMenu(null); }}
                      >
                        <Folder className="w-3.5 h-3.5" />新建文件夹
                      </button>
                      <div className="border-t border-slate-700/30 my-1" />
                    </>
                  )}
                  <button
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 hover:bg-indigo-500/10 hover:text-indigo-300 transition-colors"
                    onClick={() => { handleRenameStart(node); setContextMenu(null); }}
                  >
                    <FileText className="w-3.5 h-3.5" />重命名
                  </button>
                  <button
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                    onClick={() => { handleDeleteNode(node.id); setContextMenu(null); }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />删除
                  </button>
                </>
              );
            })()}
          </div>
        </>
      )}

      {/* AI 优化结果对话框 */}
      <Dialog open={!!optimization} onOpenChange={(open) => !open && handleRejectOptimization()}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto glass-panel">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Wand2 className="w-4 h-4 text-indigo-400" />
              AI 代码优化结果
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* 反馈信息 */}
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/30 text-sm">
              <p className="text-slate-300">{optimization?.feedback}</p>
              <div className="flex gap-4 mt-2 text-xs text-slate-500">
                <span>时间复杂度: <span className="text-amber-400 font-mono">{optimization?.timeComplexity}</span></span>
                <span>空间复杂度: <span className="text-amber-400 font-mono">{optimization?.spaceComplexity}</span></span>
              </div>
            </div>
            
            {/* 高亮差异对比 */}
            <div>
              <div className="text-xs text-slate-400 mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500/60 inline-block" />
                <span className="text-red-400">删除</span>
                <span className="w-2 h-2 rounded-full bg-green-500/60 inline-block ml-2" />
                <span className="text-green-400">新增</span>
                <span className="ml-auto text-slate-600">行级对比</span>
              </div>
              <div className="font-mono text-xs bg-slate-900/60 border border-slate-700/30 rounded-lg p-3 overflow-x-auto whitespace-pre max-h-64 overflow-y-auto">
                {(() => {
                  if (!optimization) return null;
                  const origLines = optimization.original.split('\n');
                  const optLines = optimization.optimized.split('\n');
                  const maxLen = Math.max(origLines.length, optLines.length);
                  const result: any[] = [];
                  for (let i = 0; i < maxLen; i++) {
                    const o = origLines[i] || '';
                    const n = optLines[i] || '';
                    if (o === n) {
                      result.push(<div key={i} className="text-slate-500 pl-4">{o || ' '}</div>);
                    } else if (!n) {
                      result.push(<div key={i} className="bg-red-500/15 text-red-300 pl-1 border-l-2 border-red-500">− {o}</div>);
                    } else if (!o) {
                      result.push(<div key={i} className="bg-green-500/15 text-green-300 pl-1 border-l-2 border-green-500">+ {n}</div>);
                    } else {
                      result.push(<div key={i} className="bg-red-500/15 text-red-300 pl-1 border-l-2 border-red-500">− {o}</div>);
                      result.push(<div key={`${i}-new`} className="bg-green-500/15 text-green-300 pl-1 border-l-2 border-green-500">+ {n}</div>);
                    }
                  }
                  return result;
                })()}
              </div>
            </div>
            
            {/* 优化解释 */}
            <div className="text-sm text-slate-400 bg-slate-800/30 p-3 rounded-lg border border-slate-700/20">
              <span className="text-slate-300 font-medium">优化说明：</span>
              {optimization?.explanation}
            </div>
            
            {/* 操作按钮 */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-700/20">
              <Button variant="outline" size="sm" onClick={handleRejectOptimization}>
                取消
              </Button>
              <Button size="sm" onClick={handleAcceptOptimization} className="bg-indigo-500 hover:bg-indigo-600">
                <Check className="w-4 h-4 mr-1" />应用优化
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
