const express = require('express');
const router = express.Router();
const TopographyController = require('../controllers/TopographyController');

router.get('/health', TopographyController.getHealth);
router.get('/status', TopographyController.getStatus);
router.post('/config', TopographyController.updateConfig);
router.get('/metrics', TopographyController.getMetrics);
router.post('/cleanup', TopographyController.cleanup);

router.post('/jobs', TopographyController.createJob);
router.get('/jobs', TopographyController.getJobs);
router.get('/jobs/:id', TopographyController.getJobDetail);
router.post('/jobs/:id/cancel', TopographyController.cancelJob);
router.get('/download/:id', TopographyController.downloadArtifact);

module.exports = router;
