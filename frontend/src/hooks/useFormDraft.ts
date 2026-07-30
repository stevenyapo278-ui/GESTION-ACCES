import { useEffect, useRef, useState, useCallback } from 'react';

const DRAFT_PREFIX = 'form-draft-';

export function useFormDraft(token: string | undefined) {
  const key = token ? `${DRAFT_PREFIX}${token}` : null;
  const [hasDraft, setHasDraft] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!key) return;
    setHasDraft(localStorage.getItem(key) !== null);
  }, [key]);

  const save = useCallback((values: Record<string, any>) => {
    if (!key) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      localStorage.setItem(key, JSON.stringify(values));
      setHasDraft(true);
    }, 500);
  }, [key]);

  const restore = useCallback((): Record<string, any> | null => {
    if (!key) return null;
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [key]);

  const clear = useCallback(() => {
    if (!key) return;
    localStorage.removeItem(key);
    setHasDraft(false);
  }, [key]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { save, restore, clear, hasDraft, setHasDraft };
}
