/**
 * CodeSpirit 作品集页面
 */

import { useState, useEffect } from 'react';
import { 
  FolderOpen, 
  Plus, 
  ExternalLink, 
  Trash2, 
  Edit3,
  Image as ImageIcon,
  Code2,
  Link as LinkIcon,
  MoreVertical,
  Upload
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { getAll, put, remove, STORES } from '@/db';
import { readImageFile, compressImage, generateId } from '@/utils';
import type { Work } from '@/types';
import type { PageType } from '@/App';
import { toast } from 'sonner';

interface WorksPageProps {
  onNavigate: (page: PageType, params?: any) => void;
}

export function WorksPage({ onNavigate }: WorksPageProps) {
  const [works, setWorks] = useState<Work[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isEditing, setIsEditing] = useState(false);
  const [editingWork, setEditingWork] = useState<Work | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadWorks();
  }, []);

  const loadWorks = async () => {
    try {
      const worksData = await getAll<Work>(STORES.WORKS);
      const sorted = worksData.sort((a, b) => b.createdAt - a.createdAt);
      setWorks(sorted);

      // 提取分类
      const cats = [...new Set(sorted.map(w => w.category).filter(Boolean))];
      setCategories(cats);
    } catch (error) {
      console.error('[WorksPage] Load error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveWork = async () => {
    if (!editingWork) return;

    try {
      const work: Work = {
        ...editingWork,
        createdAt: editingWork.createdAt || Date.now()
      };

      await put(STORES.WORKS, work);
      await loadWorks();
      setIsEditing(false);
      setEditingWork(null);
      toast.success('作品已保存');
    } catch (error) {
      console.error('[WorksPage] Save error:', error);
      toast.error('保存失败');
    }
  };

  const handleDeleteWork = async (workId: string) => {
    try {
      await remove(STORES.WORKS, workId);
      await loadWorks();
      toast.success('作品已删除');
    } catch (error) {
      console.error('[WorksPage] Delete error:', error);
      toast.error('删除失败');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingWork) return;

    try {
      const dataUrl = await readImageFile(file);
      const compressed = await compressImage(dataUrl, 1200, 0.8);
      setEditingWork({ ...editingWork, type: 'image', content: compressed });
      toast.success('图片上传成功');
    } catch (error) {
      console.error('[WorksPage] Image upload error:', error);
      toast.error('上传失败');
    }
  };

  const handleNewWork = () => {
    setEditingWork({
      id: generateId(),
      title: '',
      description: '',
      type: 'link',
      content: '',
      category: '',
      createdAt: Date.now()
    });
    setIsEditing(true);
  };

  const filteredWorks = selectedCategory === 'all' 
    ? works 
    : works.filter(w => w.category === selectedCategory);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-12 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
            <FolderOpen className="w-6 h-6 text-indigo-400" />
            作品集
          </h1>
          <p className="text-slate-400 mt-1">展示你的学习成果</p>
        </div>

        <Button onClick={handleNewWork}>
          <Plus className="w-4 h-4 mr-2" />
          添加作品
        </Button>
      </div>

      {/* 分类筛选 */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList className="glass-card">
          <TabsTrigger value="all">全部</TabsTrigger>
          {categories.map(cat => (
            <TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* 作品列表 */}
      {filteredWorks.length === 0 ? (
        <div className="text-center py-16">
          <FolderOpen className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">还没有作品</h3>
          <p className="text-slate-400 mb-6">添加你的第一个学习成果吧</p>
          <Button onClick={handleNewWork}>
            <Plus className="w-4 h-4 mr-2" />
            添加作品
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWorks.map((work) => (
            <Card
              key={work.id}
              className="glass-card group overflow-hidden"
            >
              {/* 作品预览 */}
              <div className="h-48 bg-slate-800/50 relative overflow-hidden">
                {work.type === 'image' && work.content ? (
                  <img
                    src={work.content}
                    alt={work.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : work.type === 'code' ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <Code2 className="w-16 h-16 text-slate-600" />
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <LinkIcon className="w-16 h-16 text-slate-600" />
                  </div>
                )}

                {/* 操作菜单 */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="bg-slate-900/50">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="glass-panel">
                      <DropdownMenuItem onClick={() => { setEditingWork(work); setIsEditing(true); }}>
                        <Edit3 className="w-4 h-4 mr-2" />
                        编辑
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDeleteWork(work.id)} className="text-red-400">
                        <Trash2 className="w-4 h-4 mr-2" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <CardContent className="p-4">
                <h3 className="font-semibold mb-1">{work.title}</h3>
                <p className="text-slate-400 text-sm line-clamp-2 mb-3">{work.description}</p>
                
                <div className="flex items-center justify-between">
                  {work.category && (
                    <Badge variant="secondary">{work.category}</Badge>
                  )}
                  
                  {work.type === 'link' && work.content && (
                    <Button size="sm" variant="ghost" onClick={() => window.open(work.content, '_blank')}>
                      <ExternalLink className="w-4 h-4 mr-1" />
                      访问
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 编辑对话框 */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="glass-panel max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingWork?.id ? '编辑作品' : '添加作品'}</DialogTitle>
          </DialogHeader>
          
          {editingWork && (
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium mb-2 block">标题</label>
                <Input
                  value={editingWork.title}
                  onChange={(e) => setEditingWork({ ...editingWork, title: e.target.value })}
                  placeholder="作品标题"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">描述</label>
                <Textarea
                  value={editingWork.description}
                  onChange={(e) => setEditingWork({ ...editingWork, description: e.target.value })}
                  placeholder="作品描述"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">分类</label>
                <Input
                  value={editingWork.category}
                  onChange={(e) => setEditingWork({ ...editingWork, category: e.target.value })}
                  placeholder="分类（如：Web开发、数据分析等）"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">类型</label>
                <Tabs 
                  value={editingWork.type} 
                  onValueChange={(v) => setEditingWork({ ...editingWork, type: v as Work['type'], content: '' })}
                >
                  <TabsList className="glass-card">
                    <TabsTrigger value="link">
                      <LinkIcon className="w-4 h-4 mr-1" />
                      链接
                    </TabsTrigger>
                    <TabsTrigger value="image">
                      <ImageIcon className="w-4 h-4 mr-1" />
                      图片
                    </TabsTrigger>
                    <TabsTrigger value="code">
                      <Code2 className="w-4 h-4 mr-1" />
                      代码
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">内容</label>
                {editingWork.type === 'image' ? (
                  <div className="space-y-2">
                    {editingWork.content && (
                      <img 
                        src={editingWork.content} 
                        alt="Preview" 
                        className="max-h-48 rounded-lg"
                      />
                    )}
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                    />
                  </div>
                ) : (
                  <Textarea
                    value={editingWork.content}
                    onChange={(e) => setEditingWork({ ...editingWork, content: e.target.value })}
                    placeholder={editingWork.type === 'link' ? 'https://...' : '代码内容...'}
                    className={editingWork.type === 'code' ? 'font-mono' : ''}
                  />
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  取消
                </Button>
                <Button onClick={handleSaveWork}>
                  保存
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
