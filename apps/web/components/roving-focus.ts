export type RovingStep = (index: number, count: number) => number;

const back: RovingStep = (index, count) => (index + count - 1) % count;
const forward: RovingStep = (index, count) => (index + 1) % count;
const first: RovingStep = () => 0;
const last: RovingStep = (_index, count) => count - 1;

export const ACROSS_STEPS: Readonly<Record<string, RovingStep>> = {
  ArrowLeft: back,
  ArrowRight: forward,
  Home: first,
  End: last,
};

export const DOWN_STEPS: Readonly<Record<string, RovingStep>> = {
  ArrowUp: back,
  ArrowDown: forward,
  Home: first,
  End: last,
};
