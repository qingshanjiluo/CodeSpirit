/**
 * 离线状态指示器
 */

import { WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OfflineIndicatorProps {
  isOffline: boolean;
}

export function OfflineIndicator({ isOffline }: OfflineIndicatorProps) {
  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-transform duration-300',
        isOffline ? 'translate-y-0' : '-translate-y-full'
      )}
    >
      <div className="bg-amber-500/90 backdrop-blur-sm text-slate-900 px-4 py-2 flex items-center justify-center gap-2">
        <WifiOff className="w-4 h-4" />
        <span className="text-sm font-medium">离线模式 - 部分功能可能受限</span>
      </div>
    </div>
  );
}
