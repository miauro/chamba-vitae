/*
 * Importa un CV desde PDF, Word (.docx) o texto y lo convierte al formato de la app.
 * Todo ocurre en el navegador, sin IA ni servidor: se extraen las líneas del archivo y
 * unas reglas reconocen nombre, contacto, títulos de sección, fechas y entradas.
 * El resultado es un punto de partida que el usuario revisa, no una copia perfecta.
 */
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { defaultSettings, uid } from './model';
import type { Contact, CV, Entry, LText, Section, SectionKind, SkillGroup } from './types';

export class ImportError extends Error {
  constructor(public code: 'doc' | 'empty' | 'read') {
    super(code);
  }
}

/** Una fila del documento: sus trozos separados por huecos grandes (columnas, tabuladores). */
interface Line {
  parts: string[];
  /** Tamaño de letra en pt (0 si no se sabe). */
  size: number;
  /** Identifica la fuente (negrita, regular…) cuando el formato lo permite. */
  font: string;
  /** Hay un hueco vertical grande antes: empieza un bloque nuevo. */
  gapBefore: boolean;
}

const text = (l: Line) => l.parts.join(' ');

/* ---------- Lectura de archivos ---------- */

export async function readLines(file: File): Promise<Line[]> {
  const name = file.name.toLowerCase();
  let lines: Line[];
  if (name.endsWith('.pdf') || file.type === 'application/pdf') lines = await pdfLines(await file.arrayBuffer());
  else if (name.endsWith('.docx')) lines = await docxLines(await file.arrayBuffer());
  else if (name.endsWith('.doc')) throw new ImportError('doc');
  else lines = textLines(await file.text());
  if (!lines.some((l) => text(l).trim().length > 2)) throw new ImportError('empty');
  return lines;
}

const splitParts = (s: string) =>
  s
    .split(/\t+| {3,}/)
    .map((p) => p.trim())
    .filter(Boolean);

function textLines(raw: string): Line[] {
  const out: Line[] = [];
  let gap = true;
  for (const ln of raw.split(/\r?\n/)) {
    if (!ln.trim()) {
      gap = true;
      continue;
    }
    out.push({ parts: splitParts(ln), size: 0, font: '', gapBefore: gap });
    gap = false;
  }
  return out;
}

interface Seg {
  text: string;
  x0: number;
  x1: number;
  y: number;
  size: number;
  font: string;
}

async function pdfLines(buf: ArrayBuffer): Promise<Line[]> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const out: Line[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const width = page.getViewport({ scale: 1 }).width;
    const content = await page.getTextContent();
    const items = content.items
      .filter((it): it is TextItem => 'str' in it && it.str.trim() !== '')
      .map((it) => ({
        str: it.str,
        x: it.transform[4],
        y: it.transform[5],
        w: it.width,
        size: Math.round((Math.hypot(it.transform[2], it.transform[3]) || it.height) * 10) / 10,
        font: it.fontName,
      }));

    // 1. Agrupar en filas por altura y partir cada fila en trozos por huecos horizontales
    const segs: Seg[] = [];
    for (const row of groupRows(items, (i) => i.y, (i) => i.size)) {
      row.sort((a, b) => a.x - b.x);
      let cur: Seg | null = null;
      for (const it of row) {
        const gap = cur ? it.x - cur.x1 : 0;
        if (cur && gap < Math.max(it.size * 1.2, 4)) {
          const glue = gap > it.size * 0.15 && !cur.text.endsWith(' ') && !it.str.startsWith(' ') ? ' ' : '';
          cur.text += glue + it.str;
          cur.x1 = it.x + it.w;
          cur.size = Math.max(cur.size, it.size);
        } else {
          cur = { text: it.str, x0: it.x, x1: it.x + it.w, y: it.y, size: it.size, font: it.font };
          segs.push(cur);
        }
      }
    }

    // 2. ¿Maqueta a dos columnas? Se lee primero la izquierda entera y luego la derecha
    for (const col of splitColumns(segs, width)) {
      const rows = groupRows(col, (s) => s.y, (s) => s.size).map((r) => r.sort((a, b) => a.x0 - b.x0));
      const dys = rows.slice(1).map((r, i) => rows[i][0].y - r[0].y).filter((d) => d > 0);
      const typical = median(dys) || 12;
      rows.forEach((r, i) => {
        const dy = i ? rows[i - 1][0].y - r[0].y : Infinity;
        out.push({
          parts: r.map((s) => s.text.trim()).filter(Boolean),
          size: Math.max(...r.map((s) => s.size)),
          font: r[0].font,
          gapBefore: dy > typical * 1.45,
        });
      });
    }
  }
  return out;
}

/** Agrupa elementos que están a la misma altura (de arriba abajo). */
function groupRows<T>(items: T[], y: (t: T) => number, size: (t: T) => number): T[][] {
  const sorted = [...items].sort((a, b) => y(b) - y(a));
  const rows: T[][] = [];
  for (const it of sorted) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(y(last[0]) - y(it)) < Math.max(size(it), size(last[0])) * 0.5) last.push(it);
    else rows.push([it]);
  }
  return rows;
}

/**
 * Busca una línea vertical que no cruce ningún texto y deje bastante texto a cada lado.
 * Si hay varias, gana la de lados más independientes: en una tabla (títulos | contenido)
 * cada fila de la izquierda tiene pareja a su altura a la derecha; en dos columnas reales, no.
 */
function splitColumns(segs: Seg[], width: number): Seg[][] {
  const n = segs.length;
  let best: { b: number; aligned: number; score: number } | null = null;
  for (let f = 0.2; f <= 0.6; f += 0.01) {
    const b = width * f;
    const left = segs.filter((s) => s.x1 <= b);
    const right = segs.filter((s) => s.x0 >= b);
    const cross = n - left.length - right.length;
    const score = Math.min(left.length, right.length);
    // Una columna lateral estrecha (contacto, foto…) puede tener poco texto: basta con un 8 %
    if (cross > n * 0.01 || score < Math.max(5, n * 0.08)) continue;
    // En una tabla los textos comparten línea base casi exacta; por azar, casi nunca
    const aligned = left.filter((l) => right.some((r) => Math.abs(r.y - l.y) < 1.5)).length / left.length;
    if (aligned > 0.6) continue;
    if (!best || aligned < best.aligned - 0.05 || (Math.abs(aligned - best.aligned) <= 0.05 && score > best.score)) best = { b, aligned, score };
  }
  if (!best) return [segs];
  const b = best.b;
  return [segs.filter((s) => s.x1 <= b), segs.filter((s) => s.x1 > b)];
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

async function docxLines(buf: ArrayBuffer): Promise<Line[]> {
  const { unzipSync, strFromU8 } = await import('fflate');
  const files = unzipSync(new Uint8Array(buf), { filter: (f) => f.name === 'word/document.xml' });
  const xml = files['word/document.xml'];
  if (!xml) throw new ImportError('read');
  const doc = new DOMParser().parseFromString(strFromU8(xml), 'application/xml');
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const out: Line[] = [];
  let gap = true;

  for (const p of Array.from(doc.getElementsByTagNameNS(W, 'p'))) {
    // Word guarda los cuadros de texto dos veces; nos quedamos con la versión moderna
    if (hasAncestor(p, 'Fallback')) continue;
    let raw = '';
    let size = 0;
    let bold = false;
    for (const node of Array.from(p.getElementsByTagNameNS(W, '*'))) {
      if (node.localName === 't') raw += node.textContent ?? '';
      else if (node.localName === 'tab') raw += '\t';
      else if (node.localName === 'br') raw += '\n';
      else if (node.localName === 'sz') size = Math.max(size, Number(node.getAttributeNS(W, 'val')) / 2 || 0);
      else if (node.localName === 'b') bold = true;
    }
    const style = p.getElementsByTagNameNS(W, 'pStyle')[0]?.getAttributeNS(W, 'val') ?? '';
    if (/heading|t[ií]tulo|title/i.test(style)) size = Math.max(size, 16);
    if (!raw.trim()) {
      gap = true;
      continue;
    }
    for (const ln of raw.split('\n')) {
      if (!ln.trim()) continue;
      out.push({ parts: splitParts(ln), size, font: bold ? 'bold' : '', gapBefore: gap });
      gap = false;
    }
  }
  return out;
}

function hasAncestor(el: Element, localName: string) {
  for (let n = el.parentElement; n; n = n.parentElement) if (n.localName === localName) return true;
  return false;
}

/* ---------- Reconocimiento ---------- */

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[:.•|·]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

type Group = 'about' | 'education' | 'experience' | 'languages' | 'skills' | 'courses' | 'other';

const HEADINGS: [Group, string[]][] = [
  ['about', ['sobre mi', 'acerca de mi', 'perfil', 'perfil profesional', 'resumen', 'resumen profesional', 'presentacion', 'objetivo', 'objetivo profesional', 'about', 'about me', 'profile', 'professional profile', 'summary', 'professional summary', 'objective']],
  ['education', ['formacion', 'formacion academica', 'educacion', 'estudios', 'titulacion', 'education', 'academic background', 'academic training', 'qualifications']],
  ['experience', ['experiencia', 'experiencia profesional', 'experiencia laboral', 'trayectoria', 'trayectoria profesional', 'historial laboral', 'experience', 'work experience', 'professional experience', 'employment', 'employment history', 'work history', 'career']],
  ['languages', ['idiomas', 'lenguas', 'languages', 'language skills']],
  ['skills', ['habilidades', 'competencias', 'aptitudes', 'conocimientos', 'herramientas', 'informatica', 'habilidades tecnicas', 'skills', 'tools', 'technical skills', 'competencies', 'software', 'tech stack']],
  ['courses', ['cursos', 'formacion complementaria', 'certificaciones', 'certificados', 'proyectos', 'voluntariado', 'premios', 'publicaciones', 'courses', 'certifications', 'certificates', 'projects', 'volunteering', 'awards', 'publications']],
  ['other', ['destrezas', 'intereses', 'aficiones', 'otros', 'otros datos', 'informacion adicional', 'referencias', 'interests', 'hobbies', 'other', 'additional information', 'references', 'strengths']],
];

const KIND: Record<Group, SectionKind> = {
  about: 'text',
  education: 'entries',
  experience: 'entries',
  languages: 'pairs',
  skills: 'skills',
  courses: 'entries',
  other: 'text',
};

function headingGroup(s: string): Group | null {
  const n = norm(s);
  if (!n || n.length > 40) return null;
  for (const [group, keys] of HEADINGS)
    if (keys.some((k) => n === k || (n.startsWith(`${k} `) && n.length <= k.length + 22))) return group;
  return null;
}

const MONTHS: Record<string, number> = {
  ene: 1, enero: 1, jan: 1, january: 1, feb: 2, febrero: 2, february: 2, mar: 3, marzo: 3, march: 3,
  abr: 4, abril: 4, apr: 4, april: 4, may: 5, mayo: 5, jun: 6, junio: 6, june: 6, jul: 7, julio: 7, july: 7,
  ago: 8, agosto: 8, aug: 8, august: 8, sep: 9, sept: 9, septiembre: 9, september: 9, oct: 10, octubre: 10,
  october: 10, nov: 11, noviembre: 11, november: 11, dic: 12, diciembre: 12, dec: 12, december: 12,
};
const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');
const ONE_DATE = `(?:(?:${MONTH_RE})\\.?\\s+(?:de\\s+)?|\\d{1,2}[/.-])?(?:19|20)\\d{2}`;
const NOW = 'la actualidad|actualidad|actualmente|hoy|presente|present|current|currently|now|today';
const RANGE_RE = new RegExp(
  `(${ONE_DATE})\\s*(?:-|–|—|/|a|al|hasta|to|until)\\s*(${ONE_DATE}|${NOW})|(${ONE_DATE})|\\b(${NOW})\\b`,
  'i',
);

function parseDate(s: string): string {
  const y = /(?:19|20)\d{2}/.exec(s)?.[0];
  if (!y) return '';
  const name = new RegExp(`(${MONTH_RE})`, 'i').exec(norm(s))?.[1];
  const num = /(\d{1,2})[/.-](?:19|20)\d{2}/.exec(s)?.[1];
  const m = name ? MONTHS[name.toLowerCase()] : num ? Number(num) : 0;
  return m >= 1 && m <= 12 ? `${y}-${String(m).padStart(2, '0')}` : y;
}

interface DateHit {
  start: string;
  end: string;
  current: boolean;
  /** Texto que ocupaba la fecha, para quitarlo de la línea. */
  match: string;
}

function findDate(s: string): DateHit | null {
  const m = RANGE_RE.exec(s);
  if (!m) return null;
  if (m[1]) {
    const now = new RegExp(`^(${NOW})$`, 'i').test(m[2]);
    return { start: parseDate(m[1]), end: now ? '' : parseDate(m[2]), current: now, match: m[0] };
  }
  if (m[3]) return { start: parseDate(m[3]), end: '', current: false, match: m[0] };
  return { start: '', end: '', current: true, match: m[0] };
}

const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
const PHONE_RE = /\+?\d[\d\s().-]{7,}\d/;
const URL_RE = /(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com|github\.com|behance\.net|dribbble\.com|[\w-]+\.(?:com|es|io|dev|me|design|net|org|art|studio))(?:\/[\w\-./?=#%&]*)?/i;
const LOCATION_RE = /^[\p{Lu}][\p{L} .'-]{1,30},\s*[\p{L} .'-]{2,30}$/u;
/** Etiquetas sueltas como «Email:» que sobran una vez reconocido el dato. */
const CONTACT_LABELS = /^(e-?mail|correo|correo electronico|telefono|tel|tlf|movil|phone|mobile|linkedin|web|website|portfolio|github|direccion|address|ubicacion|location)$/;

const BULLET_RE = /^[•\-–—→▪◦·*➤►✓]\s*/;

const ES_WORDS = /\b(de|la|el|en|y|con|para|del|los|las|una|experiencia|formacion|idiomas)\b/g;
const EN_WORDS = /\b(the|and|of|with|for|in|to|an|experience|education|languages|skills)\b/g;

const cleanEdges = (s: string) => s.replace(/^[\s|·,–—-]+|[\s|·,–—-]+$/g, '').trim();

/** Convierte las líneas leídas en un CV. */
export function linesToCV(input: Line[]): CV {
  const lines = input.map((l) => ({ ...l, parts: [...l.parts] }));
  const all = norm(lines.map(text).join(' '));
  const es = (all.match(ES_WORDS) ?? []).length;
  const en = (all.match(EN_WORDS) ?? []).length;
  const lang = es >= en ? 'es' : 'en';
  const L = (s: string): LText => ({ [lang]: s });

  // ---- Zona de cabecera: todo lo anterior al primer título de sección
  const firstHeading = lines.findIndex((l) => l.parts.length > 0 && headingGroup(l.parts[0]));
  const headEnd = firstHeading === -1 ? Math.min(lines.length, 12) : firstHeading;
  const head = lines.slice(0, headEnd);
  const body = lines.slice(headEnd);
  const sizes = lines.map((l) => l.size).filter(Boolean);
  const bodySize = median(sizes);

  // Contacto (en cabecera y, por si acaso, en cualquier parte: email/teléfono/enlaces)
  const contacts: Contact[] = [];
  const seen = new Set<string>();
  const addContact = (label: LText, value: string) => {
    const key = norm(value);
    if (!value || seen.has(key)) return;
    seen.add(key);
    contacts.push({ id: uid(), label, value: { [lang]: value } });
  };
  const LABELS = {
    email: { es: 'Email:', en: 'Email:' },
    phone: { es: 'Teléfono:', en: 'Phone:' },
    web: { es: 'Web:', en: 'Website:' },
    linkedin: { es: 'LinkedIn:', en: 'LinkedIn:' },
  };
  for (const [i, l] of lines.entries()) {
    l.parts = l.parts
      .map((part) => {
        let rest = part;
        const email = EMAIL_RE.exec(rest)?.[0];
        if (email) {
          addContact(LABELS.email, email);
          rest = rest.replace(email, '');
        }
        const url = URL_RE.exec(rest)?.[0];
        if (url && !EMAIL_RE.test(part)) {
          addContact(/linkedin/i.test(url) ? LABELS.linkedin : LABELS.web, url.replace(/^https?:\/\/(www\.)?/, ''));
          rest = rest.replace(url, '');
        }
        const phone = PHONE_RE.exec(rest)?.[0];
        if (phone && phone.replace(/\D/g, '').length >= 9 && !RANGE_RE.test(phone.replace(/\s/g, ''))) {
          addContact(LABELS.phone, phone.trim());
          rest = rest.replace(phone, '');
        }
        if (rest !== part) rest = cleanEdges(rest);
        if (i < headEnd && LOCATION_RE.test(rest) && rest.split(' ').length <= 5 && contacts.length) {
          addContact({}, rest);
          rest = '';
        }
        return CONTACT_LABELS.test(norm(rest)) ? '' : rest;
      })
      .filter(Boolean);
  }

  // Nombre: la letra más grande de la cabecera (o la primera línea corta)
  const headLines = head.filter((l) => l.parts.length);
  const maxSize = Math.max(0, ...headLines.map((l) => l.size));
  let nameIdx = maxSize > 0 ? headLines.findIndex((l) => l.size === maxSize) : headLines.findIndex((l) => text(l).split(' ').length <= 5);
  if (nameIdx < 0) nameIdx = 0;
  const nameParts: string[] = [];
  let k = nameIdx;
  const nameLine = headLines[nameIdx];
  // Con tamaños de letra (PDF) el nombre puede ocupar varias líneas iguales; sin ellos, solo una
  const maxNameLines = maxSize > 0 ? 4 : 1;
  while (k < headLines.length && nameLine && headLines[k].size === nameLine.size && headLines[k].font === nameLine.font && nameParts.length < maxNameLines) {
    nameParts.push(text(headLines[k]));
    k++;
  }
  // Cargo: líneas cortas justo después del nombre
  const titleParts: string[] = [];
  while (
    k < headLines.length &&
    titleParts.length < (maxSize > 0 ? 4 : 1) &&
    text(headLines[k]).split(' ').length <= 6 &&
    !findDate(text(headLines[k])) &&
    (!maxSize || headLines[k].size >= maxSize * 0.55 || !titleParts.length)
  ) {
    titleParts.push(text(headLines[k]));
    k++;
  }
  // Resto de la cabecera: pares «Etiqueta:» + valor (Disponibilidad, Carnet…) pasan a contacto
  const others = headLines.filter((_, i) => i < nameIdx || i >= k);
  const loose: string[] = [];
  for (let i = 0; i < others.length; i++) {
    const t = text(others[i]);
    const label = /^([^:]{2,30}):\s*(.*)$/.exec(t);
    if (label && label[2]) addContact({ [lang]: `${label[1]}:` }, label[2]);
    else if (label && others[i + 1]) {
      // el valor puede ocupar varias líneas hasta la siguiente etiqueta
      const value: string[] = [];
      while (others[i + 1] && !/:\s*$/.test(text(others[i + 1])) && value.length < 3) value.push(text(others[++i]));
      addContact({ [lang]: `${label[1]}:` }, value.join(' '));
    } else loose.push(t);
  }
  const leftover = loose.join(' ').trim();

  // ---- Secciones
  const sections: Section[] = [];
  interface Raw {
    group: Group;
    title: string;
    lines: Line[];
  }
  const raws: Raw[] = [];
  if (leftover.length > 80) raws.push({ group: 'about', title: lang === 'es' ? 'sobre mí' : 'about me', lines: [{ parts: [leftover], size: 0, font: '', gapBefore: true }] });

  for (const l of body) {
    if (!l.parts.length) continue;
    const group = headingGroup(l.parts[0]);
    const looksLikeHeading =
      !group && bodySize > 0 && l.size >= bodySize * 1.25 && l.parts.length === 1 && text(l).length < 40 && !findDate(text(l));
    if (group || looksLikeHeading) {
      raws.push({ group: group ?? 'other', title: l.parts[0].replace(/[:.]+$/, '').toLowerCase(), lines: [] });
      const rest = l.parts.slice(1);
      if (rest.length) raws[raws.length - 1].lines.push({ ...l, parts: rest, gapBefore: true });
    } else if (raws.length) {
      raws[raws.length - 1].lines.push(l);
    } else {
      raws.push({ group: 'about', title: lang === 'es' ? 'sobre mí' : 'about me', lines: [l] });
    }
  }

  for (const r of raws) {
    if (!r.lines.length) continue;
    const kind = KIND[r.group];
    const base = { id: uid(), title: L(r.title) };
    if (kind === 'text') sections.push({ ...base, kind, body: L(joinParagraphs(r.lines)) });
    if (kind === 'entries') {
      const items = toEntries(r.lines, L);
      if (items.length) sections.push({ ...base, kind, items });
    }
    if (kind === 'pairs')
      sections.push({
        ...base,
        kind,
        items: r.lines.map((l) => {
          const [label, ...value] = l.parts.length > 1 ? l.parts : text(l).split(/\s*[:–—|]\s+|\s+-\s+/);
          return { id: uid(), label: L(label.trim()), value: L(value.join(' ').trim()) };
        }),
      });
    if (kind === 'skills') {
      const groups = toSkillGroups(r.lines, L);
      if (groups.length) sections.push({ ...base, kind, groups });
    }
  }

  return {
    schema: 1,
    languages: [lang, lang === 'es' ? 'en' : 'es'],
    profile: { name: nameParts.join(' '), title: L(titleParts.join('\n')), contacts },
    sections,
    variants: [{ id: uid(), name: 'General', hidden: [] }],
    settings: defaultSettings(),
  };
}

const splitItems = (s: string) =>
  s
    .split(/\s*[,·•|;]\s*/)
    .map((p) => p.replace(BULLET_RE, '').trim())
    .filter((p) => p.length > 0 && p.length <= 40);

/**
 * Habilidades. Si las filas vienen en columnas (Grupo | Categoría | elemento) se respeta la
 * estructura; si no, todo va a una lista única.
 */
function toSkillGroups(lines: Line[], L: (s: string) => LText): SkillGroup[] {
  const groups: { label: string; rows: { label: string; items: string[] }[] }[] = [];
  const tabular = lines.some((l) => l.parts.length >= 2);
  const group = () => groups[groups.length - 1] ?? (groups.push({ label: '', rows: [] }), groups[0]);
  const row = (label = '') => {
    const g = group();
    if (label || !g.rows.length) g.rows.push({ label, items: [] });
    return g.rows[g.rows.length - 1];
  };
  for (const l of lines) {
    const p = l.parts;
    if (tabular && p.length >= 3) {
      groups.push({ label: p[0], rows: [] });
      row(p[1]).items.push(...p.slice(2).flatMap(splitItems));
    } else if (tabular && p.length === 2) row(p[0]).items.push(...splitItems(p[1]));
    else row().items.push(...p.flatMap(splitItems));
  }
  return groups
    .map((g) => ({
      id: uid(),
      label: L(g.label),
      rows: g.rows
        .filter((r) => r.items.length)
        .map((r) => ({ id: uid(), label: L(r.label), items: L([...new Set(r.items)].join('\n')) })),
    }))
    .filter((g) => g.rows.length);
}

/** Une las líneas de un párrafo (deshaciendo guiones de corte) y separa párrafos por huecos. */
function joinParagraphs(lines: Line[]): string {
  const paras: string[] = [];
  for (const l of lines) {
    const t = text(l);
    if (l.gapBefore || !paras.length) paras.push(t);
    else {
      const prev = paras[paras.length - 1];
      paras[paras.length - 1] = /\p{L}-$/u.test(prev) && /^\p{Ll}/u.test(t) ? prev.slice(0, -1) + t : `${prev} ${t}`;
    }
  }
  return paras.join('\n');
}

/** Parte una sección en entradas: cada bloque separado por un hueco (o por una fecha nueva) es una. */
function toEntries(lines: Line[], L: (s: string) => LText): Entry[] {
  const blocks: Line[][] = [];
  let hasDate = false;
  for (const l of lines) {
    const date = !!findDate(text(l));
    const cur = blocks[blocks.length - 1];
    if (!cur || l.gapBefore || (date && hasDate && cur.length > 1)) {
      blocks.push([l]);
      hasDate = date;
    } else {
      cur.push(l);
      hasDate ||= date;
    }
  }

  const entries: Entry[] = [];
  for (const block of blocks) {
    const rows = block.map((l) => ({ parts: [...l.parts], font: l.font, size: l.size }));
    let date: DateHit | null = null;
    // La fecha suele ir en las primeras filas: se quita de ahí
    for (const row of rows.slice(0, 3)) {
      for (let j = 0; j < row.parts.length && !date; j++) {
        const hit = findDate(row.parts[j]);
        if (hit) {
          date = hit;
          row.parts[j] = cleanEdges(row.parts[j].replace(hit.match, '').replace(/\(\s*\)/, ''));
        }
      }
      if (date) break;
    }
    const content = rows.map((r) => ({ ...r, t: r.parts.filter(Boolean).join(' · ') })).filter((r) => r.t);
    if (!content.length) continue;

    // Una línea suelta sin fecha suele ser continuación de la entrada anterior
    if (!date && content.length === 1 && entries.length) {
      const prev = entries[entries.length - 1];
      const key = Object.keys(prev.title)[0];
      prev.description[key] = [prev.description[key], content[0].t.replace(BULLET_RE, '')].filter(Boolean).join('\n');
      continue;
    }

    // Título partido en dos líneas: misma letra y la frase sigue («…Industrial y» / «Desarrollo…»)
    let titleRows = 1;
    while (
      titleRows < Math.min(content.length, 3) &&
      content[0].font &&
      content[titleRows].font === content[0].font &&
      content[titleRows].size === content[0].size &&
      (/(\b(y|e|de|del|en|para|and|of|for|in)|[&,-])$/i.test(content[titleRows - 1].t) || /^\p{Ll}/u.test(content[titleRows].t))
    )
      titleRows++;
    const title = content.slice(0, titleRows).map((r) => r.t).join(' ');
    const rest = content.slice(titleRows).map((r) => r.t);
    const subtitle = rest.length && !BULLET_RE.test(rest[0]) && rest[0].length <= 80 ? rest.shift()! : '';
    entries.push({
      id: uid(),
      title: L(title.replace(BULLET_RE, '')),
      subtitle: L(subtitle),
      start: date?.start ?? '',
      end: date?.end ?? '',
      current: date?.current ?? false,
      description: L(joinBullets(rest)),
    });
  }
  return entries;
}

/** Con viñetas, cada viñeta es un punto y las líneas sin viñeta continúan el anterior. */
function joinBullets(lines: string[]): string {
  const bulleted = lines.some((l) => BULLET_RE.test(l));
  const out: string[] = [];
  for (const l of lines) {
    const clean = l.replace(BULLET_RE, '');
    const continues = out.length && (bulleted ? !BULLET_RE.test(l) : /^\p{Ll}/u.test(clean) && !/[.:]$/.test(out[out.length - 1]));
    if (continues) out[out.length - 1] += ` ${clean}`;
    else out.push(clean);
  }
  return out.join('\n');
}
