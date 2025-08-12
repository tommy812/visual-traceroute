export function curvedForIndex(idx, total) {
  if (total <= 1) {
    return { type: "continuous", roundness: 0.0, forceDirection: "horizontal" };
  }
  const side = (idx % 2 === 0) ? "curvedCW" : "curvedCCW";
  const step = 0.18;
  const offsetIndex = Math.floor(idx / 2) + 1;
  const roundness = step * offsetIndex;
  return { type: side, roundness, forceDirection: "horizontal" };
}