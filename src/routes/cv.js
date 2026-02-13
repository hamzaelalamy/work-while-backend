const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const { uploadCV } = require('../middleware/uploadMiddleware');
const cvMatchController = require('../controllers/cvMatchController');

// All CV routes require authentication and candidate role
router.use(auth);
router.use(authorize('candidate', 'admin'));

// Upload CV and get job matches (multipart/form-data, field name: cv)
router.post('/upload', (req, res, next) => {
  uploadCV(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        status: 'fail',
        message: err.message || 'CV upload failed'
      });
    }
    next();
  });
}, cvMatchController.uploadCVAndGetMatches);

// Get matches from last uploaded CV (no new upload)
router.get('/matches', cvMatchController.getMatches);

module.exports = router;
