const express = require('express');
const router = express.Router();
const tracerouteController = require('../controllers/tracerouteController');

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

module.exports = router; 