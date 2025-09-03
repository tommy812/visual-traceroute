const express = require('express');
const router = express.Router();
const tracerouteController = require('../controllers/tracerouteController');
const NetworkGraphController = require('../controllers/NetworkGraphController');


// Health check
router.get('/health', tracerouteController.healthCheck);

// Traceroute methods
router.get('/methods', tracerouteController.getMethods);

// Trace runs
router.get('/runs', tracerouteController.getTraceRuns);
router.get('/runs/:id', tracerouteController.getTraceRunById);

// Hops
router.get('/runs/:trace_run_id/hops', tracerouteController.getHops);

// Main endpoint for network visualization data
router.get('/network-data', tracerouteController.getNetworkData);

// Utility endpoints
router.get('/destinations', tracerouteController.getDestinations);
router.get('/protocols', tracerouteController.getProtocols); 

// Graph endpoints
router.get('/network-graph', NetworkGraphController.getAggregatedGraph);
// Wrap to preserve 'this' context inside controller (uses this.buildPathObject)
router.get('/aggregated-paths', (req, res) => tracerouteController.getAggregatedPaths(req, res));

// Manual cache prewarm (POST recommended). Optional auth via PREWARM_TOKEN env.
router.post('/prewarm', (req, res) => tracerouteController.handlePrewarm(req, res));
router.get('/prewarm', (req, res) => tracerouteController.handlePrewarm(req, res));



module.exports = router; 