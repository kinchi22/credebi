import { FolderIcon } from '@repo/ui';
import { type ReactNode } from 'react';
import { type Branch } from './chart-tree';

const LINE = 'absolute left-2.5 border-border-control';

export function TreeBranch({ branch }: { readonly branch: Branch }): ReactNode {
  return (
    <span aria-hidden="true" className="relative w-5 shrink-0">
      {branch === 'tee' ? (
        <>
          <span className={`${LINE} inset-y-0 border-l`} />
          <span className={`${LINE} right-0 bottom-1/2 border-b`} />
        </>
      ) : (
        <span className={`${LINE} top-0 bottom-1/2 w-2.5 rounded-bl border-b border-l`} />
      )}
    </span>
  );
}

export function TreeHook(): ReactNode {
  return (
    <span
      aria-hidden="true"
      className="absolute -top-1.5 left-1.5 h-5.5 w-2.5 rounded-bl border-b border-l border-border-control"
    />
  );
}

export function GroupFolder({ size }: { readonly size: 14 | 16 }): ReactNode {
  return (
    <span aria-hidden="true" className="flex shrink-0 text-text-muted">
      <FolderIcon size={size} />
    </span>
  );
}
