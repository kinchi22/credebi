import { Suspense, type ReactNode } from 'react';
import { SectionErrorBoundary } from './section-error-boundary';

export type LoadingSectionProps = {
  readonly name: string;
  readonly skeleton: ReactNode;
  readonly children: ReactNode;
};

export function LoadingSection({ name, skeleton, children }: LoadingSectionProps): ReactNode {
  return (
    <SectionErrorBoundary name={name}>
      <Suspense fallback={skeleton}>{children}</Suspense>
    </SectionErrorBoundary>
  );
}
