import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useEd } from '../context';
import type { UIKey } from '../i18n';
import { IconArrowRight, IconX } from './icons';

/** Cada paso resalta el elemento marcado con data-tour="…" (o ninguno: tarjeta centrada). */
const STEPS: { target?: string; n: number }[] = [
  { n: 1 },
  { target: 'editor', n: 2 },
  { target: 'preview', n: 3 },
  { target: 'context', n: 4 },
  { target: 'sections', n: 5 },
  { target: 'file', n: 6 },
  { target: 'pdf', n: 7 },
  { n: 8 },
];

const POP_W = 340;
const PAD = 6;

export function Tour({ onClose }: { onClose: () => void }) {
  const { t } = useEd();
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  useLayoutEffect(() => {
    const el = step.target ? document.querySelector(`[data-tour="${step.target}"]`) : null;
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ block: 'nearest' });
    const update = () => setRect(el.getBoundingClientRect());
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [step.target]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') last ? onClose() : setI(i + 1);
      else if (e.key === 'ArrowLeft' && i > 0) setI(i - 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [i, last, onClose]);

  const popStyle = rect ? place(rect) : undefined;
  const next = last ? t('tourDone') : i === 0 ? t('tourStart') : t('tourNext');

  return createPortal(
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {rect ? (
        <div
          className="tour-hole"
          style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }}
        />
      ) : (
        <div className="tour-dim" />
      )}
      <div className={`tour-pop${rect ? '' : ' center'}`} style={popStyle}>
        <button type="button" className="icon-btn tour-close" title={t('tourSkip')} onClick={onClose}>
          <IconX />
        </button>
        {!step.target && <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="tour-logo" />}
        <h2 id="tour-title">{t(`tour${step.n}Title` as UIKey)}</h2>
        <p>{t(`tour${step.n}Body` as UIKey)}</p>
        <div className="tour-foot">
          <div className="tour-dots" aria-hidden="true">
            {STEPS.map((_, k) => (
              <i key={k} className={k === i ? 'on' : undefined} />
            ))}
          </div>
          {i > 0 && (
            <button type="button" className="btn" onClick={() => setI(i - 1)}>
              {t('tourBack')}
            </button>
          )}
          <button type="button" className="btn primary" autoFocus onClick={() => (last ? onClose() : setI(i + 1))}>
            {next}
            {!last && <IconArrowRight weight="bold" />}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Coloca la tarjeta junto al elemento: al lado si es muy alto, si no debajo (o encima si no cabe). */
function place(r: DOMRect): CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampX = (x: number) => Math.max(16, Math.min(x, vw - POP_W - 16));
  if (r.height > vh * 0.5) {
    const left = r.right + POP_W + 32 < vw ? r.right + 16 : r.left - POP_W - 16;
    return { left: clampX(left), top: Math.max(16, Math.min(r.top + 40, vh - 260)) };
  }
  const below = r.bottom + 16;
  return below + 240 < vh
    ? { left: clampX(r.left), top: below }
    : { left: clampX(r.left), top: Math.max(16, r.top - 16), transform: 'translateY(-100%)' };
}
