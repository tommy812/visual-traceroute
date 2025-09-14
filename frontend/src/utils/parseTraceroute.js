// Simple, robust parser for classic traceroute output (IPv4/IPv6)
// Supports: stars (timeouts), multiple responses per hop, hostnames + IPs, RTTs
// Output shape:
// {
//   destination: string | null,
//   maxHops: number | null,
//   hops: Array<{
//     hop: number,
//     responses: Array<{
//       ip: string | null,
//       hostname: string | null,
//       rtts: number[],
//       timeout: boolean
//     }>
//   }>
// }

export function parseTraceroute(raw) {
  if (!raw || typeof raw !== 'string') {
    return { destination: null, maxHops: null, hops: [] };
  }

  const lines = raw
    .split(/\r?\n/) // handle CRLF or LF
    .map(s => s.trim())
    .filter(Boolean);

  let destination = null;
  let maxHops = null;
  const hops = [];

  // Header example:
  // traceroute to google.com (2a00:1450:4009:826::200e), 30 hops max, 80 byte packets
  const header = lines[0] || '';
  const headerMatch = header.match(/^traceroute\s+to\s+([^\s]+)\s*\(([^)]+)\).*?(\d+)\s+hops\s+max/i);
  if (headerMatch) {
    destination = `${headerMatch[1]} (${headerMatch[2]})`;
    maxHops = parseInt(headerMatch[3], 10) || null;
  }

  const ipParenRe = /^([^\s(]+)?\s*\(([^)]+)\)\s*/; // hostname? (ip)
  const starRe = /^\*\s*/;
  const rttRe = /^(\d+(?:\.\d+)?)\s*ms\s*/;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^(\d+)\s+(.*)$/);
    if (!m) continue; // skip malformed
    const hopNum = parseInt(m[1], 10);
    let rest = m[2];
    const responses = [];

    // Iterate tokens in the remainder
    while (rest && rest.length) {
      // timeout token
      let sm = rest.match(starRe);
      if (sm) {
        responses.push({ ip: null, hostname: null, rtts: [], timeout: true });
        rest = rest.slice(sm[0].length);
        continue;
      }

      // hostname/ip pair
      let hm = rest.match(ipParenRe);
      if (hm) {
        const hostname = hm[1] && hm[1] !== hm[2] ? hm[1] : null; // if same as IP, skip
        const ip = hm[2];
        rest = rest.slice(hm[0].length);

        // collect up to three RTTs following
        const rtts = [];
        for (let k = 0; k < 3; k++) {
          const rm = rest.match(rttRe);
          if (rm) {
            rtts.push(parseFloat(rm[1]));
            rest = rest.slice(rm[0].length);
          } else {
            break;
          }
        }

        responses.push({ ip, hostname, rtts, timeout: false });
        continue;
      }

      // If neither, try to consume a bare IP (some implementations print just IP)
      const bareIp = rest.match(/^([0-9a-fA-F:.]+)\s*/);
      if (bareIp) {
        const ip = bareIp[1];
        rest = rest.slice(bareIp[0].length);
        const rtts = [];
        for (let k = 0; k < 3; k++) {
          const rm = rest.match(rttRe);
          if (rm) { rtts.push(parseFloat(rm[1])); rest = rest.slice(rm[0].length); } else { break; }
        }
        responses.push({ ip, hostname: null, rtts, timeout: false });
        continue;
      }

      // Unknown token – consume one char to prevent infinite loop
      rest = rest.slice(1);
    }

    hops.push({ hop: hopNum, responses });
  }

  return { destination, maxHops, hops };
}

export default parseTraceroute;
