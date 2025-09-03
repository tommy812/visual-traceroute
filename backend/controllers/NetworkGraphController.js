const supabase = require('../config/database');
const crypto = require('crypto');

function hashParams(obj) {
  return crypto.createHash('sha1').update(JSON.stringify(obj)).digest('hex').slice(0,12);
}

function parseCsv(q) {
  if (!q) return [];
  return String(q).split(',').map(s => s.trim()).filter(Boolean);
}

function pickPathSelector(mode) {
  switch (mode) {
    case 'fastest':
      return `
        ROW_NUMBER() OVER (
          PARTITION BY destination_id, protocol_code
          ORDER BY avg_path_rtt NULLS LAST, hop_count, run_count DESC, last_seen DESC
        ) = 1
      `;
    case 'shortest':
      return `
        ROW_NUMBER() OVER (
          PARTITION BY destination_id, protocol_code
          ORDER BY hop_count, avg_path_rtt NULLS LAST, run_count DESC, last_seen DESC
        ) = 1
      `;
    case 'most-used':
      return `
        ROW_NUMBER() OVER (
          PARTITION BY destination_id, protocol_code
          ORDER BY run_count DESC, avg_path_rtt NULLS LAST, hop_count, last_seen DESC
        ) = 1
      `;
    default:
      return 'TRUE'; // keep all
  }
}

class NetworkGraphController {

  // GET /api/traceroute/network-graph
  static async getAggregatedGraph(req, res) {
    try {
      const {
        destinations,
        start_date,
        end_date,
        protocols,
        aggregation_mode = 'none',        // none|shared-ips|prefix|hierarchy
        hierarchy = 'none',               // none|subnet|isp-pop|isp  -> /64 /48 /32
        scope = 'per-destination',        // per-destination|cross-destination
        path_select = 'all',              // all|fastest|shortest|most-used
        limit_paths = 5000                // safety cap
      } = req.query;

      const destList = parseCsv(destinations);
      const protoList = parseCsv(protocols);

      // Choose source relation (materialized or raw view)
      const signatureTable = 'path_signatures_mv';

      // WHERE clauses
      const where = [];
      const params = [];
      let p = 1;

      if (destList.length) {
        // separate numeric ids vs address
        const ids = destList.filter(x => /^\d+$/.test(x));
        const addrs = destList.filter(x => !/^\d+$/.test(x));
        if (ids.length) {
          where.push(`destination_id = ANY($${p}::int[])`); params.push(ids.map(Number)); p++;
        }
        if (addrs.length) {
          where.push(`destination_address = ANY($${p}::text[])`); params.push(addrs); p++;
        }
      }

      if (protoList.length) {
        where.push(`protocol_code = ANY($${p}::text[])`);
        params.push(protoList.map(s => s.toUpperCase()));
        p++;
      }

      if (start_date) { where.push(`last_seen >= $${p}`); params.push(start_date); p++; }
      if (end_date)   { where.push(`first_seen <= $${p}`); params.push(end_date); p++; }

      const selector = pickPathSelector(path_select);

      const sql = `
        WITH filtered AS (
          SELECT *
          FROM ${signatureTable}
          ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ),
        ranked AS (
          SELECT *,
                 ${selector} AS selected
          FROM filtered
        ),
        chosen AS (
          SELECT * FROM ranked
          WHERE selected
          ORDER BY destination_id, protocol_code, run_count DESC
          LIMIT $${p}
        )
        SELECT * FROM chosen;
      `;
      params.push(limit_paths);

      const { data: pathRows, error } = await supabase.rpc('exec_sql', { query: sql, params });
      if (error) throw error;

      // Build node/edge skeleton from chosen paths
      // Each row has hop_sequence (text[]). Re-expand to edges.
      const nodeKeyMap = new Map();
      let nextNodeId = 1;
      const nodeDetails = {};
      const edgesMap = new Map();

      function nodeKey(ip, hopIndex, destAddr, protocol) {
        if (aggregation_mode === 'shared-ips') {
          return scope === 'cross-destination'
            ? `ip:${ip}@h:${hopIndex+1}`
            : `ip:${ip}@d:${destAddr}@h:${hopIndex+1}`;
        }
        if (aggregation_mode === 'prefix' || hierarchy !== 'none') {
          // placeholder: keep IP as-is, client can request expansion later
          return scope === 'cross-destination'
            ? `ip:${ip}@h:${hopIndex+1}`
            : `ip:${ip}@d:${destAddr}@h:${hopIndex+1}`;
        }
        // none: path-specific granularity not needed at server stage
        return scope === 'cross-destination'
          ? `ip:${ip}@h:${hopIndex+1}`
          : `ip:${ip}@d:${destAddr}@h:${hopIndex+1}`;
      }

      for (const row of pathRows || []) {
        const { destination_address, protocol_code, hop_sequence, hop_count, run_count, avg_path_rtt } = row;
        const pathId = `${destination_address}-${protocol_code}-${avg_path_rtt || 'NA'}-${run_count}`;

        // Build nodes
        hop_sequence.forEach((ipSig, idx) => {
          const isTimeout = ipSig.startsWith('timeout_');
            if (isTimeout) return; // skip pure timeout nodes for now or include if needed
          const k = nodeKey(ipSig, idx, destination_address, protocol_code);
          if (!nodeKeyMap.has(k)) {
            nodeKeyMap.set(k, nextNodeId++);
            nodeDetails[nodeKeyMap.get(k)] = [];
          }
          nodeDetails[nodeKeyMap.get(k)].push({
            ip: ipSig,
            hopNumber: idx + 1,
            destination: destination_address,
            protocol: protocol_code,
            pathId,
            is_timeout: false,
            pathPercent: null,
            pathCount: run_count,
            hopCount: hop_count,
            pathAvgRtt: avg_path_rtt
          });
        });

        // Build edges along sequence
        const clean = hop_sequence.filter(s => !s.startsWith('timeout_'));
        for (let i=0;i<clean.length-1;i++){
          const a = nodeKey(clean[i], i, destination_address, protocol_code);
          const b = nodeKey(clean[i+1], i+1, destination_address, protocol_code);
          const aId = nodeKeyMap.get(a);
          const bId = nodeKeyMap.get(b);
          if (aId && bId) {
            const ek = `${aId}|${bId}`;
            if (!edgesMap.has(ek)) edgesMap.set(ek, {
              source: aId, target: bId,
              weight: 0,
              destinations: new Set(),
              protocols: new Set(),
              paths: new Set()
            });
            const e = edgesMap.get(ek);
            e.weight += run_count;
            e.destinations.add(destination_address);
            e.protocols.add(protocol_code);
            e.paths.add(pathId);
          }
        }
      }

      const nodes = Array.from(nodeKeyMap.entries()).map(([key,id]) => {
        const details = nodeDetails[id] || [];
        const ips = new Set(details.map(d=>d.ip).filter(Boolean));
        const avgRtt = (() => {
          const rtts = details.map(d=>d.pathAvgRtt).filter(v=>v!=null);
          if (!rtts.length) return null;
          return rtts.reduce((s,v)=>s+v,0)/rtts.length;
        })();
        const hop = details.reduce((m,d)=>Math.max(m,d.hopNumber||0),0);
        return {
          id,
          key,
          label: ips.size === 1 ? [...ips][0] : `${ips.size} IPs`,
          hop,
          type: 'ip',
          rttAvg: avgRtt,
          count: details.length
        };
      });

      const edges = Array.from(edgesMap.values()).map(e => ({
        id: `e${e.source}_${e.target}`,
        source: e.source,
        target: e.target,
        weight: e.weight,
        paths: Array.from(e.paths),
        destinations: Array.from(e.destinations),
        protocols: Array.from(e.protocols)
      }));

      const paramsHash = hashParams({
        destinations: destList,
        protocols: protoList,
        start_date,
        end_date,
        aggregation_mode,
        hierarchy,
        scope,
        path_select
      });

      res.json({
        meta: {
          generated_at: new Date().toISOString(),
          aggregation_mode,
          hierarchy,
          scope,
          path_select,
          paramsHash
        },
        nodes,
        edges,
        nodeDetails,
        pathIndex: {}, // reserved (can fill with per-path metrics if needed)
        counts: {
          paths: pathRows?.length || 0,
          nodes: nodes.length,
          edges: edges.length
        }
      });

    } catch (err) {
      console.error('getAggregatedGraph error', err);
      res.status(500).json({ error: 'Failed to build graph', details: err.message });
    }
  }
}

module.exports = NetworkGraphController;