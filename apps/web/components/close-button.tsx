'use client';

import { CloseIcon } from '@repo/ui';
import { type ReactNode } from 'react';

export type CloseButtonProps = {
  readonly label: string;
  readonly onClose: () => void;
  readonly disabled?: boolean;
};

export function CloseButton({ label, onClose, disabled }: CloseButtonProps): ReactNode {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClose}
      disabled={disabled}
      className="-mr-2 inline-flex size-10 items-center justify-center rounded text-text disabled:opacity-50"
    >
      <CloseIcon />
    </button>
  );
}
