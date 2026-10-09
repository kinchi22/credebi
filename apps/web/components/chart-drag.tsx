'use client';

import {
  closestCenter,
  DndContext,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type Active,
  type Announcements,
  type ClientRect,
  type CollisionDetection,
  type DragEndEvent,
  type DroppableContainer,
  type Over,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  moveBefore,
  type ChartNodeOutput,
  type ChartNodeRef,
  type ChartPlace,
  type MoveChartNodeInput,
} from '@repo/contracts';
import { GripIcon } from '@repo/ui';
import { useId, type CSSProperties, type ReactNode } from 'react';
import { en } from '../messages/en';
import { BARE_ICON_BUTTON } from './control-classes';

type NodeData = {
  readonly node: ChartNodeRef;
  readonly place: ChartPlace;
  readonly name: string;
};

type ZoneData = {
  readonly zone: ChartPlace;
  readonly name: string;
};

type SortableData = NodeData & {
  readonly sortable: {
    readonly index: number;
    readonly items: readonly string[];
  };
};

type Holder = { readonly data: { readonly current?: unknown } };

const nodeData = (holder: Holder): NodeData | undefined => {
  const data = holder.data.current as Partial<NodeData> | undefined;
  return data?.node === undefined ? undefined : (data as NodeData);
};

const zoneData = (holder: Holder): ZoneData | undefined => {
  const data = holder.data.current as Partial<ZoneData> | undefined;
  return data?.zone === undefined ? undefined : (data as ZoneData);
};

const placeOf = (container: DroppableContainer): ChartPlace | undefined =>
  nodeData(container)?.place ?? zoneData(container)?.zone;

const samePlace = (first: ChartPlace, second: ChartPlace): boolean =>
  first.accountType === second.accountType && first.groupId === second.groupId;

const firstHit = (
  args: Parameters<CollisionDetection>[0],
  detect: CollisionDetection,
  keep: (container: DroppableContainer) => boolean,
) => detect({ ...args, droppableContainers: args.droppableContainers.filter(keep) });

const collide: CollisionDetection = (args) => {
  const moving = nodeData(args.active);
  if (moving === undefined) {
    return [];
  }
  const ofType = (container: DroppableContainer): boolean =>
    placeOf(container)?.accountType === moving.place.accountType;
  const topLevel = (container: DroppableContainer): boolean =>
    ofType(container) && nodeData(container)?.place.groupId === null;

  if (moving.node.kind === 'group') {
    const hit = firstHit(args, pointerWithin, topLevel);
    return hit.length > 0 ? hit : firstHit(args, closestCenter, topLevel);
  }

  const searches: readonly [CollisionDetection, (container: DroppableContainer) => boolean][] = [
    [pointerWithin, (container) => ofType(container) && nodeData(container)?.node.kind === 'account'],
    [pointerWithin, (container) => ofType(container) && zoneData(container) !== undefined],
    [pointerWithin, topLevel],
    [closestCenter, topLevel],
  ];
  for (const [detect, keep] of searches) {
    const hit = firstHit(args, detect, keep);
    if (hit.length > 0) {
      return hit;
    }
  }
  return [];
};

const middle = (rect: ClientRect): number => rect.top + rect.height / 2;

function droppedBefore({ active, over }: DragEndEvent): {
  readonly place: ChartPlace;
  readonly before: string | null;
} | undefined {
  const moving = active.data.current as SortableData | undefined;
  if (over === null || moving === undefined) {
    return undefined;
  }

  const zone = zoneData(over);
  if (zone !== undefined) {
    return { place: zone.zone, before: null };
  }

  const target = over.data.current as SortableData | undefined;
  if (target === undefined) {
    return undefined;
  }
  const { items, index } = target.sortable;
  if (samePlace(target.place, moving.place)) {
    if (index === moving.sortable.index) {
      return undefined;
    }
    return { place: target.place, before: arrayMove([...items], moving.sortable.index, index)[index + 1] ?? null };
  }

  const dragged = active.rect.current.translated;
  const below = dragged !== null && middle(dragged) > middle(over.rect);
  return { place: target.place, before: below ? (items[index + 1] ?? null) : (items[index] ?? null) };
}

const nameOf = (holder: Holder): string => nodeData(holder)?.name ?? zoneData(holder)?.name ?? '';

const { drag } = en.accountsSection;

const overNow = (active: Active, over: Over | null): string =>
  over === null
    ? `${nameOf(active)} ${drag.overNothing}`
    : `${nameOf(active)} ${drag.over} ${nameOf(over)}`;

const announcements: Announcements = {
  onDragStart: ({ active }) => `${drag.pickedUp} ${nameOf(active)}`,
  onDragOver: ({ active, over }) => overNow(active, over),
  onDragEnd: ({ active, over }) =>
    over === null
      ? `${nameOf(active)} ${drag.putBack}`
      : `${nameOf(active)} ${drag.dropped} ${nameOf(over)}`,
  onDragCancel: ({ active }) => `${nameOf(active)} ${drag.putBack}`,
};

export function ChartDrag({
  chart,
  onMove,
  children,
}: {
  readonly chart: readonly ChartNodeOutput[];
  readonly onMove: (move: MoveChartNodeInput) => void;
  readonly children: ReactNode;
}): ReactNode {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collide}
      accessibility={{ announcements, screenReaderInstructions: { draggable: drag.instructions } }}
      onDragEnd={(event) => {
        const moving = nodeData(event.active);
        const dropped = droppedBefore(event);
        if (moving === undefined || dropped === undefined) {
          return;
        }
        onMove(moveBefore(chart, moving.node, dropped.place, dropped.before));
      }}
    >
      {children}
    </DndContext>
  );
}

export function SortableList({
  place,
  name,
  ids,
  className,
  children,
}: {
  readonly place: ChartPlace;
  readonly name: string;
  readonly ids: readonly string[];
  readonly className: string;
  readonly children: ReactNode;
}): ReactNode {
  const { setNodeRef } = useDroppable({
    id: useId(),
    data: { zone: place, name } satisfies ZoneData,
    disabled: place.groupId === null,
  });

  return (
    <SortableContext items={[...ids]} strategy={verticalListSortingStrategy}>
      <ul ref={setNodeRef} className={className}>
        {children}
      </ul>
    </SortableContext>
  );
}

export function SortableItem({
  node,
  place,
  name,
  className = '',
  children,
}: {
  readonly node: ChartNodeRef;
  readonly place: ChartPlace;
  readonly name: string;
  readonly className?: string;
  readonly children: (grip: ReactNode) => ReactNode;
}): ReactNode {
  const { setNodeRef, setActivatorNodeRef, listeners, transform, transition, isDragging } =
    useSortable({ id: node.id, data: { node, place, name } satisfies NodeData });
  const style: CSSProperties = {
    transform: transform === null ? undefined : `translate3d(${String(transform.x)}px, ${String(transform.y)}px, 0)`,
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`${className} ${isDragging ? 'relative z-10 opacity-70' : ''}`}
    >
      {children(
        <button
          ref={setActivatorNodeRef}
          type="button"
          tabIndex={-1}
          aria-label={`${en.accountsSection.move} ${name}`}
          className={`${BARE_ICON_BUTTON} shrink-0 cursor-grab touch-none active:cursor-grabbing`}
          {...listeners}
        >
          <GripIcon />
        </button>,
      )}
    </li>
  );
}
