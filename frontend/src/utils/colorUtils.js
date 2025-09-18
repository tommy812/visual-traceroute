/**
 * Color Utilities
 * 
 * Handles color generation for graph visualization including destination colors
 * and path highlighting. Uses HSL color space for better color distribution.
 */

export function hslToHex(h, s, l) {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function generateDestinationColor(index, saturation = 65, lightness = 55) {
  // Use golden ratio for better color distribution, avoiding red and green ranges
  const goldenRatio = 0.618033988749;
  let hue = (index * goldenRatio * 360) % 360;
  
  // Avoid red (0-30, 330-360) and green (90-150) ranges
  // Map problematic hues to safer alternatives
  if ((hue >= 0 && hue <= 30) || (hue >= 330 && hue <= 360)) {
    // Red range -> shift to orange-red (15-30) or purple-red (330-345)
    hue = hue <= 30 ? 45 : 315; // Orange or purple-red
  } else if (hue >= 90 && hue <= 150) {
    // Green range -> shift to blue-green (120-135) or yellow-green (60-75)
    hue = hue <= 120 ? 75 : 135; // Yellow-green or blue-green
  }
  
  return hslToHex(hue, saturation, lightness);
}

// Optional stable color by key (e.g., address)
export function colorForKey(key, saturation = 65, lightness = 55) {
  let hash = 0;
  const str = String(key);
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return hslToHex(hue, saturation, lightness);
}

export const pathHighlightColors = [
  "#FF6B35", "#004E89", "#2c0a52ff", "#7209B7", "#270b13ff",
  "#FF8500", "#0FA3B1", "#B5179E", "#F72585", "#4361EE",
  "#5b4813ff", "#574037ff", "#4169E1", "#2b2123ff", "#FF1493",
  "#012e2bff", "#8A2BE2", "#FF6347", "#1E90FF", "#FFD700",
  "#20B2AA", "#FF69B4", "#8B4513", "#FF00FF", "#00CED1",
  "#283116ff", "#FF7F50", "#6495ED", "#D2691E", "#BA55D3"
];

export function adjustColorIntensity(hexColor, intensity = 0.6) {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  const mix = (c) => Math.round(c * intensity + 255 * (1 - intensity));
  const toHex = (n) => n.toString(16).padStart(2, '0');
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;  // FIXED
}

