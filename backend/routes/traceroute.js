const express = require('express');
const router = express.Router();
const tracerouteController = require('../controllers/tracerouteController');


// Health check
router.get('/health', tracerouteController.healthCheck);

// Traceroute methods
router.get('/methods', tracerouteController.getMethods);

// Trace runs
router.get('/runs', tracerouteController.getTraceRuns);
// Place literal path before param route to avoid ':id' catching it
router.get('/runs/latest-by-destination', (req, res) => tracerouteController.getLatestRunByDestination(req, res));
router.get('/runs/:id', tracerouteController.getTraceRunById);

// Hops
router.get('/runs/:trace_run_id/hops', tracerouteController.getHops);

// Main endpoint for network visualization data
router.get('/network-data', tracerouteController.getNetworkData);

// Utility endpoints
router.get('/destinations', tracerouteController.getDestinations);
router.get('/protocols', tracerouteController.getProtocols); 

// Aggregated paths endpoint
router.get('/aggregated-paths', (req, res) => tracerouteController.getAggregatedPaths(req, res));

// Manual cache prewarm (POST recommended). Optional auth via PREWARM_TOKEN env.
router.post('/prewarm', (req, res) => tracerouteController.handlePrewarm(req, res));
router.get('/prewarm', (req, res) => tracerouteController.handlePrewarm(req, res));

// Cache stats
router.get('/cache-stats', (req, res) => tracerouteController.cacheStats(req, res));



module.exports = router; 