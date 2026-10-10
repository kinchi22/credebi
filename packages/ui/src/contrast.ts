import { rgbChannels } from './tokens';

function linearChannel(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(color: string): number {
  const [red, green, blue] = rgbChannels(color);
  return 0.2126 * linearChannel(red) + 0.7152 * linearChannel(green) + 0.0722 * linearChannel(blue);
}

export function contrastRatio(first: string, second: string): number {
  const one = relativeLuminance(first);
  const other = relativeLuminance(second);
  return (Math.max(one, other) + 0.05) / (Math.min(one, other) + 0.05);
}
