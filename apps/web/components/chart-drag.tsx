'use client';

import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Active,
  type Announcements,
  type Collision,
  type CollisionDetection,
  type DragEndEvent,
  type DroppableContainer,
  type Over,
} from '@dnd-kit/core';
import {
  accountsIn,
  groupsIn,
  landedMove,
  type AccountGroupId,
  type AccountType,
  type ChartLanding,
  type ChartNodeOutput,
  type ChartNodeRef,
  type ChartPlace,
  type MoveChartNodeInput,
} from '@repo/contracts';
import { GripIcon } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import { createContext, useContext, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { en } from '../messages/en';
import { aimedAt, measuredHits, measuredOf, type ChartDrop, type ChartDropTarget } from './chart-drop';
import { BARE_ICON_BUTTON } from './control-classes';
import { useHydrated } from './hydrated';

type NodeData = {
  readonly node: ChartNodeRef;
  readonly place: ChartPlace;
};

type TargetData = {
  readonly target: ChartDropTarget;
};

type Holder = { readonly data: { readonly current?: unknown } };

const nodeData = (holder: Holder): NodeData | undefined => {
  const data = holder.data.current as Partial<NodeData> | undefined;
  return data?.node === undefined ? undefined : (data as NodeData);
};

const targetOf = (holder: Holder): ChartDropTarget | undefined =>
  (holder.data.current as Partial<TargetData> | undefined)?.target;

const typeOf = (target: ChartDropTarget): AccountType =>
  target.on === 'heading' ? target.accountType : target.place.accountType;

const topLevel = (target: ChartDropTarget): boolean =>
  target.on !== 'heading' && target.place.groupId === null;

const samePlace = (first: ChartPlace, second: ChartPlace): boolean =>
  first.accountType === second.accountType && first.groupId === second.groupId;

type Keep = (target: ChartDropTarget) => boolean;

const firstHit = (
  args: Parameters<CollisionDetection>[0],
  detect: CollisionDetection,
  keep: Keep,
): Collision[] =>
  detect({
    ...args,
    droppableContainers: args.droppableContainers.filter((container: DroppableContainer) => {
      const target = targetOf(container);
      return target !== undefined && keep(target);
    }),
  });

const accountRowOrHeading: Keep = (target) =>
  target.on === 'heading' || (target.on === 'row' && target.node.kind === 'account');

const notGroupRow: Keep = (target) => target.on !== 'row' || target.node.kind === 'account';

const collide: CollisionDetection = (args) => {
  const moving = nodeData(args.active);
  if (moving === undefined) {
    return [];
  }
  const ofType = (keep: Keep): Keep => (target) =>
    typeOf(target) === moving.place.accountType && keep(target);

  const searches: readonly [CollisionDetection, Keep][] =
    moving.node.kind === 'group'
      ? [
          [pointerWithin, ofType(topLevel)],
          [closestCenter, ofType(topLevel)],
        ]
      : [
          [pointerWithin, ofType(accountRowOrHeading)],
          [pointerWithin, ofType((target) => target.on === 'end')],
          [closestCenter, ofType(notGroupRow)],
        ];
  for (const [detect, keep] of searches) {
    const hit = firstHit(args, detect, keep);
    if (hit.length > 0) {
      return measuredHits(hit, args.pointerCoordinates, args.droppableRects);
    }
  }
  return [];
};

type DragState = {
  readonly over: Over | null;
  readonly collisions: Collision[] | null;
};

const dropOf = ({ over, collisions }: DragState): ChartDrop | undefined => {
  const target = over === null ? undefined : targetOf(over);
  const hit = collisions?.find((collision) => collision.id === over?.id);
  const measured = measuredOf(hit);
  return target === undefined || measured === undefined ? undefined : { target, ...measured };
};

const { drag } = en.accountsSection;

type RowText = { readonly name: string; readonly description: string | null };

const rowsIn = (chart: readonly ChartNodeOutput[]): ReadonlyMap<string, RowText> =>
  new Map([...groupsIn(chart), ...accountsIn(chart)].map((node) => [node.id, node]));

const ChartRows = createContext<ReadonlyMap<string, RowText>>(new Map());

function placeText({ place, before }: ChartLanding, rows: ReadonlyMap<string, RowText>): string {
  const named = (id: string): string => rows.get(id)?.name ?? '';
  const beforeText = before === null ? undefined : `${drag.before} ${named(before)}`;
  if (place.groupId !== null) {
    const into = `${drag.into} ${named(place.groupId)}`;
    return beforeText === undefined ? into : `${into}, ${beforeText}`;
  }
  return beforeText ?? `${drag.lastIn} ${en.accountTypes[place.accountType]}`;
}

type Landed = {
  readonly node: ChartNodeRef | undefined;
  readonly landing: ChartLanding | undefined;
  readonly move: MoveChartNodeInput | undefined;
  readonly over: boolean;
};

const UNLANDED: Landed = { node: undefined, landing: undefined, move: undefined, over: false };

const ShownLanding = createContext<ChartLanding | undefined>(undefined);

const ListIds = createContext<readonly string[]>([]);

const Held = createContext(false);

const LINE = 'before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:-translate-y-1/2 before:rounded before:bg-accent';

const LINE_AT_END = 'after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded after:bg-accent';

const GROUP_HIGHLIGHT = 'rounded bg-accent/15 ring-1 ring-inset ring-accent';

const keyOf = ({ landing, over }: Landed): string =>
  landing === undefined
    ? String(over)
    : `${landing.place.accountType} ${String(landing.place.groupId)} ${String(landing.before)}`;

function Overlay({ moving, rows }: { readonly moving: NodeData | undefined; readonly rows: ReadonlyMap<string, RowText> }): ReactNode {
  const row = moving === undefined ? undefined : rows.get(moving.node.id);
  return (
    <DragOverlay dropAnimation={null}>
      {moving === undefined || row === undefined ? null : (
        <div
          className={`flex items-center gap-2 rounded border border-accent bg-surface px-2 py-1.5 ${typeClasses['body-sm']}`}
        >
          <span className={`${BARE_ICON_BUTTON} shrink-0 cursor-grabbing`}>
            <GripIcon />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className={moving.node.kind === 'group' ? 'font-semibold' : undefined}>{row.name}</span>
            {row.description === null ? null : (
              <span className={`${typeClasses['body-dense']} text-text-muted`}>{row.description}</span>
            )}
          </span>
        </div>
      )}
    </DragOverlay>
  );
}

export function ChartDrag({
  chart,
  held,
  onMove,
  children,
}: {
  readonly chart: readonly ChartNodeOutput[];
  readonly held: boolean;
  readonly onMove: (move: MoveChartNodeInput) => void;
  readonly children: ReactNode;
}): ReactNode {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const hydrated = useHydrated();
  const [moving, setMoving] = useState<NodeData>();
  const [landing, setLanding] = useState<ChartLanding>();
  const landed = useRef<Landed>(UNLANDED);
  const announced = useRef<string>(undefined);
  const rows = rowsIn(chart);

  const nameOf = (active: Active): string => rows.get(String(active.id))?.name ?? '';

  const follow = (state: DragState & { readonly active: Active }): void => {
    const node = nodeData(state.active)?.node;
    const drop = dropOf(state);
    const aimed = drop === undefined ? undefined : aimedAt(drop);
    const move = node === undefined || aimed === undefined ? undefined : landedMove(chart, node, aimed);
    const next: Landed = { node, landing: move === undefined ? undefined : aimed, move, over: drop !== undefined };
    const changed = keyOf(next) !== keyOf(landed.current);
    landed.current = next;
    if (changed) {
      setLanding(next.landing);
    }
  };

  const whereNow = (active: Active): string => {
    const { landing: now, over } = landed.current;
    if (now !== undefined) {
      return `${nameOf(active)} ${drag.wouldGo} ${placeText(now, rows)}`;
    }
    return `${nameOf(active)} ${over ? drag.stays : drag.overNothing}`;
  };

  const announceChange = (active: Active): string | undefined => {
    const key = keyOf(landed.current);
    if (key === announced.current) {
      return undefined;
    }
    announced.current = key;
    return whereNow(active);
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => `${drag.pickedUp} ${nameOf(active)}`,
    onDragMove: ({ active }) => announceChange(active),
    onDragOver: ({ active }) => announceChange(active),
    onDragEnd: ({ active }) => {
      const { landing: now } = landed.current;
      return now === undefined
        ? `${nameOf(active)} ${drag.putBack}`
        : `${nameOf(active)} ${drag.went} ${placeText(now, rows)}`;
    },
    onDragCancel: ({ active }) => `${nameOf(active)} ${drag.putBack}`,
  };

  const stop = (): void => {
    setMoving(undefined);
    setLanding(undefined);
  };

  const overlay = <Overlay moving={moving} rows={rows} />;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collide}
      accessibility={{ announcements, screenReaderInstructions: { draggable: drag.instructions } }}
      onDragStart={({ active }) => {
        landed.current = UNLANDED;
        announced.current = undefined;
        setMoving(nodeData(active));
      }}
      onDragMove={follow}
      onDragOver={follow}
      onDragCancel={() => {
        landed.current = UNLANDED;
        stop();
      }}
      onDragEnd={(event: DragEndEvent) => {
        follow(event);
        stop();
        const { move } = landed.current;
        if (move !== undefined) {
          onMove(move);
        }
      }}
    >
      <ChartRows.Provider value={rows}>
        <ShownLanding.Provider value={landing}>
          <Held.Provider value={held}>{children}</Held.Provider>
        </ShownLanding.Provider>
      </ChartRows.Provider>
      {hydrated ? createPortal(overlay, document.body) : null}
    </DndContext>
  );
}

const useLanding = (): ChartLanding | undefined => useContext(ShownLanding);

const landsAtEndOf = (landing: ChartLanding | undefined, place: ChartPlace): boolean =>
  landing !== undefined && landing.before === null && samePlace(landing.place, place);

export function ChartList({
  place,
  ids,
  className,
  children,
}: {
  readonly place: ChartPlace;
  readonly ids: readonly string[];
  readonly className: string;
  readonly children: ReactNode;
}): ReactNode {
  const { setNodeRef } = useDroppable({
    id: useId(),
    data: { target: { on: 'end', place } } satisfies TargetData,
    disabled: place.groupId === null,
  });
  const lineAtEnd = landsAtEndOf(useLanding(), place) && place.groupId !== null;

  return (
    <ListIds.Provider value={ids}>
      <ul ref={setNodeRef} className={`relative ${className} ${lineAtEnd ? LINE_AT_END : ''}`}>
        {children}
      </ul>
    </ListIds.Provider>
  );
}

export function EndZone({ accountType }: { readonly accountType: AccountType }): ReactNode {
  const place: ChartPlace = { accountType, groupId: null };
  const { setNodeRef } = useDroppable({
    id: useId(),
    data: { target: { on: 'end', place } } satisfies TargetData,
  });
  const line = landsAtEndOf(useLanding(), place);

  return <div ref={setNodeRef} className={`relative mx-2 h-6 ${line ? LINE : ''}`} />;
}

export function GroupHeading({
  accountType,
  groupId,
  children,
}: {
  readonly accountType: AccountType;
  readonly groupId: AccountGroupId;
  readonly children: ReactNode;
}): ReactNode {
  const { setNodeRef } = useDroppable({
    id: useId(),
    data: { target: { on: 'heading', accountType, groupId } } satisfies TargetData,
  });

  return (
    <div ref={setNodeRef} className="flex items-center gap-2 py-1.5">
      {children}
    </div>
  );
}

export function ChartRow({
  node,
  place,
  className = '',
  children,
}: {
  readonly node: ChartNodeRef;
  readonly place: ChartPlace;
  readonly className?: string;
  readonly children: (grip: ReactNode) => ReactNode;
}): ReactNode {
  const ids = useContext(ListIds);
  const name = useContext(ChartRows).get(node.id)?.name ?? '';
  const next = ids[ids.indexOf(node.id) + 1] ?? null;
  const held = useContext(Held);
  const { setNodeRef, setActivatorNodeRef, listeners, isDragging } = useDraggable({
    id: node.id,
    data: { node, place } satisfies NodeData,
    disabled: held,
  });
  const { setNodeRef: setDropRef } = useDroppable({
    id: node.id,
    data: { target: { on: 'row', place, node, next } } satisfies TargetData,
  });
  const landing = useLanding();
  const lineBefore = landing?.before === node.id && samePlace(landing.place, place);
  const highlighted = node.kind === 'group' && landing?.place.groupId === node.id;

  return (
    <li
      ref={(element) => {
        setNodeRef(element);
        setDropRef(element);
      }}
      className={[
        'relative',
        className,
        isDragging ? 'opacity-50' : '',
        lineBefore ? LINE : '',
        highlighted ? GROUP_HIGHLIGHT : '',
      ].join(' ')}
    >
      {children(
        <button
          ref={setActivatorNodeRef}
          type="button"
          tabIndex={-1}
          disabled={held}
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
