import { useCallback, useEffect, useRef, useState } from 'react';
import type { UILang } from './i18n';
import { normalizeCV } from './model';
import { sampleCV } from './sample';
import type { CV } from './types';

const CV_KEY = 'chamba-vitae:cv';
const PREFS_KEY = 'chamba-vitae:prefs';
/** Claves del nombre anterior del proyecto: se leen si no hay datos con las nuevas. */
const LEGACY_KEYS: Record<string, string> = { [CV_KEY]: 'ceuvexpress:cv', [PREFS_KEY]: 'ceuvexpress:prefs' };
const HISTORY_LIMIT = 60;
/** Ediciones seguidas en menos de este tiempo cuentan como un solo paso de deshacer. */
const MERGE_MS = 800;

const read = (key: string) => localStorage.getItem(key) ?? localStorage.getItem(LEGACY_KEYS[key]);

function loadCV(): CV | null {
  try {
    const raw = read(CV_KEY);
    return raw ? normalizeCV(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

interface History {
  cv: CV;
  past: CV[];
  future: CV[];
}

export function useCVStore() {
  const [h, setH] = useState<History>(() => ({ cv: loadCV() ?? sampleCV(), past: [], future: [] }));
  const [saveError, setSaveError] = useState(false);
  const lastEdit = useRef(0);
  const latest = useRef(h.cv);
  latest.current = h.cv;

  const update = useCallback((fn: (draft: CV) => void) => {
    const now = Date.now();
    const merge = now - lastEdit.current < MERGE_MS;
    lastEdit.current = now;
    setH((s) => {
      const next = structuredClone(s.cv);
      fn(next);
      const past = merge && s.past.length ? s.past : [...s.past.slice(-HISTORY_LIMIT), s.cv];
      return { cv: next, past, future: [] };
    });
  }, []);

  const replace = useCallback((cv: CV) => {
    lastEdit.current = 0;
    setH((s) => ({ cv, past: [...s.past.slice(-HISTORY_LIMIT), s.cv], future: [] }));
  }, []);

  const undo = useCallback(() => {
    lastEdit.current = 0;
    setH((s) =>
      s.past.length ? { cv: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.cv, ...s.future] } : s,
    );
  }, []);

  const redo = useCallback(() => {
    lastEdit.current = 0;
    setH((s) => (s.future.length ? { cv: s.future[0], past: [...s.past, s.cv], future: s.future.slice(1) } : s));
  }, []);

  const save = useCallback(() => {
    try {
      localStorage.setItem(CV_KEY, JSON.stringify(latest.current));
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(save, 300);
    return () => clearTimeout(id);
  }, [h.cv, save]);

  useEffect(() => {
    window.addEventListener('beforeunload', save);
    return () => window.removeEventListener('beforeunload', save);
  }, [save]);

  return {
    cv: h.cv,
    update,
    replace,
    undo,
    redo,
    canUndo: h.past.length > 0,
    canRedo: h.future.length > 0,
    saveError,
  };
}

export interface Prefs {
  uiLang: UILang;
  lang: string;
  variantId: string;
  /** Ya vio (o se saltó) la guía de bienvenida. */
  tourDone: boolean;
}

export function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>(() => {
    const defaults: Prefs = {
      uiLang: navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en',
      lang: '',
      variantId: '',
      tourDone: false,
    };
    try {
      return { ...defaults, ...JSON.parse(read(PREFS_KEY) || '{}') };
    } catch {
      return defaults;
    }
  });

  const set = useCallback((patch: Partial<Prefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        /* sin almacenamiento: las preferencias duran solo esta sesión */
      }
      return next;
    });
  }, []);

  return [prefs, set] as const;
}
