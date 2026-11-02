import type { Icon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { useEd } from '../context';
import { langName } from '../i18n';
import { allTexts, collectIds, uid } from '../model';
import type { Settings, Variant } from '../types';
import { FONTS } from '../utils';
import { LField, Note, Toggle } from './fields';
import {
  IconCamera,
  IconCheck,
  IconEye,
  IconLayout,
  IconPalette,
  IconPencil,
  IconPlus,
  IconTranslate,
  IconTrash,
  IconType,
  IconVariants,
  IconWarning,
  IconX,
} from './icons';

function Card({ icon: CardIcon, title, children }: { icon: Icon; title: string; children: ReactNode }) {
  return (
    <div className="card">
      <div className="card-head static">
        <CardIcon size={18} className="head-icon" />
        <h2>{title}</h2>
      </div>
      <div className="card-body">{children}</div>
    </div>
  );
}


/* ---------- Diseño ---------- */

export function DesignPanel() {
  const { cv, variant, update, t, uiLang, lang, setLang } = useEd();
  const layout = variant.layout ?? 'sidebar';
  const setLayout = (l: 'sidebar' | 'single') =>
    update((d) => {
      const v = d.variants.find((x) => x.id === variant.id);
      if (!v) return;
      if (l === 'single') v.layout = 'single';
      else delete v.layout;
    });
  const s = cv.settings;
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    update((d) => {
      d.settings[key] = value;
    });
  const isCustomFont = !FONTS.some((f) => f.id === s.font);

  const texts = allTexts(cv).filter((l) => Object.values(l).some((v) => v.trim()));
  const missing = (code: string) => texts.filter((l) => !l[code]?.trim()).length;

  const addLanguage = () => {
    const code = prompt(t('addLanguagePrompt'))?.trim().toLowerCase();
    if (!code) return;
    if (!/^[a-z]{2,3}(-[a-z]{2})?$/.test(code)) return alert(t('invalidLanguage'));
    if (!cv.languages.includes(code))
      update((d) => {
        d.languages.push(code);
      });
    setLang(code);
  };

  const removeLanguage = (code: string) => {
    if (cv.languages.length < 2 || !confirm(t('confirmRemoveLanguage'))) return;
    update((d) => {
      d.languages = d.languages.filter((x) => x !== code);
    });
    if (code === lang) setLang(cv.languages.find((x) => x !== code)!);
  };

  return (
    <>
      <Card icon={IconLayout} title={t('template')}>
        <div className="layout-grid">
          {(['sidebar', 'single'] as const).map((l) => (
            <button key={l} type="button" className={`layout-opt${layout === l ? ' on' : ''}`} aria-pressed={layout === l} onClick={() => setLayout(l)}>
              <span className={`layout-thumb ${l}`} aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <b>{t(l === 'single' ? 'layoutSingle' : 'layoutSidebar')}</b>
              <small>{t(l === 'single' ? 'layoutSingleDesc' : 'layoutSidebarDesc')}</small>
            </button>
          ))}
        </div>
        <p className="field-hint">{t('templateFor').replace('{v}', variant.name)}</p>
      </Card>

      <Card icon={IconTranslate} title={t('languages')}>
          <p className="field-hint">{t('languagesHint')}</p>
          <div className="stack-sm">
            {cv.languages.map((code) => {
              const n = missing(code);
              return (
                <div key={code} className={`list-row${code === lang ? ' on' : ''}`}>
                  <button type="button" className="list-main" onClick={() => setLang(code)}>
                    <b>{code.toUpperCase()}</b>
                    <span>{langName(code, uiLang)}</span>
                    <small className={n ? 'warn' : 'ok'}>
                      {n ? <IconWarning /> : <IconCheck />}
                      {n ? t('missingTranslations').replace('{n}', String(n)) : t('allTranslated')}
                    </small>
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger"
                    disabled={cv.languages.length < 2}
                    title={t('delete')}
                    onClick={() => removeLanguage(code)}
                  >
                    <IconX />
                  </button>
                </div>
              );
            })}
          </div>
          <div>
            <button type="button" className="btn-ghost" onClick={addLanguage}>
              <IconPlus />
              {t('addLanguage')}
            </button>
          </div>
      </Card>

      <Card icon={IconType} title={t('typography')}>
          <label className="field">
            <span className="field-label">{t('font')}</span>
            <select value={isCustomFont ? '__custom' : s.font} onChange={(e) => set('font', e.target.value === '__custom' ? '' : e.target.value)}>
              {FONTS.map((f) => (
                <option key={f.id} value={f.id} style={{ fontFamily: f.id }}>
                  {f.label}
                </option>
              ))}
              <option value="__custom">{t('customFont')}</option>
            </select>
          </label>
          {isCustomFont && (
            <label className="field">
              <input value={s.font} placeholder="Neue Haas Grotesk Display Pro" onChange={(e) => set('font', e.target.value)} />
              <span className="field-hint">{t('customFontHint')}</span>
            </label>
          )}
          <label className="field">
            <span className="field-label">
              {t('nameSize')} <em className="lang-tag">{s.nameSize} pt</em>
            </span>
            <input type="range" min={16} max={36} step={1} value={s.nameSize} onChange={(e) => set('nameSize', Number(e.target.value))} />
          </label>
      </Card>

      <Card icon={IconPalette} title={t('colors')}>
          <div className="color-row">
            {(['textColor', 'mutedColor', 'ruleColor'] as const).map((k) => (
              <label key={k} className="color-field">
                <input type="color" value={s[k]} onChange={(e) => set(k, e.target.value)} />
                <span>{t(k)}</span>
              </label>
            ))}
          </div>
      </Card>

      <Card icon={IconCamera} title={t('photoOptions')}>
          <Toggle label={t('showPhoto')} checked={s.showPhoto} onChange={(v) => set('showPhoto', v)} />
          <Toggle label={t('grayscalePhoto')} checked={s.grayscalePhoto} onChange={(v) => set('grayscalePhoto', v)} />
          {layout === 'single' && <p className="field-hint">{t('photoSingleNote')}</p>}
      </Card>

      <Note id="print">{t('printHint')}</Note>
    </>
  );
}

/* ---------- Variantes ---------- */

export function VariantsPanel() {
  const { cv, variant, update, t, setVariantId } = useEd();
  const ids = collectIds(cv);
  const hiddenCount = (v: Variant) => v.hidden.filter((id) => ids.has(id)).length;
  const updVariant = (fn: (v: Variant) => void) =>
    update((d) => {
      const v = d.variants.find((x) => x.id === variant.id);
      if (v) fn(v);
    });

  const create = () => {
    const name = prompt(t('newVariantPrompt'), `${variant.name} 2`)?.trim();
    if (!name) return;
    const v: Variant = {
      id: uid(),
      name,
      hidden: [...variant.hidden],
      ...(variant.title ? { title: { ...variant.title } } : {}),
      ...(variant.layout ? { layout: variant.layout } : {}),
    };
    update((d) => {
      d.variants.push(v);
    });
    setVariantId(v.id);
  };

  const rename = (v: Variant) => {
    const name = prompt(t('renamePrompt'), v.name)?.trim();
    if (name)
      update((d) => {
        const x = d.variants.find((i) => i.id === v.id);
        if (x) x.name = name;
      });
  };

  const remove = (v: Variant) => {
    if (cv.variants.length < 2 || !confirm(t('confirmDeleteVariant'))) return;
    update((d) => {
      d.variants = d.variants.filter((x) => x.id !== v.id);
    });
    if (v.id === variant.id) setVariantId(cv.variants.find((x) => x.id !== v.id)!.id);
  };

  return (
    <>
      <Note id="variants">{t('variantHelp')}</Note>
      <Card icon={IconVariants} title={t('tabVariants')}>
          <div className="stack-sm">
            {cv.variants.map((v) => (
              <div key={v.id} className={`list-row${v.id === variant.id ? ' on' : ''}`}>
                <button type="button" className="list-main" onClick={() => setVariantId(v.id)}>
                  <span className="dot" />
                  <span>{v.name}</span>
                  <small>{t('hiddenCount').replace('{n}', String(hiddenCount(v)))}</small>
                </button>
                <button type="button" className="icon-btn" title={t('rename')} onClick={() => rename(v)}>
                  <IconPencil />
                </button>
                <button type="button" className="icon-btn danger" disabled={cv.variants.length < 2} title={t('delete')} onClick={() => remove(v)}>
                  <IconTrash />
                </button>
              </div>
            ))}
          </div>
          <div>
            <button type="button" className="btn-ghost" onClick={create}>
              <IconPlus />
              {t('newVariant')}
            </button>
          </div>
      </Card>

      <Card icon={IconPencil} title={variant.name}>
          <Toggle
            label={t('variantTitle')}
            checked={!!variant.title}
            onChange={(on) =>
              update((d) => {
                const v = d.variants.find((x) => x.id === variant.id);
                if (!v) return;
                if (on) v.title = { ...d.profile.title };
                else delete v.title;
              })
            }
          />
          {variant.title && (
            <LField
              label={t('title')}
              multiline
              rows={3}
              value={variant.title}
              onChange={(val, l) => updVariant((v) => (v.title![l] = val))}
            />
          )}
          <div>
            <button type="button" className="btn-ghost" disabled={!hiddenCount(variant)} onClick={() => updVariant((v) => (v.hidden = []))}>
              <IconEye />
              {t('showAll')}
            </button>
          </div>
      </Card>
    </>
  );
}
