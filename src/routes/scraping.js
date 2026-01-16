const express = require('express');
const router = express.Router();
const scrapingController = require('../controllers/scrapingController');
const { auth, authorize } = require('../middleware/auth');

// All routes require Admin role
router.use(auth);
router.use(authorize('admin'));

router.post('/trigger', scrapingController.triggerScraping);
router.get('/history', scrapingController.getHistory);
router.get('/jobs', scrapingController.getScrapedJobs);
router.put('/jobs/:id/approve', scrapingController.approveJob);
router.delete('/jobs/:id/reject', scrapingController.rejectJob);
router.post('/jobs/bulk-approve', scrapingController.bulkApproveJobs);
router.post('/jobs/bulk-reject', scrapingController.bulkRejectJobs);

module.exports = router;
