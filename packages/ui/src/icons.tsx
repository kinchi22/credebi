import { type ReactNode } from 'react';

type IconProps = {
  readonly size: number;
  readonly children: ReactNode;
};

function StrokeIcon({ size, children }: IconProps): ReactNode {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function SignOutIcon(): ReactNode {
  return (
    <StrokeIcon size={16}>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 17l-5-5 5-5" />
      <path d="M5 12h11" />
    </StrokeIcon>
  );
}

export function CalendarIcon(): ReactNode {
  return (
    <StrokeIcon size={20}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </StrokeIcon>
  );
}

export function CloseIcon(): ReactNode {
  return (
    <StrokeIcon size={20}>
      <path d="M6 6l12 12M18 6L6 18" />
    </StrokeIcon>
  );
}
