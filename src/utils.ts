import { cvLabel } from './i18n';
import type { Entry, LText } from './types';

/** Texto en `lang`, o en el primer idioma que lo tenga. */
export function getText(l: LText | undefined, lang: string, langs: string[]): string {
  if (!l) return '';
  if (l[lang]?.trim()) return l[lang];
  for (const k of langs) if (l[k]?.trim()) return l[k];
  for (const k in l) if (l[k]?.trim()) return l[k];
  return '';
}

/** Primer idioma distinto de `lang` que tiene este texto (para mostrarlo como pista al traducir). */
export function otherLang(l: LText, lang: string, langs: string[]): string {
  for (const k of langs) if (k !== lang && l[k]?.trim()) return k;
  return '';
}

/** Falta traducción: vacío en `lang` pero escrito en otro idioma. */
export const isMissing = (l: LText, lang: string, langs: string[]) => !l[lang]?.trim() && !!otherLang(l, lang, langs);

export const countMissing = (texts: LText[], lang: string, langs: string[]) =>
  texts.filter((l) => isMissing(l, lang, langs)).length;

export const splitLines = (s: string) =>
  s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);

export function formatDate(d: string | undefined, lang: string): string {
  if (!d) return '';
  const m = /^(\d{4})(?:-(\d{2}))?$/.exec(d.trim());
  if (!m) return d;
  if (!m[2]) return m[1];
  try {
    const month = new Intl.DateTimeFormat(lang, { month: 'short' })
      .format(new Date(Number(m[1]), Number(m[2]) - 1, 1))
      .replace('.', '');
    return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${m[1]}`;
  } catch {
    return `${m[2]}/${m[1]}`;
  }
}

export function formatRange(e: Entry, lang: string): string {
  const start = formatDate(e.start, lang);
  const end = e.current ? cvLabel(lang, start ? 'present' : 'ongoing') : formatDate(e.end, lang);
  if (start && end) return start === end ? start : `${start} - ${end}`;
  return start || end;
}

const dateKey = (d?: string) => {
  const m = /^(\d{4})(?:-(\d{2}))?/.exec(d ?? '');
  return m ? Number(m[1]) * 100 + Number(m[2] ?? 0) : 0;
};

/** Más reciente primero: las actuales arriba, luego por fecha de fin y de inicio. */
export function sortEntriesByDate(items: Entry[]): Entry[] {
  const endKey = (e: Entry) => (e.current ? 999999 : dateKey(e.end) || dateKey(e.start));
  return [...items].sort((a, b) => endKey(b) - endKey(a) || dateKey(b.start) - dateKey(a.start));
}

export const FONTS = [
  { id: 'Inter', label: 'Inter' },
  { id: 'Inter Tight', label: 'Inter Tight' },
  { id: 'Manrope', label: 'Manrope' },
  { id: 'DM Sans', label: 'DM Sans' },
  { id: 'IBM Plex Sans', label: 'IBM Plex Sans' },
  { id: 'Helvetica', label: 'Helvetica / Arial' },
];

export function fontStack(font: string): string {
  const fallback = "'Helvetica Neue', Helvetica, Arial, sans-serif";
  const clean = font.replace(/['";{}]/g, '').trim();
  return !clean || clean === 'Helvetica' ? fallback : `'${clean}', ${fallback}`;
}

export function autoHref(value: string): string | undefined {
  const v = value.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return `mailto:${v}`;
  if (/^\+?[\d\s().-]{7,}$/.test(v)) return `tel:${v.replace(/[^\d+]/g, '')}`;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^(www\.|[\w-]+\.(com|es|io|dev|net|org|design|me)\b)/i.test(v)) return `https://${v}`;
  return undefined;
}

export function normalizeHref(href: string): string {
  const h = href.trim();
  if (!h || /^(https?:|mailto:|tel:)/i.test(h)) return h;
  return `https://${h}`;
}

/** Redimensiona la foto para que el JSON y el almacenamiento local no pesen demasiado. */
export function resizeImage(file: File, maxSide = 1000): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('canvas'));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image'));
    };
    img.src = url;
  });
}

export function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'cv';
