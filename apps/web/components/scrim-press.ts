export type ScrimPress = {
  readonly began: (target: EventTarget | null) => void;
  readonly ended: (target: EventTarget | null) => void;
  readonly clicked: (target: EventTarget | null, dialog: EventTarget) => boolean;
};

export function scrimPress(): ScrimPress {
  let pressedOn: EventTarget | null = null;
  let releasedOn: EventTarget | null = null;
  return {
    began: (target) => {
      pressedOn = target;
      releasedOn = null;
    },
    ended: (target) => {
      releasedOn = target;
    },
    clicked: (target, dialog) => {
      const clicked = pressedOn === dialog && releasedOn === dialog && target === dialog;
      pressedOn = null;
      releasedOn = null;
      return clicked;
    },
  };
}
