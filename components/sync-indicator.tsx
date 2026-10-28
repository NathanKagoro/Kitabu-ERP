'use client';

import { Check, CloudOff, RefreshCw, TriangleAlert } from '@/components/icons';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { refreshPendingCount, startSync, subscribeToSync, sync, type SyncState } from '@/lib/sync/engine';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { cn } from '@/lib/cn';

/** The live sync state, for screens that need to say "sync first". */
export function useSyncState(): SyncState {
  const [state, setState] = useState<SyncState>({ status: 'idle', pending: 0, lastSyncedAt: null, error: null });
  useEffect(() => {
    const unsubscribe = subscribeToSync(setState);
    void refreshPendingCount();
    return unsubscribe;
  }, []);
  return state;
}

/**
 * The spec asks for a visible sync state, and it matters for trust: someone
 * selling with no signal needs to see that their morning is safe, not wonder.
 * It is never a blocker -- tapping it retries, and nothing waits on it.
 */
export function SyncIndicator({ className }: { className?: string }) {
  const t = useTranslations('sync');
  const [state, setState] = useState<SyncState>({
    status: 'idle',
    pending: 0,
    lastSyncedAt: null,
    error: null,
  });
  const [online, setOnline] = useState(true);

  useEffect(() => {
    startSync();
    const unsubscribe = subscribeToSync(setState);
    void refreshPendingCount();

    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      unsubscribe();
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const pending = state.pending;
  const offline = !online || state.status === 'offline';

  let icon = <Check size={16} />;
  let label = t('synced');
  let tone = 'text-ink-faint';

  if (!isSupabaseConfigured()) {
    // Phone-only mode: everything is saved, and the queue is kept so that
    // turning sync on later sends it all. Nothing is 'waiting' from the
    // trader's point of view, so do not say it is.
    label = t('savedOnPhone');
  } else if (offline) {
    icon = <CloudOff size={16} />;
    label = pending > 0 ? t('pending', { count: pending }) : t('offline');
    tone = 'text-debt';
  } else if (state.status === 'syncing') {
    icon = <RefreshCw size={16} className="animate-spin" />;
    label = t('syncing');
    tone = 'text-ink-soft';
  } else if (state.status === 'error') {
    icon = <TriangleAlert size={16} />;
    label = t('pending', { count: pending });
    tone = 'text-loss';
  } else if (pending > 0) {
    icon = <RefreshCw size={16} />;
    label = t('pending', { count: pending });
    tone = 'text-ink-soft';
  }

  return (
    <button
      onClick={() => void sync()}
      title={t('syncNow')}
      className={cn(
        'flex h-12 items-center gap-1.5 rounded-full px-3 text-xs font-semibold active:bg-line/40',
        tone,
        className
      )}
    >
      {icon}
      <span className="hidden xs:inline">{label}</span>
    </button>
  );
}
