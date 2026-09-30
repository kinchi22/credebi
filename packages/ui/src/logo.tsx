import { type ReactNode } from 'react';
import { drawLogo, type LogoTone, type LogoVariant } from './logo-drawing';
import { palette, semanticColors } from './tokens';

export type LogoProps = {
  readonly variant: LogoVariant;
  readonly tone: LogoTone;
  readonly name: string;
  readonly height: number;
};

export function Logo({ variant, tone, name, height }: LogoProps): ReactNode {
  const { viewBox, parts } = drawLogo(variant, tone);
  const boxWidth = viewBox.maxX - viewBox.minX;
  const boxHeight = viewBox.maxY - viewBox.minY;

  return (
    <svg
      role="img"
      aria-label={name}
      viewBox={`${String(viewBox.minX)} ${String(viewBox.minY)} ${String(boxWidth)} ${String(boxHeight)}`}
      height={height}
      width={(height * boxWidth) / boxHeight}
      className="shrink-0"
    >
      <g aria-hidden="true">
        {parts.map((part, index) => (
          <path
            key={index}
            d={part.d}
            fill={palette[semanticColors[part.fill]]}
            transform={`translate(${String(part.x)} ${String(part.y)}) scale(${String(part.scale)})`}
          />
        ))}
      </g>
    </svg>
  );
}
