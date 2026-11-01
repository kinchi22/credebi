import { rgbChannels } from './tokens';

type Channels = readonly [number, number, number];

function linearChannel(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function linearChannels(color: string): Channels {
  const [red, green, blue] = rgbChannels(color);
  return [linearChannel(red), linearChannel(green), linearChannel(blue)];
}

function relativeLuminance(color: string): number {
  const [red, green, blue] = linearChannels(color);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(first: string, second: string): number {
  const one = relativeLuminance(first);
  const other = relativeLuminance(second);
  return (Math.max(one, other) + 0.05) / (Math.min(one, other) + 0.05);
}

const WHITE_X = 0.95047;
const WHITE_Z = 1.08883;
const LAB_KNEE = 216 / 24389;
const LAB_SLOPE = 24389 / 27;

function labCurve(value: number): number {
  return value > LAB_KNEE ? Math.cbrt(value) : (LAB_SLOPE * value + 16) / 116;
}

function lab(color: string): Channels {
  const [red, green, blue] = linearChannels(color);
  const x = labCurve((0.4124 * red + 0.3576 * green + 0.1805 * blue) / WHITE_X);
  const y = labCurve(relativeLuminance(color));
  const z = labCurve((0.0193 * red + 0.1192 * green + 0.9505 * blue) / WHITE_Z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

export function colorDifference(first: string, second: string): number {
  const [lightness, greenRed, blueYellow] = lab(first);
  const [otherLightness, otherGreenRed, otherBlueYellow] = lab(second);
  return Math.hypot(lightness - otherLightness, greenRed - otherGreenRed, blueYellow - otherBlueYellow);
}
