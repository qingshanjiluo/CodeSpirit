/**
 * CodeSpirit 侧边栏组件
 */

import { 
  Home, 
  BookOpen, 
  BarChart3, 
  NotebookPen, 
  FolderOpen, 
  Settings,
  Plus,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PageType } from '@/App';

interface SidebarProps {
  currentPage: PageType;
  isOpen: boolean;
  onNavigate: (page: PageType) => void;
  onToggle: () => void;
  user: {
    nickname: string;
    avatar: string;
    level: number;
    xp: number;
  } | null;
}

const navItems: Array<{ id: PageType; label: string; icon: typeof Home }> = [
  { id: 'home', label: '首页', icon: Home },
  { id: 'courses', label: '我的课程', icon: BookOpen },
  { id: 'dashboard', label: '学习看板', icon: BarChart3 },
  { id: 'notes', label: '笔记本', icon: NotebookPen },
  { id: 'works', label: '作品集', icon: FolderOpen },
  { id: 'settings', label: '设置', icon: Settings },
];

export function Sidebar({ currentPage, isOpen, onNavigate, onToggle, user }: SidebarProps) {
  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full z-40 transition-all duration-300',
        isOpen ? 'w-64' : 'w-16'
      )}
    >
      <div className="h-full glass-panel flex flex-col">
        {/* Logo */}
        <div className="p-4 flex items-center justify-between">
          <div className={cn(
            'flex items-center gap-3 transition-opacity',
            isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'
          )}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg gradient-text">灵程</h1>
              <p className="text-xs text-slate-400">CodeSpirit</p>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="shrink-0"
          >
            {isOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </Button>
        </div>

        {/* 创建课程按钮 */}
        <div className="px-4 mb-4">
          <Button
            onClick={() => onNavigate('create-course')}
            className={cn(
              'w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700',
              !isOpen && 'px-2'
            )}
          >
            <Plus className="w-4 h-4 shrink-0" />
            {isOpen && <span className="ml-2">创建课程</span>}
          </Button>
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 px-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id || 
              (item.id === 'courses' && currentPage === 'course-detail') ||
              (item.id === 'courses' && currentPage === 'learning');
            
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                  isActive 
                    ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' 
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200',
                  !isOpen && 'justify-center px-2'
                )}
              >
                <Icon className={cn('w-5 h-5 shrink-0', isActive && 'text-indigo-400')} />
                {isOpen && <span className="text-sm font-medium">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* 用户信息 */}
        {user && (
          <div className="p-4 border-t border-slate-700/50">
            <div className={cn(
              'flex items-center gap-3',
              !isOpen && 'justify-center'
            )}>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.nickname} className="w-full h-full rounded-full object-cover" />
                ) : (
                  <span className="text-sm font-bold text-white">
                    {user.nickname.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              {isOpen && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.nickname}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>LV.{user.level}</span>
                    <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                        style={{ width: `${(user.xp % 200) / 2}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
