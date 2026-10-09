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
  type CollisionDetection,
  type DragEndEvent,
  type DroppableContainer,
  type Over,
} from '@dnd-kit/core';
import {
  droppedMove,
  landingOf,
  type AccountGroupId,
  type AccountType,
  type ChartDrop,
  type ChartDropTarget,
  type ChartLanding,
  type ChartNodeOutput,
  type ChartNodeRef,
  type ChartPlace,
  type MoveChartNodeInput,
} from '@repo/contracts';
import { GripIcon } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import {
  createContext,
  useContext,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { en } from '../messages/en';
import { BARE_ICON_BUTTON } from './control-classes';

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
) =>
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
      return hit;
    }
  }
  return [];
};

type DragState = {
  readonly active: Active;
  readonly over: Over | null;
  readonly activatorEvent: Event;
  readonly delta: { readonly y: number };
};

const dropOf = ({ over, activatorEvent, delta }: DragState): ChartDrop | undefined => {
  const target = over === null ? undefined : targetOf(over);
  if (over === null || target === undefined || !(activatorEvent instanceof MouseEvent)) {
    return undefined;
  }
  return {
    target,
    span: { top: over.rect.top, height: over.rect.height },
    pointer: activatorEvent.clientY + delta.y,
  };
};

const { drag } = en.accountsSection;

const namesIn = (chart: readonly ChartNodeOutput[]): ReadonlyMap<string, string> =>
  new Map(
    chart.flatMap((node): [string, string][] =>
      node.kind === 'account'
        ? [[node.account.id, node.account.name]]
        : [
            [node.group.id, node.group.name],
            ...node.accounts.map((account): [string, string] => [account.id, account.name]),
          ],
    ),
  );

function placeText(
  { place, before }: ChartLanding,
  names: ReadonlyMap<string, string>,
): string {
  const named = (id: string): string => names.get(id) ?? '';
  const beforeText = before === null ? undefined : `${drag.before} ${named(before)}`;
  if (place.groupId !== null) {
    const into = `${drag.into} ${named(place.groupId)}`;
    return beforeText === undefined ? into : `${into}, ${beforeText}`;
  }
  return beforeText ?? `${drag.lastIn} ${en.accountTypes[place.accountType]}`;
}

type Landed = { readonly landing: ChartLanding | undefined; readonly over: boolean };

const ShownLanding = createContext<ChartLanding | undefined>(undefined);

const ListIds = createContext<readonly string[]>([]);

const LINE = 'before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:-translate-y-1/2 before:rounded before:bg-accent';

const LINE_AT_END = 'after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded after:bg-accent';

const GROUP_HIGHLIGHT = 'rounded bg-accent/15 ring-1 ring-inset ring-accent';

const sameLanding = (first: ChartLanding | undefined, second: ChartLanding | undefined): boolean =>
  first === undefined || second === undefined
    ? first === second
    : first.before === second.before && samePlace(first.place, second.place);

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
  const [moving, setMoving] = useState<NodeData>();
  const [landing, setLanding] = useState<ChartLanding>();
  const landed = useRef<Landed>({ landing: undefined, over: false });
  const names = namesIn(chart);

  const nameOf = (active: Active): string => names.get(String(active.id)) ?? '';

  const follow = (state: DragState): ChartLanding | undefined => {
    const node = nodeData(state.active)?.node;
    const drop = dropOf(state);
    const next = node === undefined || drop === undefined ? undefined : landingOf(chart, node, drop);
    landed.current = { landing: next, over: drop !== undefined };
    setLanding((shown) => (sameLanding(shown, next) ? shown : next));
    return next;
  };

  const whereNow = (active: Active, verb: string): string => {
    const { landing: now, over } = landed.current;
    if (now !== undefined) {
      return `${nameOf(active)} ${verb} ${placeText(now, names)}`;
    }
    return `${nameOf(active)} ${over ? drag.stays : drag.overNothing}`;
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => `${drag.pickedUp} ${nameOf(active)}`,
    onDragMove: ({ active }) => whereNow(active, drag.wouldGo),
    onDragOver: ({ active }) => whereNow(active, drag.wouldGo),
    onDragEnd: ({ active }) =>
      landed.current.landing === undefined
        ? `${nameOf(active)} ${drag.putBack}`
        : whereNow(active, drag.went),
    onDragCancel: ({ active }) => `${nameOf(active)} ${drag.putBack}`,
  };

  const stop = (): void => {
    setMoving(undefined);
    setLanding(undefined);
  };

  const shownName = moving === undefined ? undefined : names.get(moving.node.id);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collide}
      accessibility={{ announcements, screenReaderInstructions: { draggable: drag.instructions } }}
      onDragStart={({ active }) => {
        landed.current = { landing: undefined, over: false };
        setMoving(nodeData(active));
      }}
      onDragMove={follow}
      onDragOver={follow}
      onDragCancel={() => {
        landed.current = { landing: undefined, over: false };
        stop();
      }}
      onDragEnd={(event: DragEndEvent) => {
        follow(event);
        stop();
        const node = nodeData(event.active)?.node;
        const drop = dropOf(event);
        const move = node === undefined || drop === undefined ? undefined : droppedMove(chart, node, drop);
        if (move !== undefined) {
          onMove(move);
        }
      }}
    >
      <ShownLanding.Provider value={landing}>{children}</ShownLanding.Provider>
      <DragOverlay dropAnimation={null}>
        {moving === undefined ? null : (
          <div
            className={`flex items-center gap-2 rounded border border-accent bg-surface px-2 py-1.5 ${typeClasses['body-sm']}`}
          >
            <span className={`${BARE_ICON_BUTTON} shrink-0 cursor-grabbing`}>
              <GripIcon />
            </span>
            <span className={moving.node.kind === 'group' ? 'font-semibold' : undefined}>{shownName}</span>
          </div>
        )}
      </DragOverlay>
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
  const ids = useContext(ListIds);
  const next = ids[ids.indexOf(node.id) + 1] ?? null;
  const { setNodeRef, setActivatorNodeRef, listeners, isDragging } = useDraggable({
    id: node.id,
    data: { node, place } satisfies NodeData,
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
