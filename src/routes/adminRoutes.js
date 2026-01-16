const express = require('express');
const userController = require('../controllers/userController');
const jobController = require('../controllers/jobController');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// Middleware to protect all admin routes
router.use(auth);
router.use(authorize('admin'));

// Admin User Routes
router.get('/users', userController.getAllUsers);

// Admin Job Routes
router.get('/jobs', jobController.getAllJobsAdmin);

module.exports = router;
