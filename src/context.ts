import { createContext, useContext } from 'react';
import type { UIKey, UILang } from './i18n';
import type { CV, Variant } from './types';

export interface EditorCtx {
  cv: CV;
  /** Idioma del contenido que se está editando/previsualizando. */
  lang: string;
  uiLang: UILang;
  variant: Variant;
  update: (fn: (draft: CV) => void) => void;
  t: (key: UIKey) => string;
  setLang: (lang: string) => void;
  setVariantId: (id: string) => void;
}

export const EditorContext = createContext<EditorCtx | null>(null);

export function useEd() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('EditorContext missing');
  return ctx;
}
