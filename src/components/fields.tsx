import { useMemo, type ChangeEvent } from 'react';
import { useEd } from '../context';
import type { LText } from '../types';
import { otherLang } from '../utils';
import { IconArrowRight, IconEye, IconEyeOff } from './icons';

interface LFieldProps {
  label?: string;
  value: LText;
  onChange: (value: string, lang: string) => void;
  multiline?: boolean;
  rows?: number;
  hint?: string;
  placeholder?: string;
  /** No avisar si falta la traducción (p. ej. un email, que es igual en todos los idiomas). */
  optional?: boolean;
}

/**
 * Campo traducible: edita el idioma activo. Si falta la traducción se marca en ámbar,
 * muestra el texto del otro idioma como pista y ofrece copiarlo tal cual.
 */
export function LField({ label, value, onChange, multiline, rows = 3, hint, placeholder, optional }: LFieldProps) {
  const { cv, lang, t } = useEd();
  const current = value[lang] ?? '';
  const other = current.trim() ? '' : otherLang(value, lang, cv.languages);
  const fallback = other ? value[other] : '';
  const src = optional ? '' : other;
  const LANG = lang.toUpperCase();
  const common = {
    value: current,
    placeholder: fallback || placeholder,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value, lang),
  };
  return (
    <label className={`field${src ? ' is-missing' : ''}`}>
      {label && (
        <span className="field-label">
          {label}
          {cv.languages.length > 1 && (
            <em className={`lang-tag${src ? ' warn' : ''}`}>{src ? t('missingTag').replace('{l}', LANG) : LANG}</em>
          )}
        </span>
      )}
      <span className="field-control">
        {multiline ? <textarea rows={rows} {...common} /> : <input {...common} />}
        {src && (
          <button
            type="button"
            className="copy-lang"
            title={t('copyFrom').replace('{l}', src.toUpperCase())}
            onClick={(e) => {
              e.preventDefault();
              onChange(fallback, lang);
            }}
          >
            {src.toUpperCase()}
            <IconArrowRight size={10} weight="bold" />
            {LANG}
          </button>
        )}
      </span>
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

/** Contador ámbar de textos sin traducir, para cabeceras de tarjetas. */
export function MissingBadge({ count }: { count: number }) {
  const { lang, t } = useEd();
  if (!count) return null;
  return (
    <span className="miss-count" title={t('missingCount').replace('{n}', String(count)).replace('{l}', lang.toUpperCase())}>
      {count}
    </span>
  );
}

interface TextFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  hint?: string;
}

export function TextField({ label, value, onChange, multiline, rows = 2, placeholder, hint }: TextFieldProps) {
  const common = {
    value,
    placeholder,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
  };
  return (
    <label className="field">
      {label && <span className="field-label">{label}</span>}
      {multiline ? <textarea rows={rows} {...common} /> : <input {...common} />}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

/** Año obligatorio + mes opcional. Se guarda como 'AAAA' o 'AAAA-MM'. */
export function DateField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { uiLang, t } = useEd();
  const [year = '', month = ''] = (value ?? '').split('-');
  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        try {
          return new Intl.DateTimeFormat(uiLang, { month: 'long' }).format(new Date(2020, i, 1));
        } catch {
          return String(i + 1);
        }
      }),
    [uiLang],
  );
  const set = (y: string, m: string) => onChange(y ? (m ? `${y}-${m}` : y) : '');

  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="date-row">
        <input
          inputMode="numeric"
          maxLength={4}
          placeholder={t('year')}
          value={year}
          disabled={disabled}
          onChange={(e) => set(e.target.value.replace(/\D/g, ''), month)}
        />
        <select value={month} disabled={disabled || !year} onChange={(e) => set(year, e.target.value)}>
          <option value="">{t('noMonth')}</option>
          {months.map((name, i) => (
            <option key={i} value={String(i + 1).padStart(2, '0')}>
              {name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

/** Ojo: oculta/muestra un elemento solo en la variante activa. */
export function EyeButton({ id }: { id: string }) {
  const { variant, update, t } = useEd();
  const hidden = variant.hidden.includes(id);
  return (
    <button
      type="button"
      className={`icon-btn act${hidden ? ' is-off' : ''}`}
      title={hidden ? t('show') : t('hide')}
      aria-pressed={hidden}
      onClick={() =>
        update((d) => {
          const v = d.variants.find((x) => x.id === variant.id);
          if (v) v.hidden = hidden ? v.hidden.filter((x) => x !== id) : [...v.hidden, id];
        })
      }
    >
      {hidden ? <IconEyeOff /> : <IconEye />}
    </button>
  );
}
