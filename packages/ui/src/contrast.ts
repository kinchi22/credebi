const HEX_COLOR = /^#[0-9a-f]{6}$/iu;

function linearChannel(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(color: string): number {
  if (!HEX_COLOR.test(color)) {
    throw new Error(`Expected a colour as #RRGGBB, got ${color}`);
  }
  const rgb = Number.parseInt(color.slice(1), 16);
  return (
    0.2126 * linearChannel((rgb >> 16) & 0xff) +
    0.7152 * linearChannel((rgb >> 8) & 0xff) +
    0.0722 * linearChannel(rgb & 0xff)
  );
}

export function contrastRatio(first: string, second: string): number {
  const one = relativeLuminance(first);
  const other = relativeLuminance(second);
  return (Math.max(one, other) + 0.05) / (Math.min(one, other) + 0.05);
}
