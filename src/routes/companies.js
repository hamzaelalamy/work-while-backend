// routes/companies.js
const express = require('express');
const companyController = require('../controllers/companyController');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// ✅ IMPORTANT: Specific routes FIRST, before parameterized routes

// Protected routes - require authentication and employer role
router.get('/my', auth, authorize('employer', 'admin'), companyController.getMyCompany);
router.post('/', auth, authorize('employer', 'admin'), companyController.createCompany);
router.put('/my', auth, authorize('employer', 'admin'), companyController.updateCompany);

// Public routes - accessible to everyone
router.get('/', companyController.getCompanies);

// Parameterized routes MUST come LAST to avoid conflicts
router.get('/:id', companyController.getCompanyById);

// Additional protected routes with specific IDs (optional)
router.put('/:id', auth, authorize('employer', 'admin'), companyController.updateSpecificCompany);
router.delete('/:id', auth, authorize('employer', 'admin'), companyController.deleteCompany);

module.exports = router;