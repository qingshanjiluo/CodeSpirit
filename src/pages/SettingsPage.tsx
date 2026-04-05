/**
 * CodeSpirit 设置页面
 */

import { useState, useEffect } from 'react';
import { 
  Settings, 
  User, 
  Key, 
  Database, 
  Palette, 
  Globe,
  Volume2,
  Moon,
  Sun,
  Monitor,
  Save,
  Trash2,
  Download,
  Upload,
  Plus,
  X,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import { get, put, resetAllData, STORES } from '@/db';
import { getAIConfig, updateAIConfig } from '@/ai';
import { exportAllData, importBackup } from '@/utils/exportImport';
import { storage, readFile } from '@/utils';
import type { AppSettings, UserProfile, AIConfiguration } from '@/types';
import type { PageType } from '@/App';
import { toast } from 'sonner';

interface SettingsPageProps {
  onNavigate: (page: PageType, params?: any) => void;
}

export function SettingsPage({ onNavigate }: SettingsPageProps) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [aiConfig, setAiConfig] = useState<AIConfiguration | null>(null);
  const [newApiKey, setNewApiKey] = useState('');
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [settingsData, profileData, aiConfigData] = await Promise.all([
        get<{ value: AppSettings }>(STORES.USER_DATA, 'settings'),
        get<{ value: UserProfile }>(STORES.USER_DATA, 'profile'),
        getAIConfig()
      ]);

      setSettings(settingsData?.value || {
        language: 'zh-CN',
        theme: 'dark',
        primaryColor: '#6366f1',
        fontSize: 16,
        fontFamily: 'system-ui',
        soundEnabled: true,
        ttsEnabled: false,
        autoGenerateCount: 3,
        focusMode: false
      });

      setProfile(profileData?.value || {
        nickname: '',
        avatar: '',
        aiRole: 'mentor',
        aiRoleName: 'AI导师'
      });

      setAiConfig(aiConfigData);
    } catch (error) {
      console.error('[SettingsPage] Load error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    try {
      await put(STORES.USER_DATA, {
        key: 'settings',
        category: 'settings',
        value: settings,
        updatedAt: Date.now()
      });
      toast.success('设置已保存');
    } catch (error) {
      console.error('[SettingsPage] Save error:', error);
      toast.error('保存失败');
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    try {
      await put(STORES.USER_DATA, {
        key: 'profile',
        category: 'profile',
        value: profile,
        updatedAt: Date.now()
      });
      toast.success('个人资料已保存');
    } catch (error) {
      console.error('[SettingsPage] Save profile error:', error);
      toast.error('保存失败');
    }
  };

  const handleAddApiKey = async () => {
    if (!newApiKey.trim() || !aiConfig) return;
    
    try {
      const updatedKeys = [...aiConfig.apiKeys, newApiKey.trim()];
      await updateAIConfig({ apiKeys: updatedKeys });
      setAiConfig({ ...aiConfig, apiKeys: updatedKeys });
      setNewApiKey('');
      toast.success('API密钥已添加');
    } catch (error) {
      console.error('[SettingsPage] Add API key error:', error);
      toast.error('添加失败');
    }
  };

  const handleRemoveApiKey = async (index: number) => {
    if (!aiConfig) return;
    
    try {
      const updatedKeys = aiConfig.apiKeys.filter((_, i) => i !== index);
      await updateAIConfig({ apiKeys: updatedKeys });
      setAiConfig({ ...aiConfig, apiKeys: updatedKeys });
      toast.success('API密钥已删除');
    } catch (error) {
      console.error('[SettingsPage] Remove API key error:', error);
      toast.error('删除失败');
    }
  };

  const handleExportData = async () => {
    try {
      await exportAllData();
      toast.success('数据已导出');
    } catch (error) {
      console.error('[SettingsPage] Export error:', error);
      toast.error('导出失败');
    }
  };

  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await importBackup(file, 'merge');
      toast.success('数据已导入');
      window.location.reload();
    } catch (error) {
      console.error('[SettingsPage] Import error:', error);
      toast.error('导入失败');
    }
  };

  const handleResetData = async () => {
    try {
      await resetAllData();
      toast.success('数据已重置');
      window.location.reload();
    } catch (error) {
      console.error('[SettingsPage] Reset error:', error);
      toast.error('重置失败');
    }
  };

  if (isLoading || !settings || !profile || !aiConfig) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-12 rounded-lg" />
        <div className="skeleton h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="w-6 h-6 text-indigo-400" />
          设置
        </h1>
        <p className="text-slate-400 mt-1">管理你的应用设置和偏好</p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="glass-card mb-6">
          <TabsTrigger value="general">
            <Palette className="w-4 h-4 mr-2" />
            通用
          </TabsTrigger>
          <TabsTrigger value="ai">
            <Key className="w-4 h-4 mr-2" />
            AI 配置
          </TabsTrigger>
          <TabsTrigger value="profile">
            <User className="w-4 h-4 mr-2" />
            个人资料
          </TabsTrigger>
          <TabsTrigger value="data">
            <Database className="w-4 h-4 mr-2" />
            数据管理
          </TabsTrigger>
        </TabsList>

        {/* 通用设置 */}
        <TabsContent value="general" className="space-y-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>界面设置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 语言 */}
              <div className="space-y-2">
                <Label>语言</Label>
                <div className="flex gap-2">
                  <Button
                    variant={settings.language === 'zh-CN' ? 'default' : 'outline'}
                    onClick={() => setSettings({ ...settings, language: 'zh-CN' })}
                  >
                    <Globe className="w-4 h-4 mr-2" />
                    中文
                  </Button>
                  <Button
                    variant={settings.language === 'en-US' ? 'default' : 'outline'}
                    onClick={() => setSettings({ ...settings, language: 'en-US' })}
                  >
                    <Globe className="w-4 h-4 mr-2" />
                    English
                  </Button>
                </div>
              </div>

              <Separator />

              {/* 主题 */}
              <div className="space-y-2">
                <Label>主题</Label>
                <div className="flex gap-2">
                  <Button
                    variant={settings.theme === 'light' ? 'default' : 'outline'}
                    onClick={() => setSettings({ ...settings, theme: 'light' })}
                  >
                    <Sun className="w-4 h-4 mr-2" />
                    浅色
                  </Button>
                  <Button
                    variant={settings.theme === 'dark' ? 'default' : 'outline'}
                    onClick={() => setSettings({ ...settings, theme: 'dark' })}
                  >
                    <Moon className="w-4 h-4 mr-2" />
                    深色
                  </Button>
                  <Button
                    variant={settings.theme === 'system' ? 'default' : 'outline'}
                    onClick={() => setSettings({ ...settings, theme: 'system' })}
                  >
                    <Monitor className="w-4 h-4 mr-2" />
                    跟随系统
                  </Button>
                </div>
              </div>

              <Separator />

              {/* 字体大小 */}
              <div className="space-y-2">
                <Label>字体大小: {settings.fontSize}px</Label>
                <Slider
                  value={[settings.fontSize]}
                  onValueChange={(v) => setSettings({ ...settings, fontSize: v[0] })}
                  min={12}
                  max={24}
                  step={1}
                />
              </div>

              <Separator />

              {/* 声音 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-5 h-5" />
                  <div>
                    <Label className="cursor-pointer">启用音效</Label>
                    <p className="text-sm text-slate-400">播放交互音效</p>
                  </div>
                </div>
                <Switch
                  checked={settings.soundEnabled}
                  onCheckedChange={(v) => setSettings({ ...settings, soundEnabled: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-5 h-5" />
                  <div>
                    <Label className="cursor-pointer">语音朗读</Label>
                    <p className="text-sm text-slate-400">AI回复自动朗读</p>
                  </div>
                </div>
                <Switch
                  checked={settings.ttsEnabled}
                  onCheckedChange={(v) => setSettings({ ...settings, ttsEnabled: v })}
                />
              </div>

              <Button onClick={handleSaveSettings} className="w-full">
                <Save className="w-4 h-4 mr-2" />
                保存设置
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI 配置 */}
        <TabsContent value="ai" className="space-y-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>AI 配置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* API 端点 */}
              <div className="space-y-2">
                <Label>API 端点</Label>
                <Input
                  value={aiConfig.endpoint}
                  onChange={(e) => setAiConfig({ ...aiConfig, endpoint: e.target.value })}
                  placeholder="https://api.deepseek.com/v1/chat/completions"
                />
                <p className="text-sm text-slate-400">支持 OpenAI 兼容的 API 端点</p>
              </div>

              {/* 模型选择 */}
              <div className="space-y-2">
                <Label>模型</Label>
                <Input
                  value={aiConfig.model}
                  onChange={(e) => setAiConfig({ ...aiConfig, model: e.target.value })}
                  placeholder="deepseek-chat"
                />
              </div>

              <Separator />

              {/* API 密钥 */}
              <div className="space-y-2">
                <Label>API 密钥</Label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={newApiKey}
                    onChange={(e) => setNewApiKey(e.target.value)}
                    placeholder="输入新的 API 密钥"
                  />
                  <Button onClick={handleAddApiKey}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                
                {/* 密钥列表 */}
                <div className="space-y-2 mt-4">
                  {aiConfig.apiKeys.map((key, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
                      <div className="flex items-center gap-2">
                        <Key className="w-4 h-4 text-slate-400" />
                        <span className="font-mono text-sm">{key.slice(0, 8)}...{key.slice(-4)}</span>
                        {index === 0 && <Badge className="bg-indigo-500/20 text-indigo-400">默认</Badge>}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveApiKey(index)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* 高级设置 */}
              <div className="space-y-2">
                <Label>Temperature: {aiConfig.temperature}</Label>
                <Slider
                  value={[aiConfig.temperature]}
                  onValueChange={(v) => setAiConfig({ ...aiConfig, temperature: v[0] })}
                  min={0}
                  max={2}
                  step={0.1}
                />
                <p className="text-sm text-slate-400">控制AI回复的创造性（越低越保守）</p>
              </div>

              <div className="space-y-2">
                <Label>最大 Token: {aiConfig.maxTokens}</Label>
                <Slider
                  value={[aiConfig.maxTokens]}
                  onValueChange={(v) => setAiConfig({ ...aiConfig, maxTokens: v[0] })}
                  min={512}
                  max={8192}
                  step={512}
                />
              </div>

              <Button 
                onClick={async () => {
                  await updateAIConfig(aiConfig);
                  toast.success('AI配置已保存');
                }} 
                className="w-full"
              >
                <Save className="w-4 h-4 mr-2" />
                保存配置
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 个人资料 */}
        <TabsContent value="profile" className="space-y-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>个人资料</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>昵称</Label>
                <Input
                  value={profile.nickname}
                  onChange={(e) => setProfile({ ...profile, nickname: e.target.value })}
                  placeholder="你的昵称"
                />
              </div>

              <div className="space-y-2">
                <Label>AI 称呼方式</Label>
                <Input
                  value={profile.aiRoleName}
                  onChange={(e) => setProfile({ ...profile, aiRoleName: e.target.value })}
                  placeholder="AI导师"
                />
                <p className="text-sm text-slate-400">AI将如何称呼你</p>
              </div>

              <div className="space-y-2">
                <Label>AI 角色</Label>
                <div className="flex gap-2">
                  {[
                    { value: 'mentor', label: '导师' },
                    { value: 'friend', label: '伙伴' },
                    { value: 'expert', label: '专家' }
                  ].map((role) => (
                    <Button
                      key={role.value}
                      variant={profile.aiRole === role.value ? 'default' : 'outline'}
                      onClick={() => setProfile({ ...profile, aiRole: role.value as any })}
                    >
                      {role.label}
                    </Button>
                  ))}
                </div>
              </div>

              <Button onClick={handleSaveProfile} className="w-full">
                <Save className="w-4 h-4 mr-2" />
                保存资料
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 数据管理 */}
        <TabsContent value="data" className="space-y-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>数据管理</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 导出数据 */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50">
                <div>
                  <h4 className="font-medium">导出数据</h4>
                  <p className="text-sm text-slate-400">将所有数据导出为 JSON 文件</p>
                </div>
                <Button onClick={handleExportData}>
                  <Download className="w-4 h-4 mr-2" />
                  导出
                </Button>
              </div>

              {/* 导入数据 */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50">
                <div>
                  <h4 className="font-medium">导入数据</h4>
                  <p className="text-sm text-slate-400">从备份文件恢复数据</p>
                </div>
                <Label className="cursor-pointer">
                  <Input
                    type="file"
                    accept=".json,.lingcheng"
                    className="hidden"
                    onChange={handleImportData}
                  />
                  <div className="flex items-center gap-2 px-4 py-2 rounded-md bg-indigo-500 hover:bg-indigo-600 text-white">
                    <Upload className="w-4 h-4" />
                    导入
                  </div>
                </Label>
              </div>

              <Separator />

              {/* 重置数据 */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <div>
                  <h4 className="font-medium text-red-400">重置所有数据</h4>
                  <p className="text-sm text-slate-400">此操作将删除所有数据，无法恢复</p>
                </div>
                <Button variant="destructive" onClick={() => setShowResetDialog(true)}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  重置
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 重置确认对话框 */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent className="glass-panel">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              确认重置所有数据？
            </AlertDialogTitle>
            <AlertDialogDescription>
              此操作将永久删除所有课程、笔记、进度等数据，无法恢复。建议先导出备份。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetData} className="bg-red-500 hover:bg-red-600">
              确认重置
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
