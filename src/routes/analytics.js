const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { auth, authorize } = require('../middleware/auth');

// All routes require Admin role
router.use(auth);
router.use(authorize('admin'));

router.get('/overview', analyticsController.getMarketOverview);
router.get('/sectors', analyticsController.getTopSectors);
router.get('/skills', analyticsController.getTopSkills);
router.get('/locations', analyticsController.getLocationTrends);
router.get('/trends', analyticsController.getJobTrends);

module.exports = router;
