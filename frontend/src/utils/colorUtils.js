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
  // Use golden ratio for better color distribution
  const goldenRatio = 0.618033988749;
  const hue = (index * goldenRatio * 360) % 360;
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
  "#FF6B35", "#004E89", "#960000ff", "#7209B7", "#FF1654",
  "#FF8500", "#0FA3B1", "#B5179E", "#F72585", "#4361EE",
  "#2E8B57", "#FF4500", "#4169E1", "#DC143C", "#FF1493",
  "#32CD32", "#8A2BE2", "#FF6347", "#1E90FF", "#FFD700",
  "#20B2AA", "#FF69B4", "#8B4513", "#FF00FF", "#00CED1",
  "#9ACD32", "#FF7F50", "#6495ED", "#D2691E", "#BA55D3"
];

export function adjustColorIntensity(hexColor, intensity = 0.6) {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  const mix = (c) => Math.round(c * intensity + 255 * (1 - intensity));
  const toHex = (n) => n.toString(16).padStart(2, '0');
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;  // FIXED
}

