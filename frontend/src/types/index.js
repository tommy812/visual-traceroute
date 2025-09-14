/**
 * @typedef {Object} Hop
 * @property {number} hop_number
 * @property {string|null} ip
 * @property {string|null} hostname
 * @property {number[]} rtt_ms
 * @property {boolean} is_timeout
 * @property {string|null} protocol
 * @property {number|string|null} asn
 */

/**
 * @typedef {Object} Path
 * @property {Hop[]} path
 * @property {number} count
 * @property {number} percent
 * @property {number|null} avg_rtt
 * @property {string|null} timeStamp
 * @property {string|null} protocol
 * @property {string} [pathId]
 */

export {}; // make this a module for TypeScript-aware tooling
