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

export function PencilIcon(): ReactNode {
  return (
    <StrokeIcon size={16}>
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" />
      <path d="M13.5 6.5l4 4" />
    </StrokeIcon>
  );
}

export function TrashIcon(): ReactNode {
  return (
    <StrokeIcon size={16}>
      <path d="M4 7h16M10 11v6M14 11v6" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path d="M9 7V4h6v3" />
    </StrokeIcon>
  );
}

export function FolderIcon({ size }: { readonly size: 14 | 16 }): ReactNode {
  return (
    <StrokeIcon size={size}>
      <path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
    </StrokeIcon>
  );
}

export function GripIcon(): ReactNode {
  return (
    <StrokeIcon size={16}>
      <circle cx="9" cy="6" r="1" />
      <circle cx="15" cy="6" r="1" />
      <circle cx="9" cy="12" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="9" cy="18" r="1" />
      <circle cx="15" cy="18" r="1" />
    </StrokeIcon>
  );
}

export function ChevronIcon(): ReactNode {
  return (
    <StrokeIcon size={16}>
      <path d="M9 6l6 6-6 6" />
    </StrokeIcon>
  );
}

export function SearchIcon(): ReactNode {
  return (
    <StrokeIcon size={16}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </StrokeIcon>
  );
}

export function MenuIcon(): ReactNode {
  return (
    <StrokeIcon size={20}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </StrokeIcon>
  );
}

export function GoogleMark(): ReactNode {
  return (
    <svg width={18} height={18} viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
      <path
        className="fill-google-red"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        className="fill-google-blue"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        className="fill-google-yellow"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        className="fill-google-green"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
