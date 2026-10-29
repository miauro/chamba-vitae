/** Texto traducible: { es: '...', en: '...' }. Si falta un idioma se usa el de otro. */
export type LText = Record<string, string>;

export interface Contact {
  id: string;
  label: LText;
  /** Normalmente igual en todos los idiomas (email, teléfono); traducible por si acaso. */
  value: LText;
  /** Enlace opcional. Emails, teléfonos y URLs se enlazan solos. */
  href?: string;
}

export interface Profile {
  name: string;
  title: LText;
  /** Data URL de la foto (se redimensiona al subirla). */
  photo?: string;
  contacts: Contact[];
}

export interface Entry {
  id: string;
  title: LText;
  subtitle: LText;
  /** 'AAAA' o 'AAAA-MM' */
  start?: string;
  end?: string;
  current?: boolean;
  /** Una línea por punto (se pinta con →). Admite **negrita**. */
  description: LText;
}

export interface Pair {
  id: string;
  label: LText;
  value: LText;
}

export interface SkillRow {
  id: string;
  label: LText;
  /** Un elemento por línea. */
  items: LText;
}

export interface SkillGroup {
  id: string;
  label: LText;
  rows: SkillRow[];
}

interface SectionBase {
  id: string;
  title: LText;
}

export interface TextSection extends SectionBase {
  kind: 'text';
  body: LText;
}

export interface EntriesSection extends SectionBase {
  kind: 'entries';
  items: Entry[];
}

export interface PairsSection extends SectionBase {
  kind: 'pairs';
  items: Pair[];
}

export interface SkillsSection extends SectionBase {
  kind: 'skills';
  groups: SkillGroup[];
}

export type Section = TextSection | EntriesSection | PairsSection | SkillsSection;
export type SectionKind = Section['kind'];

export interface Variant {
  id: string;
  name: string;
  /** Ids de secciones/elementos ocultos en esta variante. */
  hidden: string[];
  /** Cargo propio de la variante (sustituye al del perfil). */
  title?: LText;
}

export interface Settings {
  font: string;
  nameSize: number;
  textColor: string;
  mutedColor: string;
  ruleColor: string;
  showPhoto: boolean;
  grayscalePhoto: boolean;
}

export interface CV {
  schema: 1;
  /** El primero es el idioma de respaldo. */
  languages: string[];
  profile: Profile;
  sections: Section[];
  variants: Variant[];
  settings: Settings;
}
