'use client';

import { useEffect, useState, type ComponentType } from 'react';
import { Award, Bell, FolderOpen, History, User } from 'lucide-react';
import { PersonalActivity, type ActivityTab } from './PersonalActivity';
import { PersonalStorage } from './PersonalStorage';
import { PersonalCertificates } from './PersonalCertificates';
import { PersonalNotifications } from './PersonalNotifications';

type HubTab = 'activity' | 'storage' | 'certificates' | 'notifications';

const TABS: Array<{
  id: HubTab;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { id: 'activity', label: 'Hoạt động & Đã lưu', icon: History },
  { id: 'storage', label: 'Lưu trữ tài liệu', icon: FolderOpen },
  { id: 'certificates', label: 'Chứng chỉ đạt được', icon: Award },
  { id: 'notifications', label: 'Thông báo', icon: Bell },
];

const HASH_TO_TAB: Record<string, { tab: HubTab; activity?: ActivityTab }> = {
  '#hoat-dong': { tab: 'activity', activity: 'history' },
  '#da-luu': { tab: 'activity', activity: 'saved' },
  '#lich-su': { tab: 'activity', activity: 'history' },
  '#luu-tru': { tab: 'storage' },
  '#chung-chi': { tab: 'certificates' },
  '#thong-bao': { tab: 'notifications' },
};

const TAB_TO_HASH: Record<HubTab, string> = {
  activity: '#hoat-dong',
  storage: '#luu-tru',
  certificates: '#chung-chi',
  notifications: '#thong-bao',
};

export function PersonalHub() {
  const [tab, setTab] = useState<HubTab>('activity');
  const [activityTab, setActivityTab] = useState<ActivityTab>('history');

  // Deep links from sidebar / quick actions
  useEffect(() => {
    const applyHash = () => {
      const target = HASH_TO_TAB[window.location.hash];
      if (!target) return;
      setTab(target.tab);
      if (target.activity) setActivityTab(target.activity);
      requestAnimationFrame(() => {
        document.getElementById('ca-nhan')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
    };

    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, []);

  const selectTab = (next: HubTab) => {
    setTab(next);
    if (typeof window !== 'undefined') {
      const hash =
        next === 'activity'
          ? activityTab === 'saved'
            ? '#da-luu'
            : '#lich-su'
          : TAB_TO_HASH[next];
      window.history.replaceState(null, '', hash);
      window.dispatchEvent(new Event('hashchange'));
    }
  };

  const selectActivityTab = (next: ActivityTab) => {
    setActivityTab(next);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', next === 'saved' ? '#da-luu' : '#lich-su');
      window.dispatchEvent(new Event('hashchange'));
    }
  };

  return (
    <section
      id="ca-nhan"
      className="scroll-mt-6 rounded-[22px] border border-border/80 bg-card p-6 shadow-orvel"
    >
      <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <User className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground">Không gian cá nhân</h2>
            <p className="text-xs text-muted-foreground">
              Quản lý toàn bộ tiến trình học tập, tài liệu nghiên cứu và lịch sử hoạt động
            </p>
          </div>
        </div>

        {/* Orvel Style Segmented Pill Nav */}
        <div className="flex flex-wrap gap-1.5 rounded-xl border border-border/80 bg-secondary/50 p-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => selectTab(id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                tab === id
                  ? 'bg-card text-foreground shadow-xs border border-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${tab === id ? 'text-primary' : 'text-muted-foreground'}`} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-2">
        {tab === 'activity' && (
          <PersonalActivity activeTab={activityTab} onTabChange={selectActivityTab} />
        )}
        {tab === 'storage' && <PersonalStorage />}
        {tab === 'certificates' && <PersonalCertificates />}
        {tab === 'notifications' && <PersonalNotifications />}
      </div>
    </section>
  );
}
