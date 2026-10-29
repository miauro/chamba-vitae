import { useRef, useState } from 'react';
import { useEd } from '../context';
import type { UIKey } from '../i18n';
import {
  entryTexts,
  newContact,
  newEntry,
  newPair,
  newSection,
  newSkillGroup,
  newSkillRow,
  profileTexts,
  reId,
  sectionTexts,
} from '../model';
import type {
  Contact,
  Entry,
  EntriesSection,
  PairsSection,
  Section,
  SectionKind,
  SkillGroup,
  SkillsSection,
  TextSection,
} from '../types';
import { countMissing, formatRange, getText, resizeImage, sortEntriesByDate } from '../utils';
import { DateField, EyeButton, LField, MissingBadge, TextField, Toggle } from './fields';
import type { Icon } from '@phosphor-icons/react';
import {
  IconCamera,
  IconChevron,
  IconCopy,
  IconKindEntries,
  IconKindPairs,
  IconKindSkills,
  IconKindText,
  IconLink,
  IconPlus,
  IconSort,
  IconTrash,
  IconUser,
} from './icons';
import { DragHandle, SortableList, move, type HandleProps } from './Sortable';

const KINDS: SectionKind[] = ['text', 'entries', 'pairs', 'skills'];

const KIND_ICON: Record<SectionKind, Icon> = {
  text: IconKindText,
  entries: IconKindEntries,
  pairs: IconKindPairs,
  skills: IconKindSkills,
};

function DeleteButton({ onClick, title }: { onClick: () => void; title?: string }) {
  const { t } = useEd();
  return (
    <button type="button" className="icon-btn danger act" title={title ?? t('delete')} onClick={onClick}>
      <IconTrash />
    </button>
  );
}

function useSectionUpd<S extends Section>(id: string) {
  const { update } = useEd();
  return (fn: (s: S) => void) =>
    update((d) => {
      const s = d.sections.find((x) => x.id === id);
      if (s) fn(s as S);
    });
}

/* ---------- Perfil ---------- */

export function ProfileEditor() {
  const { cv, lang, update, t, variant } = useEd();
  const p = cv.profile;
  const fileRef = useRef<HTMLInputElement>(null);
  const hidden = new Set(variant.hidden);

  const onPhoto = async (file?: File) => {
    if (!file) return;
    try {
      const url = await resizeImage(file);
      update((d) => {
        d.profile.photo = url;
      });
    } catch {
      /* imagen ilegible: no hacemos nada */
    }
  };

  const updContact = (id: string, fn: (c: (typeof p.contacts)[number]) => void) =>
    update((d) => {
      const c = d.profile.contacts.find((x) => x.id === id);
      if (c) fn(c);
    });

  return (
    <div className="card">
      <div className="card-head static">
        <IconUser size={18} className="head-icon" />
        <h2>{t('profile')}</h2>
        <MissingBadge count={countMissing(profileTexts(cv), lang, cv.languages)} />
      </div>
      <div className="card-body">
        <TextField
          label={t('name')}
          value={p.name}
          multiline
          rows={2}
          onChange={(v) =>
            update((d) => {
              d.profile.name = v;
            })
          }
        />
        <LField
          label={t('title')}
          multiline
          rows={3}
          value={p.title}
          hint={variant.title ? t('variantTitleActive') : t('titleHint')}
          onChange={(v, l) =>
            update((d) => {
              d.profile.title[l] = v;
            })
          }
        />

        <div className="field">
          <span className="field-label">{t('photo')}</span>
          <div className="photo-row">
            {p.photo ? (
              <>
                <img src={p.photo} alt="" className="photo-thumb" />
                <div className="photo-actions">
                  <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()}>
                    <IconCamera />
                    {t('changePhoto')}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost danger"
                    onClick={() =>
                      update((d) => {
                        delete d.profile.photo;
                      })
                    }
                  >
                    <IconTrash />
                    {t('removePhoto')}
                  </button>
                </div>
              </>
            ) : (
              <button type="button" className="photo-drop" onClick={() => fileRef.current?.click()}>
                <IconCamera size={22} />
                <span>
                  <b>{t('uploadPhoto')}</b>
                  <small>{t('photoHint')}</small>
                </span>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                onPhoto(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        <div className="field">
          <span className="field-label">{t('contacts')}</span>
          <SortableList
            items={p.contacts}
            className="stack-sm"
            onMove={(a, b) => update((d) => move(d.profile.contacts, a, b))}
            render={(c, handle) => (
              <ContactRow
                contact={c}
                handle={handle}
                hidden={hidden.has(c.id)}
                upd={(fn) => updContact(c.id, fn)}
                onDelete={() =>
                  update((d) => {
                    d.profile.contacts = d.profile.contacts.filter((x) => x.id !== c.id);
                  })
                }
              />
            )}
          />
          <div>
            <button
              type="button"
              className="btn-ghost"
              onClick={() =>
                update((d) => {
                  d.profile.contacts.push(newContact());
                })
              }
            >
              <IconPlus />
              {t('addContact')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContactRow({
  contact: c,
  handle,
  hidden,
  upd,
  onDelete,
}: {
  contact: Contact;
  handle: HandleProps;
  hidden: boolean;
  upd: (fn: (c: Contact) => void) => void;
  onDelete: () => void;
}) {
  const { t } = useEd();
  const [linkOpen, setLinkOpen] = useState(!!c.href);
  return (
    <div className={`inline-row${hidden ? ' is-hidden' : ''}`}>
      <DragHandle {...handle} />
      <div className="contact-fields">
        <LField value={c.label} placeholder={t('contactLabel')} onChange={(v, l) => upd((x) => (x.label[l] = v))} />
        <LField optional value={c.value} placeholder={t('contactValue')} onChange={(v, l) => upd((x) => (x.value[l] = v))} />
        {linkOpen && (
          <TextField value={c.href ?? ''} placeholder={t('contactLink')} onChange={(v) => upd((x) => (x.href = v || undefined))} />
        )}
      </div>
      <button
        type="button"
        className={`icon-btn${c.href ? '' : ' act'}${linkOpen ? ' is-on' : ''}`}
        title={t('contactLink')}
        aria-pressed={linkOpen}
        onClick={() => setLinkOpen(!linkOpen)}
      >
        <IconLink />
      </button>
      <EyeButton id={c.id} />
      <DeleteButton onClick={onDelete} />
    </div>
  );
}

/* ---------- Secciones ---------- */

export function SectionsEditor() {
  const { cv, update, t } = useEd();
  const [openId, setOpenId] = useState<string | null>(null);

  const add = (kind: SectionKind) => {
    const s = newSection(kind);
    update((d) => {
      d.sections.push(s);
    });
    setOpenId(s.id);
  };

  return (
    <div className="stack" data-tour="sections">
      <h2 className="pane-title">{t('sections')}</h2>
      <SortableList
        items={cv.sections}
        className="stack"
        onMove={(a, b) => update((d) => move(d.sections, a, b))}
        render={(s, handle) => (
          <SectionCard
            section={s}
            handle={handle}
            open={openId === s.id}
            onToggle={() => setOpenId(openId === s.id ? null : s.id)}
            onDuplicated={setOpenId}
          />
        )}
      />
      <h2 className="pane-title">{t('addSection')}</h2>
      <div className="kind-grid">
        {KINDS.map((k) => {
          const KindIcon = KIND_ICON[k];
          return (
            <button key={k} type="button" className="kind-btn" onClick={() => add(k)}>
              <span className={`kind-icon k-${k}`}>
                <KindIcon size={18} />
              </span>
              <span>
                <b>{t(`kind_${k}` as UIKey)}</b>
                <small>{t(`kindDesc_${k}` as UIKey)}</small>
              </span>
              <IconPlus className="kind-plus" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SectionCard({
  section: s,
  handle,
  open,
  onToggle,
  onDuplicated,
}: {
  section: Section;
  handle: HandleProps;
  open: boolean;
  onToggle: () => void;
  onDuplicated: (id: string) => void;
}) {
  const { cv, lang, variant, update, t } = useEd();
  const upd = useSectionUpd<Section>(s.id);
  const kindLabel = t(`kind_${s.kind}` as UIKey);
  const KindIcon = KIND_ICON[s.kind];
  const title = getText(s.title, lang, cv.languages) || kindLabel;

  const duplicate = () => {
    const copy = reId(s);
    update((d) => {
      const i = d.sections.findIndex((x) => x.id === s.id);
      d.sections.splice(i + 1, 0, copy);
    });
    onDuplicated(copy.id);
  };

  return (
    <div className={`card${variant.hidden.includes(s.id) ? ' is-hidden' : ''}`}>
      <div className="card-head">
        <DragHandle {...handle} />
        <button type="button" className="card-title" onClick={onToggle} aria-expanded={open}>
          <IconChevron className={`chev${open ? ' rot' : ''}`} />
          <span className={`kind-icon k-${s.kind}`} title={kindLabel}>
            <KindIcon />
          </span>
          <span>{title}</span>
          <MissingBadge count={countMissing(sectionTexts(s), lang, cv.languages)} />
        </button>
        <EyeButton id={s.id} />
        <button type="button" className="icon-btn act" title={t('duplicate')} onClick={duplicate}>
          <IconCopy />
        </button>
        <DeleteButton
          onClick={() => {
            if (confirm(t('confirmDelete')))
              update((d) => {
                d.sections = d.sections.filter((x) => x.id !== s.id);
              });
          }}
        />
      </div>
      {open && (
        <div className="card-body">
          <LField label={t('sectionTitle')} value={s.title} onChange={(v, l) => upd((x) => (x.title[l] = v))} />
          {s.kind === 'text' && <TextBody s={s} />}
          {s.kind === 'entries' && <EntriesBody s={s} />}
          {s.kind === 'pairs' && <PairsBody s={s} />}
          {s.kind === 'skills' && <SkillsBody s={s} />}
        </div>
      )}
    </div>
  );
}

function TextBody({ s }: { s: TextSection }) {
  const { t } = useEd();
  const upd = useSectionUpd<TextSection>(s.id);
  return (
    <LField
      label={t('body')}
      multiline
      rows={7}
      value={s.body}
      hint={t('boldHint')}
      onChange={(v, l) => upd((x) => (x.body[l] = v))}
    />
  );
}

function EntriesBody({ s }: { s: EntriesSection }) {
  const { cv, lang, variant, t } = useEd();
  const upd = useSectionUpd<EntriesSection>(s.id);
  const [openId, setOpenId] = useState<string | null>(null);
  const updItem = (id: string, fn: (e: Entry) => void) =>
    upd((x) => {
      const e = x.items.find((i) => i.id === id);
      if (e) fn(e);
    });

  return (
    <>
      <SortableList
        items={s.items}
        className="stack-sm"
        onMove={(a, b) => upd((x) => move(x.items, a, b))}
        render={(e, handle) => {
          const open = openId === e.id;
          return (
            <div className={`sub-card${variant.hidden.includes(e.id) ? ' is-hidden' : ''}`}>
              <div className="sub-head">
                <DragHandle {...handle} />
                <button type="button" className="card-title sub" onClick={() => setOpenId(open ? null : e.id)} aria-expanded={open}>
                  <IconChevron className={`chev${open ? ' rot' : ''}`} />
                  <span>{getText(e.title, lang, cv.languages) || t('untitled')}</span>
                  <MissingBadge count={countMissing(entryTexts(e), lang, cv.languages)} />
                  <small>{formatRange(e, lang)}</small>
                </button>
                <EyeButton id={e.id} />
                <DeleteButton onClick={() => upd((x) => (x.items = x.items.filter((i) => i.id !== e.id)))} />
              </div>
              {open && (
                <div className="sub-body">
                  <LField label={t('entryTitle')} value={e.title} onChange={(v, l) => updItem(e.id, (x) => (x.title[l] = v))} />
                  <LField label={t('subtitle')} value={e.subtitle} onChange={(v, l) => updItem(e.id, (x) => (x.subtitle[l] = v))} />
                  <div className="grid-2">
                    <DateField label={t('start')} value={e.start} onChange={(v) => updItem(e.id, (x) => (x.start = v))} />
                    <DateField label={t('end')} value={e.end} disabled={e.current} onChange={(v) => updItem(e.id, (x) => (x.end = v))} />
                  </div>
                  <Toggle label={t('current')} checked={!!e.current} onChange={(v) => updItem(e.id, (x) => (x.current = v))} />
                  <LField
                    label={t('description')}
                    multiline
                    rows={3}
                    value={e.description}
                    hint={t('descriptionHint')}
                    onChange={(v, l) => updItem(e.id, (x) => (x.description[l] = v))}
                  />
                </div>
              )}
            </div>
          );
        }}
      />
      <div className="row-actions">
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            const e = newEntry();
            upd((x) => {
              x.items.push(e);
            });
            setOpenId(e.id);
          }}
        >
          <IconPlus />
          {t('addEntry')}
        </button>
        {s.items.length > 1 && (
          <button type="button" className="btn-ghost" onClick={() => upd((x) => (x.items = sortEntriesByDate(x.items)))}>
            <IconSort />
            {t('sortByDate')}
          </button>
        )}
      </div>
    </>
  );
}

function PairsBody({ s }: { s: PairsSection }) {
  const { variant, t } = useEd();
  const upd = useSectionUpd<PairsSection>(s.id);
  const updItem = (id: string, fn: (p: PairsSection['items'][number]) => void) =>
    upd((x) => {
      const p = x.items.find((i) => i.id === id);
      if (p) fn(p);
    });

  return (
    <>
      <SortableList
        items={s.items}
        className="stack-sm"
        onMove={(a, b) => upd((x) => move(x.items, a, b))}
        render={(p, handle) => (
          <div className={`inline-row${variant.hidden.includes(p.id) ? ' is-hidden' : ''}`}>
            <DragHandle {...handle} />
            <LField value={p.label} placeholder={t('itemLabel')} onChange={(v, l) => updItem(p.id, (x) => (x.label[l] = v))} />
            <LField value={p.value} placeholder={t('itemValue')} onChange={(v, l) => updItem(p.id, (x) => (x.value[l] = v))} />
            <EyeButton id={p.id} />
            <DeleteButton onClick={() => upd((x) => (x.items = x.items.filter((i) => i.id !== p.id)))} />
          </div>
        )}
      />
      <div className="row-actions">
        <button type="button" className="btn-ghost" onClick={() => upd((x) => void x.items.push(newPair()))}>
          <IconPlus />
          {t('addItem')}
        </button>
      </div>
    </>
  );
}

function SkillsBody({ s }: { s: SkillsSection }) {
  const { variant, t } = useEd();
  const upd = useSectionUpd<SkillsSection>(s.id);
  const updGroup = (id: string, fn: (g: SkillGroup) => void) =>
    upd((x) => {
      const g = x.groups.find((i) => i.id === id);
      if (g) fn(g);
    });

  return (
    <>
      <SortableList
        items={s.groups}
        className="stack-sm"
        onMove={(a, b) => upd((x) => move(x.groups, a, b))}
        render={(g, handle) => (
          <div className={`sub-card${variant.hidden.includes(g.id) ? ' is-hidden' : ''}`}>
            <div className="sub-head">
              <DragHandle {...handle} />
              <LField value={g.label} placeholder={t('groupLabel')} onChange={(v, l) => updGroup(g.id, (x) => (x.label[l] = v))} />
              <EyeButton id={g.id} />
              <DeleteButton onClick={() => upd((x) => (x.groups = x.groups.filter((i) => i.id !== g.id)))} />
            </div>
            <div className="sub-body">
              <SortableList
                items={g.rows}
                className="stack-sm"
                onMove={(a, b) => updGroup(g.id, (x) => move(x.rows, a, b))}
                render={(r, h) => {
                  const updRow = (fn: (row: (typeof g.rows)[number]) => void) =>
                    updGroup(g.id, (x) => {
                      const row = x.rows.find((i) => i.id === r.id);
                      if (row) fn(row);
                    });
                  return (
                    <div className={`inline-row top${variant.hidden.includes(r.id) ? ' is-hidden' : ''}`}>
                      <DragHandle {...h} />
                      <div className="skill-fields">
                        <LField value={r.label} placeholder={t('rowLabel')} onChange={(v, l) => updRow((x) => (x.label[l] = v))} />
                        <LField multiline rows={3} value={r.items} placeholder={t('rowItems')} onChange={(v, l) => updRow((x) => (x.items[l] = v))} />
                      </div>
                      <EyeButton id={r.id} />
                      <DeleteButton onClick={() => updGroup(g.id, (x) => (x.rows = x.rows.filter((i) => i.id !== r.id)))} />
                    </div>
                  );
                }}
              />
              <div>
                <button type="button" className="btn-ghost" onClick={() => updGroup(g.id, (x) => void x.rows.push(newSkillRow()))}>
                  <IconPlus />
                  {t('addRow')}
                </button>
              </div>
            </div>
          </div>
        )}
      />
      <div className="row-actions">
        <button type="button" className="btn-ghost" onClick={() => upd((x) => void x.groups.push(newSkillGroup()))}>
          <IconPlus />
          {t('addGroup')}
        </button>
      </div>
    </>
  );
}
