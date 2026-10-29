import type { Icon } from '@phosphor-icons/react';
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import logoUrl from './assets/logo.svg';
import { EditorContext, type EditorCtx } from './context';
import { ProfileEditor, SectionsEditor } from './components/Editor';
import {
  IconBlank,
  IconCaretDown,
  IconCheck,
  IconContent,
  IconDesign,
  IconExport,
  IconFile,
  IconGlobe,
  IconHelp,
  IconImport,
  IconImportCv,
  IconInfo,
  IconPdf,
  IconRedo,
  IconSample,
  IconTranslate,
  IconUndo,
  IconVariants,
  IconWarning,
} from './components/icons';
import { DesignPanel, VariantsPanel } from './components/Panels';
import { CVPreview, PreviewPane } from './components/Preview';
import { Tour } from './components/Tour';
import { UI_LANGS, UI_LANG_NAMES, langName, makeT, type UIKey } from './i18n';
import { allTexts, blankCV, normalizeCV } from './model';
import { sampleCV } from './sample';
import { useCVStore, usePrefs } from './store';
import { countMissing, downloadFile, slug } from './utils';

type Tab = 'content' | 'design' | 'variants';
const TABS: [Tab, UIKey, Icon][] = [
  ['content', 'tabContent', IconContent],
  ['design', 'tabDesign', IconDesign],
  ['variants', 'tabVariants', IconVariants],
];

interface Toast {
  text: string;
  kind: 'ok' | 'error' | 'busy';
}

const CV_FILE = /\.(pdf|docx?|txt|md)$/i;

export default function App() {
  const store = useCVStore();
  const { cv, undo, redo } = store;
  const [prefs, setPrefs] = usePrefs();
  const [tab, setTab] = useState<Tab>('content');
  const [toast, setToast] = useState<Toast | null>(null);
  const [dragging, setDragging] = useState(false);
  const [tourOpen, setTourOpen] = useState(!prefs.tourDone);
  const fileRef = useRef<HTMLInputElement>(null);
  const cvFileRef = useRef<HTMLInputElement>(null);

  const lang = cv.languages.includes(prefs.lang) ? prefs.lang : cv.languages[0];
  const variant = cv.variants.find((v) => v.id === prefs.variantId) ?? cv.variants[0];
  const t = useMemo(() => makeT(prefs.uiLang), [prefs.uiLang]);
  const texts = useMemo(() => allTexts(cv), [cv]);

  useEffect(() => {
    document.documentElement.lang = prefs.uiLang;
  }, [prefs.uiLang]);

  useEffect(() => {
    if (!toast || toast.kind === 'busy') return;
    const id = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (store.saveError) setToast({ text: t('saveError'), kind: 'error' });
  }, [store.saveError, t]);

  const printPdf = useCallback(() => {
    const prev = document.title;
    const parts = ['CV', cv.profile.name.replace(/\s+/g, ' ').trim(), lang.toUpperCase()];
    if (cv.variants.length > 1) parts.push(variant.name);
    document.title = parts.filter(Boolean).join(' - ');
    window.addEventListener('afterprint', () => (document.title = prev), { once: true });
    window.print();
  }, [cv.profile.name, cv.variants.length, lang, variant.name]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((k === 'z' && e.shiftKey) || k === 'y') {
        e.preventDefault();
        redo();
      } else if (k === 'p') {
        e.preventDefault();
        printPdf();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, printPdf]);

  const openMenus = () => [...document.querySelectorAll<HTMLDetailsElement>('details.dropdown[open]')];
  const closeMenus = () => openMenus().forEach((m) => m.removeAttribute('open'));

  useEffect(() => {
    // Un clic fuera cierra los menús; abrir uno cierra el otro
    const onPointer = (e: PointerEvent) => {
      openMenus().forEach((m) => {
        if (!m.contains(e.target as Node)) m.removeAttribute('open');
      });
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeMenus();
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      const next = normalizeCV(JSON.parse(await file.text()));
      store.replace(next);
      setPrefs({ variantId: next.variants[0].id, lang: next.languages[0] });
      setToast({ text: t('imported'), kind: 'ok' });
    } catch {
      setToast({ text: t('importError'), kind: 'error' });
    }
  };

  /** Convierte un CV en PDF, Word o texto al formato de la app (el importador se carga al usarlo). */
  const importCv = async (file?: File) => {
    if (!file) return;
    setToast({ text: t('importCvBusy'), kind: 'busy' });
    try {
      const { readLines, linesToCV } = await import('./importer');
      const next = linesToCV(await readLines(file));
      setToast(null);
      if (!confirm(t('importCvConfirm').replace('{n}', String(next.sections.length)))) return;
      store.replace(next);
      setPrefs({ variantId: next.variants[0].id, lang: next.languages[0] });
      setTab('content');
      setToast({ text: t('importCvDone'), kind: 'ok' });
    } catch (err) {
      const code = (err as { code?: string }).code;
      setToast({ text: t(code === 'doc' ? 'importCvDoc' : code === 'empty' ? 'importCvEmpty' : 'importCvError'), kind: 'error' });
    }
  };

  const closeTour = () => {
    setTourOpen(false);
    setPrefs({ tourDone: true });
  };

  const exportFile = () => {
    downloadFile(`cv-${slug(cv.profile.name)}.json`, JSON.stringify(cv, null, 2), 'application/json');
  };

  const replaceWith = (make: () => typeof cv) => {
    if (!confirm(t('confirmReplace'))) return;
    const next = make();
    store.replace(next);
    setPrefs({ variantId: next.variants[0].id, lang: next.languages[0] });
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = [...e.dataTransfer.files];
    const json = files.find((f) => f.name.endsWith('.json') || f.type === 'application/json');
    if (json) importFile(json);
    else importCv(files.find((f) => CV_FILE.test(f.name)));
  };

  const ctx: EditorCtx = {
    cv,
    lang,
    uiLang: prefs.uiLang,
    variant,
    update: store.update,
    t,
    setLang: (l) => setPrefs({ lang: l }),
    setVariantId: (id) => setPrefs({ variantId: id }),
  };

  const menuItems: [Icon, string, () => void][] = [
    [IconImportCv, t('importCv'), () => cvFileRef.current?.click()],
    [IconImport, t('import'), () => fileRef.current?.click()],
    [IconExport, t('export'), exportFile],
    [IconSample, t('loadSample'), () => replaceWith(sampleCV)],
    [IconBlank, t('newBlank'), () => replaceWith(blankCV)],
  ];
  const MENU_SEPARATORS = new Set([1, 3]);

  return (
    <EditorContext.Provider value={ctx}>
      <div
        className="app"
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            setDragging(true);
          }
        }}
        onDragLeave={(e) => {
          if (!e.relatedTarget) setDragging(false);
        }}
        onDrop={onDrop}
      >
        <header className="toolbar">
          <img className="brand" src={logoUrl} alt="Chamba Vitae" />

          <div className="tb-sep" />

          {/* Qué CV estás viendo: variante + idioma del contenido, juntos */}
          <div className="cv-context" data-tour="context">
          <label className="tb-group" title={t('variant')}>
            <IconVariants size={18} />
            <span className="tb-label">{t('variant')}</span>
            <span className="select-wrap">
              <select value={variant.id} onChange={(e) => setPrefs({ variantId: e.target.value })}>
                {cv.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
              <IconCaretDown size={12} weight="bold" />
            </span>
          </label>

          <div className="tb-group" title={t('cvLanguage')}>
            <IconTranslate size={18} />
            <span className="tb-label">{t('cvLanguage')}</span>
            <div className="seg">
              {cv.languages.map((l) => {
                const missing = countMissing(texts, l, cv.languages);
                const name = langName(l, prefs.uiLang);
                return (
                  <button
                    key={l}
                    type="button"
                    className={l === lang ? 'on' : ''}
                    title={missing ? `${name} · ${t('missingCount').replace('{n}', String(missing)).replace('{l}', l.toUpperCase())}` : name}
                    onClick={() => setPrefs({ lang: l })}
                  >
                    {l.toUpperCase()}
                    {missing > 0 && <i className="seg-dot" />}
                  </button>
                );
              })}
            </div>
          </div>
          </div>

          <div className="spacer" />

          <div className="tb-icons">
            <button type="button" className="icon-btn lg" disabled={!store.canUndo} title={t('undo')} onClick={undo}>
              <IconUndo size={18} />
            </button>
            <button type="button" className="icon-btn lg" disabled={!store.canRedo} title={t('redo')} onClick={redo}>
              <IconRedo size={18} />
            </button>
          </div>

          <details className="dropdown" data-tour="file">
            <summary className="btn">
              <IconFile size={18} />
              {t('file')}
              <IconCaretDown size={12} weight="bold" />
            </summary>
            <div className="menu" onClick={closeMenus}>
              {menuItems.map(([ItemIcon, label, action], i) => (
                <button key={label} type="button" onClick={action} className={MENU_SEPARATORS.has(i) ? 'sep' : undefined}>
                  <ItemIcon size={18} />
                  {label}
                </button>
              ))}
            </div>
          </details>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              importFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <input
            ref={cvFileRef}
            type="file"
            accept=".pdf,.docx,.txt,.md,application/pdf"
            hidden
            onChange={(e) => {
              importCv(e.target.files?.[0]);
              e.target.value = '';
            }}
          />

          <button type="button" className="btn primary" title={t('printHint')} onClick={printPdf} data-tour="pdf">
            <IconPdf size={18} />
            {t('downloadPdf')}
          </button>

          <button
            type="button"
            className="icon-btn lg"
            title={t('help')}
            aria-label={t('help')}
            onClick={() => {
              setTab('content');
              setTourOpen(true);
            }}
          >
            <IconHelp size={18} />
          </button>

          {/* Idioma de la propia app: secundario, en su menú y separado del idioma del CV */}
          <details className="dropdown">
            <summary className="icon-btn lg ui-lang" title={t('uiLanguage')} aria-label={t('uiLanguage')}>
              <IconGlobe size={18} />
            </summary>
            <div className="menu" onClick={closeMenus}>
              <span className="menu-title">{t('uiLanguage')}</span>
              {UI_LANGS.map((l) => (
                <button key={l} type="button" className={l === prefs.uiLang ? 'on' : undefined} onClick={() => setPrefs({ uiLang: l })}>
                  {UI_LANG_NAMES[l]}
                  {l === prefs.uiLang && <IconCheck size={16} className="menu-check" />}
                </button>
              ))}
            </div>
          </details>
        </header>

        <main className="main">
          <section className="editor" data-tour="editor">
            <nav className="tabs" role="tablist">
              {TABS.map(([id, key, TabIcon]) => (
                <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
                  <TabIcon size={18} weight={tab === id ? 'fill' : 'regular'} />
                  {t(key)}
                  {id === 'variants' && cv.variants.length > 1 && <span className="tab-count">{cv.variants.length}</span>}
                </button>
              ))}
            </nav>
            <div className="editor-body">
              {tab === 'content' && (
                <>
                  {(cv.variants.length > 1 || cv.languages.length > 1) && (
                    <p className="note">
                      <IconInfo size={16} />
                      <span>{t('editingNote').replace('{v}', variant.name).replace('{l}', langName(lang, prefs.uiLang))}</span>
                    </p>
                  )}
                  <ProfileEditor />
                  <SectionsEditor />
                </>
              )}
              {tab === 'design' && <DesignPanel />}
              {tab === 'variants' && <VariantsPanel />}
            </div>
          </section>

          <PreviewPane>
            <CVPreview cv={cv} lang={lang} variant={variant} />
          </PreviewPane>
        </main>

        {dragging && (
          <div className="drop-overlay">
            <IconImport size={40} />
            {t('dropHere')}
          </div>
        )}
        {toast && (
          <div className={`toast ${toast.kind}`} role="status">
            {toast.kind === 'ok' && <IconCheck size={18} weight="fill" />}
            {toast.kind === 'error' && <IconWarning size={18} weight="fill" />}
            {toast.kind === 'busy' && <span className="spinner" aria-hidden="true" />}
            {toast.text}
          </div>
        )}
        {tourOpen && <Tour onClose={closeTour} />}
      </div>
    </EditorContext.Provider>
  );
}
