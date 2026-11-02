import type { CV, LText, Variant } from './types';
import { formatRange, getText, splitLines } from './utils';

/**
 * El CV visible (variante + idioma) como texto plano, en el orden que esperan los
 * formularios de empleo: cabecera, contacto y cada sección con sus entradas.
 */
export function cvToText(cv: CV, variant: Variant, lang: string): string {
  const hidden = new Set(variant.hidden);
  const vis = <T extends { id: string }>(xs: T[]) => xs.filter((x) => !hidden.has(x.id));
  const tx = (l?: LText) => getText(l, lang, cv.languages).replace(/\*\*(.+?)\*\*/g, '$1').trim();
  const oneLine = (s: string) => s.replace(/\s*\n\s*/g, ' ').trim();

  const out: string[] = [oneLine(cv.profile.name)];
  const title = oneLine(tx(variant.title) || tx(cv.profile.title));
  if (title) out.push(title);
  const contacts = vis(cv.profile.contacts)
    .map((c) => [tx(c.label), tx(c.value)].filter(Boolean).join(' '))
    .filter(Boolean);
  if (contacts.length) out.push(contacts.join(' | '));

  for (const s of vis(cv.sections)) {
    const lines: string[] = [];
    if (s.kind === 'text') lines.push(tx(s.body));
    if (s.kind === 'entries')
      for (const e of vis(s.items)) {
        const head = [tx(e.title), tx(e.subtitle)].filter(Boolean).join(' — ');
        const dates = formatRange(e, lang);
        lines.push(dates ? `${head} (${dates})` : head);
        for (const d of splitLines(tx(e.description))) lines.push(`- ${d}`);
        lines.push('');
      }
    if (s.kind === 'pairs') for (const p of vis(s.items)) lines.push([tx(p.label), tx(p.value)].filter(Boolean).join(': '));
    if (s.kind === 'skills')
      for (const g of vis(s.groups))
        for (const r of vis(g.rows)) {
          const label = [tx(g.label), tx(r.label)].filter(Boolean).join(' — ');
          const items = splitLines(tx(r.items)).join(', ');
          lines.push(label ? `${label}: ${items}` : items);
        }
    out.push('', tx(s.title).toUpperCase(), ...lines);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
