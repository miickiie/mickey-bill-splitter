import { useCallback, useEffect, useRef, useState } from 'react';

export interface MascotNotice {
  id: number;
  source: 'summary' | 'qr' | 'scan' | 'bill';
  messageKey: string;
  values?: Record<string, string | number>;
  tone: 'success' | 'error' | 'info';
}

export function useMascotNotifications({ suspendAll = false, suspendTransient = false } = {}) {
  const [notices, setNotices] = useState<MascotNotice[]>([]);
  const nextId = useRef(0);

  const notify = useCallback((
    messageKey: string,
    tone: MascotNotice['tone'],
    source: MascotNotice['source'],
    values?: MascotNotice['values'],
  ) => {
    const notice: MascotNotice = {
      id: ++nextId.current,
      source,
      messageKey,
      values,
      tone,
    };
    // Retain other operations' feedback until shown; a retry replaces its own result.
    setNotices(current => [
      ...current.filter(item => item.source !== source),
      notice,
    ]);
  }, []);

  const dismissNotice = useCallback((id: number) => {
    setNotices(current => current.filter(notice => notice.id !== id));
  }, []);

  const clearNotices = useCallback((source?: MascotNotice['source']) => {
    setNotices(current => source ? current.filter(notice => notice.source !== source) : []);
  }, []);

  const notice = notices.find(notice => notice.tone === 'error') ?? notices[0];
  useEffect(() => {
    if (!notice || notice.tone === 'error' || suspendAll || suspendTransient) return;
    const timer = window.setTimeout(() => dismissNotice(notice.id), 5000);
    return () => window.clearTimeout(timer);
  }, [notice?.id, notice?.tone, suspendAll, suspendTransient, dismissNotice]);

  return {
    notice,
    notify,
    dismissNotice,
    clearNotices,
  };
}
