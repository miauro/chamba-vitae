import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useEd } from '../context';
import type { CV, LText, Section, Variant } from '../types';
import { autoHref, fontStack, formatRange, getText, normalizeHref, splitLines } from '../utils';
import { IconFit, IconZoomIn, IconZoomOut } from './icons';

/** Pinta `**negrita**` y respeta los saltos de línea. */
function Rich({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {line.split(/\*\*(.+?)\*\*/g).map((part, j) => (j % 2 ? <strong key={j}>{part}</strong> : part))}
        </Fragment>
      ))}
    </>
  );
}

export function CVPreview({ cv, lang, variant }: { cv: CV; lang: string; variant: Variant }) {
  const hidden = new Set(variant.hidden);
  const vis = <T extends { id: string }>(xs: T[]) => xs.filter((x) => !hidden.has(x.id));
  const tx = (l?: LText) => getText(l, lang, cv.languages);
  const { settings: s, profile: p } = cv;
  const title = tx(variant.title) || tx(p.title);

  const style = {
    '--cv-font': fontStack(s.font),
    '--cv-text': s.textColor,
    '--cv-muted': s.mutedColor,
    '--cv-rule': s.ruleColor,
    '--cv-name-size': `${s.nameSize}pt`,
  } as CSSProperties;

  const body = (sec: Section): ReactNode => {
    switch (sec.kind) {
      case 'text':
        return (
          <p className="cv-text">
            <Rich text={tx(sec.body)} />
          </p>
        );
      case 'entries':
        return vis(sec.items).map((e) => (
          <div key={e.id} className="cv-entry">
            <div>
              <h3>{tx(e.title)}</h3>
              {tx(e.subtitle) && <p className="cv-sub">{tx(e.subtitle)}</p>}
              {splitLines(tx(e.description)).map((line, i) => (
                <p key={i} className="cv-bullet">
                  <span aria-hidden="true">→</span>
                  <span>
                    <Rich text={line} />
                  </span>
                </p>
              ))}
            </div>
            <div className="cv-date">{formatRange(e, lang)}</div>
          </div>
        ));
      case 'pairs':
        return vis(sec.items).map((pair) => (
          <div key={pair.id} className="cv-pair">
            <b>{tx(pair.label)}</b>
            <span>
              <Rich text={tx(pair.value)} />
            </span>
          </div>
        ));
      case 'skills':
        return vis(sec.groups).map((g) => (
          <div key={g.id} className="cv-skill-group">
            <b>{tx(g.label)}</b>
            <div>
              {vis(g.rows).map((r) => (
                <div key={r.id} className="cv-skill-row">
                  <span>{tx(r.label)}</span>
                  <ul>
                    {splitLines(tx(r.items)).map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ));
    }
  };

  return (
    <article className="cv-page" style={style} lang={lang}>
      <aside className="cv-side">
        <div>
          <h1 className="cv-name">{p.name}</h1>
          {title && <p className="cv-title">{title}</p>}
        </div>
        {s.showPhoto && p.photo && (
          <div className="cv-photo">
            <img src={p.photo} alt="" className={s.grayscalePhoto ? 'is-gray' : undefined} />
          </div>
        )}
        <ul className="cv-contacts">
          {vis(p.contacts).map((c) => {
            const label = tx(c.label);
            const value = tx(c.value);
            const href = c.href ? normalizeHref(c.href) : autoHref(value);
            return (
              <li key={c.id}>
                {label && <span>{label}</span>}
                {href ? <a href={href}>{value}</a> : <b>{value}</b>}
              </li>
            );
          })}
        </ul>
      </aside>
      <div className="cv-main">
        {vis(cv.sections).map((sec) => (
          <section key={sec.id} className={`cv-sec cv-sec--${sec.kind}`}>
            <h2>{tx(sec.title)}</h2>
            <div className="cv-sec-body">{body(sec)}</div>
          </section>
        ))}
      </div>
    </article>
  );
}

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;
const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

/**
 * Visor de la hoja A4 con zoom. Por defecto se ajusta al ancho del panel; 100 % es tamaño real.
 * Al imprimir se anula la escala.
 */
export function PreviewPane({ children }: { children: ReactNode }) {
  const { t } = useEd();
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0, fit: 1 });
  /** null = ajustar al panel */
  const [zoom, setZoom] = useState<number | null>(null);
  const fitRef = useRef(1);
  fitRef.current = size.fit;
  const scale = zoom ?? size.fit;

  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const measure = () => {
      const pad = parseFloat(getComputedStyle(o).paddingLeft) * 2;
      const w = i.offsetWidth;
      setSize({ w, h: i.offsetHeight, fit: Math.min(1.25, clampZoom((o.clientWidth - pad) / w)) });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(o);
    ro.observe(i);
    measure();
    return () => ro.disconnect();
  }, []);

  // Ctrl/⌘ + rueda (o pellizco en el trackpad) hace zoom de forma continua
  useEffect(() => {
    const o = outer.current;
    if (!o) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setZoom((z) => clampZoom((z ?? fitRef.current) * Math.exp(-e.deltaY * 0.002)));
    };
    o.addEventListener('wheel', onWheel, { passive: false });
    return () => o.removeEventListener('wheel', onWheel);
  }, []);

  const step = (dir: 1 | -1) => {
    const next = dir > 0 ? ZOOM_STEPS.find((s) => s > scale + 0.001) : [...ZOOM_STEPS].reverse().find((s) => s < scale - 0.001);
    if (next) setZoom(next);
  };

  return (
    <div className="preview-area" data-tour="preview">
      <div className="preview-pane" ref={outer}>
        <div className="preview-scale" style={{ width: size.w * scale, height: size.h * scale }}>
          <div className="preview-inner" ref={inner} style={{ transform: `scale(${scale})` }}>
            {children}
          </div>
        </div>
      </div>

      <div className="zoom-bar" role="toolbar" aria-label="Zoom">
        <button type="button" className="icon-btn" title={t('zoomOut')} disabled={scale <= ZOOM_STEPS[0] + 0.001} onClick={() => step(-1)}>
          <IconZoomOut size={18} />
        </button>
        <button type="button" className="zoom-value" title={t('zoomReset')} onClick={() => setZoom(1)}>
          {Math.round(scale * 100)} %
        </button>
        <button type="button" className="icon-btn" title={t('zoomIn')} disabled={scale >= MAX_ZOOM - 0.001} onClick={() => step(1)}>
          <IconZoomIn size={18} />
        </button>
        <span className="zoom-sep" />
        <button
          type="button"
          className={`icon-btn${zoom === null ? ' is-on' : ''}`}
          title={t('zoomFit')}
          aria-pressed={zoom === null}
          onClick={() => setZoom(null)}
        >
          <IconFit size={18} />
        </button>
      </div>
    </div>
  );
}
