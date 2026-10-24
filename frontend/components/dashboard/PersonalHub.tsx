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
  { id: 'activity', label: 'Hoạt động', icon: History },
  { id: 'storage', label: 'Lưu trữ', icon: FolderOpen },
  { id: 'certificates', label: 'Chứng chỉ', icon: Award },
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

  // Deep links from the sidebar / quick actions: /dashboard#luu-tru, #da-luu, ...
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
      className="scroll-mt-6 rounded-lg border border-border bg-card p-6 shadow-sm"
    >
      <div className="mb-4 flex items-center gap-2">
        <User className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Cá nhân</h2>
          <p className="text-sm text-muted-foreground/60">
            Hoạt động, tài liệu, chứng chỉ và thông báo của bạn.
          </p>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => selectTab(id)}
            className={`inline-flex items-center gap-2 whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors ${
              tab === id
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="pt-5">
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
