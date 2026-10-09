import {
  landedMove,
  type AccountGroupId,
  type AccountType,
  type ChartLanding,
  type ChartNodeOutput,
  type ChartNodeRef,
  type ChartPlace,
  type MoveChartNodeInput,
} from '@repo/contracts';

export type ChartDropTarget =
  | {
      readonly on: 'row';
      readonly place: ChartPlace;
      readonly node: ChartNodeRef;
      readonly next: string | null;
    }
  | { readonly on: 'heading'; readonly accountType: AccountType; readonly groupId: AccountGroupId }
  | { readonly on: 'end'; readonly place: ChartPlace };

type Span = { readonly top: number; readonly height: number };

export type Measured = { readonly span: Span; readonly pointer: number };

export type ChartDrop = Measured & { readonly target: ChartDropTarget };

type Hit = { readonly id: string | number; readonly data?: Record<string, unknown> };

export function measuredHits<Found extends Hit>(
  hits: readonly Found[],
  pointer: { readonly y: number } | null,
  rects: ReadonlyMap<string | number, Span>,
): Found[] {
  return hits.map((hit) => {
    const span = rects.get(hit.id);
    if (pointer === null || span === undefined) {
      return hit;
    }
    const measured: Measured = { span: { top: span.top, height: span.height }, pointer: pointer.y };
    return { ...hit, data: { ...hit.data, measured } };
  });
}

export const measuredOf = (hit: Hit | undefined): Measured | undefined =>
  hit?.data?.['measured'] as Measured | undefined;

export function aimedAt({ target, span, pointer }: ChartDrop): ChartLanding {
  if (target.on === 'end') {
    return { place: target.place, before: null };
  }
  if (target.on === 'row') {
    const lowerHalf = pointer > span.top + span.height / 2;
    return { place: target.place, before: lowerHalf ? target.next : target.node.id };
  }
  const { accountType, groupId } = target;
  return pointer < span.top + span.height / 4
    ? { place: { accountType, groupId: null }, before: groupId }
    : { place: { accountType, groupId }, before: null };
}

export const droppedMove = (
  chart: readonly ChartNodeOutput[],
  node: ChartNodeRef,
  drop: ChartDrop,
): MoveChartNodeInput | undefined => landedMove(chart, node, aimedAt(drop));
