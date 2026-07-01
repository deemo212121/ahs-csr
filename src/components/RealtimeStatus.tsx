'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

type Status = 'connected' | 'connecting' | 'disconnected';

export function RealtimeStatus() {
  const [status, setStatus] = useState<Status>('connecting');

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setStatus('disconnected');
      return;
    }

    function check() {
      const state = supabase?.realtime?.connectionState?.();
      if (state === 'open') setStatus('connected');
      else if (state === 'closed' || state === 'error') setStatus('disconnected');
      else setStatus('connecting');
    }

    check();
    const interval = window.setInterval(check, 4000);
    return () => window.clearInterval(interval);
  }, []);

  const dot = status === 'connected' ? '🟢' : status === 'connecting' ? '🟡' : '🔴';
  const label = status === 'connected' ? 'Live' : status === 'connecting' ? 'Connecting' : 'Offline';

  return (
    <span className={`realtime-status realtime-status--${status}`} title={`Realtime: ${label}`}>
      <span className="realtime-status-dot">{dot}</span>
      <span className="realtime-status-label">{label}</span>
    </span>
  );
}
