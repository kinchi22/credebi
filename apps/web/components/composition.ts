export type ComposingKey = Pick<KeyboardEvent, 'key' | 'keyCode' | 'isComposing'>;

export type CompositionOutcome = 'none' | 'hold' | 'ignore';

const IME_PROCESSING = 229;

const HELD_KEYS = new Set(['Enter', 'Escape']);

export function duringComposition(event: ComposingKey, composing: boolean): CompositionOutcome {
  const composed =
    composing ||
    event.isComposing ||
    /* eslint-disable-next-line @typescript-eslint/no-deprecated -- Safari reports the Enter that ends a composition only as keyCode 229 */
    event.keyCode === IME_PROCESSING;
  if (!composed) {
    return 'none';
  }
  return HELD_KEYS.has(event.key) ? 'hold' : 'ignore';
}
