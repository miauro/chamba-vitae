import { DEFAULT_TITLES } from './i18n';
import type {
  CV,
  Contact,
  Entry,
  LText,
  Pair,
  Section,
  SectionKind,
  Settings,
  SkillGroup,
  SkillRow,
} from './types';

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

export const defaultSettings = (): Settings => ({
  font: 'Inter',
  nameSize: 26,
  textColor: '#141414',
  mutedColor: '#9b9b9b',
  ruleColor: '#141414',
  showPhoto: true,
  grayscalePhoto: false,
});

export const newEntry = (): Entry => ({
  id: uid(),
  title: {},
  subtitle: {},
  start: '',
  end: '',
  current: false,
  description: {},
});
export const newPair = (): Pair => ({ id: uid(), label: {}, value: {} });
export const newSkillRow = (): SkillRow => ({ id: uid(), label: {}, items: {} });
export const newSkillGroup = (): SkillGroup => ({ id: uid(), label: {}, rows: [newSkillRow()] });
export const newContact = (): Contact => ({ id: uid(), label: {}, value: {} });

export function newSection(kind: SectionKind, title?: LText): Section {
  const base = { id: uid(), title: { ...(title ?? DEFAULT_TITLES[kind]) } };
  switch (kind) {
    case 'text':
      return { ...base, kind, body: {} };
    case 'entries':
      return { ...base, kind, items: [newEntry()] };
    case 'pairs':
      return { ...base, kind, items: [newPair()] };
    case 'skills':
      return { ...base, kind, groups: [newSkillGroup()] };
  }
}

export function blankCV(): CV {
  return {
    schema: 1,
    languages: ['es', 'en'],
    profile: { name: '', title: {}, contacts: [newContact()] },
    sections: [
      newSection('text'),
      newSection('entries', { es: 'formación', en: 'education' }),
      newSection('entries'),
      newSection('pairs'),
      newSection('skills'),
    ],
    variants: [{ id: uid(), name: 'General', hidden: [] }],
    settings: defaultSettings(),
  };
}

/** Copia profunda de una sección con ids nuevos. */
export function reId(section: Section): Section {
  const s = structuredClone(section);
  s.id = uid();
  if (s.kind === 'entries') s.items.forEach((i) => (i.id = uid()));
  if (s.kind === 'pairs') s.items.forEach((i) => (i.id = uid()));
  if (s.kind === 'skills')
    s.groups.forEach((g) => {
      g.id = uid();
      g.rows.forEach((r) => (r.id = uid()));
    });
  return s;
}

export function collectIds(cv: CV): Set<string> {
  const ids = new Set<string>(cv.profile.contacts.map((c) => c.id));
  for (const s of cv.sections) {
    ids.add(s.id);
    if (s.kind === 'entries' || s.kind === 'pairs') s.items.forEach((i) => ids.add(i.id));
    if (s.kind === 'skills')
      s.groups.forEach((g) => {
        ids.add(g.id);
        g.rows.forEach((r) => ids.add(r.id));
      });
  }
  return ids;
}

/* Textos traducibles de cada parte, para calcular qué falta por traducir. */

export const profileTexts = (cv: CV): LText[] => [cv.profile.title, ...cv.profile.contacts.map((c) => c.label)];

export const entryTexts = (e: Entry): LText[] => [e.title, e.subtitle, e.description];

export function sectionTexts(s: Section): LText[] {
  const out: LText[] = [s.title];
  if (s.kind === 'text') out.push(s.body);
  if (s.kind === 'entries') s.items.forEach((e) => out.push(...entryTexts(e)));
  if (s.kind === 'pairs') s.items.forEach((p) => out.push(p.label, p.value));
  if (s.kind === 'skills')
    s.groups.forEach((g) => {
      out.push(g.label);
      g.rows.forEach((r) => out.push(r.label, r.items));
    });
  return out;
}

export function allTexts(cv: CV): LText[] {
  const out = [...profileTexts(cv), ...cv.sections.flatMap(sectionTexts)];
  for (const v of cv.variants) if (v.title) out.push(v.title);
  return out;
}

/** Valida y completa un JSON importado (o guardado) para que siempre tenga la forma esperada. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeCV(raw: any): CV {
  if (!raw || typeof raw !== 'object' || !raw.profile || !Array.isArray(raw.sections)) {
    throw new Error('Invalid CV');
  }
  const languages: string[] =
    Array.isArray(raw.languages) && raw.languages.length ? raw.languages.map(String) : ['es'];
  const seen = new Set<string>();
  const id = (x: any) => {
    const v = typeof x?.id === 'string' && x.id && !seen.has(x.id) ? x.id : uid();
    seen.add(v);
    return v;
  };
  const arr = (x: any): any[] => (Array.isArray(x) ? x.filter((i) => i && typeof i === 'object') : []);
  const str = (x: any) => (typeof x === 'string' || typeof x === 'number' ? String(x) : '');
  const L = (x: any): LText => {
    if (typeof x === 'string') return { [languages[0]]: x };
    const o: LText = {};
    if (x && typeof x === 'object') for (const k in x) if (typeof x[k] === 'string') o[k] = x[k];
    return o;
  };

  const sections: Section[] = [];
  for (const s of arr(raw.sections)) {
    const base = { id: id(s), title: L(s.title) };
    if (s.kind === 'text') sections.push({ ...base, kind: 'text', body: L(s.body) });
    if (s.kind === 'entries')
      sections.push({
        ...base,
        kind: 'entries',
        items: arr(s.items).map((e) => ({
          id: id(e),
          title: L(e.title),
          subtitle: L(e.subtitle),
          start: str(e.start),
          end: str(e.end),
          current: !!e.current,
          description: L(e.description),
        })),
      });
    if (s.kind === 'pairs')
      sections.push({
        ...base,
        kind: 'pairs',
        items: arr(s.items).map((p) => ({ id: id(p), label: L(p.label), value: L(p.value) })),
      });
    if (s.kind === 'skills')
      sections.push({
        ...base,
        kind: 'skills',
        groups: arr(s.groups).map((g) => ({
          id: id(g),
          label: L(g.label),
          rows: arr(g.rows).map((r) => ({ id: id(r), label: L(r.label), items: L(r.items) })),
        })),
      });
  }

  const p = raw.profile;
  const variants = arr(raw.variants).map((v) => ({
    id: typeof v.id === 'string' && v.id ? v.id : uid(),
    name: str(v.name) || 'General',
    hidden: Array.isArray(v.hidden) ? v.hidden.filter((h: unknown) => typeof h === 'string') : [],
    ...(v.title ? { title: L(v.title) } : {}),
  }));

  const defaults = defaultSettings();
  const rs = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
  const settings: Settings = {
    font: typeof rs.font === 'string' ? rs.font : defaults.font,
    nameSize: typeof rs.nameSize === 'number' ? rs.nameSize : defaults.nameSize,
    textColor: typeof rs.textColor === 'string' ? rs.textColor : defaults.textColor,
    mutedColor: typeof rs.mutedColor === 'string' ? rs.mutedColor : defaults.mutedColor,
    ruleColor: typeof rs.ruleColor === 'string' ? rs.ruleColor : defaults.ruleColor,
    showPhoto: typeof rs.showPhoto === 'boolean' ? rs.showPhoto : defaults.showPhoto,
    grayscalePhoto: typeof rs.grayscalePhoto === 'boolean' ? rs.grayscalePhoto : defaults.grayscalePhoto,
  };

  return {
    schema: 1,
    languages,
    profile: {
      name: str(p.name),
      title: L(p.title),
      ...(typeof p.photo === 'string' && p.photo.startsWith('data:image/') ? { photo: p.photo } : {}),
      contacts: arr(p.contacts).map((c) => ({
        id: id(c),
        label: L(c.label),
        value: L(typeof c.value === 'number' ? String(c.value) : c.value),
        ...(c.href ? { href: str(c.href) } : {}),
      })),
    },
    sections,
    variants: variants.length ? variants : [{ id: uid(), name: 'General', hidden: [] }],
    settings,
  };
}
