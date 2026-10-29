import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { HTMLAttributes, ReactNode } from 'react';
import { IconGrip } from './icons';

export type HandleProps = HTMLAttributes<HTMLButtonElement>;

/** Mueve en el sitio (para usar dentro de `update`). */
export function move<T>(arr: T[], from: number, to: number) {
  arr.splice(0, arr.length, ...arrayMove(arr, from, to));
}

interface Props<T> {
  items: T[];
  onMove: (from: number, to: number) => void;
  render: (item: T, handle: HandleProps) => ReactNode;
  className?: string;
}

export function SortableList<T extends { id: string }>({ items, onMove, render, className }: Props<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    if (from >= 0 && to >= 0) onMove(from, to);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {items.map((item) => (
            <SortableRow key={item.id} id={item.id}>
              {(handle) => render(item, handle)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, children }: { id: string; children: (handle: HandleProps) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      className={isDragging ? 'is-dragging' : undefined}
      style={{ transform: CSS.Translate.toString(transform), transition, position: 'relative', zIndex: isDragging ? 10 : undefined }}
    >
      {children({ ...attributes, ...listeners } as HandleProps)}
    </div>
  );
}

export function DragHandle(props: HandleProps) {
  return (
    <button type="button" className="icon-btn handle" aria-label="Drag" {...props}>
      <IconGrip />
    </button>
  );
}
