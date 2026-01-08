// controllers/companyController.js
const Company = require('../models/Company');

// @desc    Get all companies
// @route   GET /api/companies
// @access  Public
const getCompanies = async (req, res) => {
  try {
    const companies = await Company.find({ isActive: true })
      .populate('employer', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      message: 'Companies retrieved successfully',
      data: {
        companies,
        total: companies.length
      }
    });
  } catch (error) {
    console.error('Error in getCompanies:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      error: error
    });
  }
};

// @desc    Get company by ID
// @route   GET /api/companies/:id
// @access  Public
const getCompanyById = async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ Validate ObjectId format to prevent casting errors
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid company ID format'
      });
    }

    const company = await Company.findById(id)
      .populate('employer', 'name email');

    if (!company) {
      return res.status(404).json({
        status: 'fail',
        message: 'Company not found'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Company retrieved successfully',
      data: company
    });

  } catch (error) {
    console.error('Error in getCompanyById:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      error: error
    });
  }
};

// @desc    Get current user's company
// @route   GET /api/companies/my
// @access  Private (Employer/Admin)
const getMyCompany = async (req, res) => {
  try {
    console.log('Getting company for user:', req.user._id);

    const company = await Company.findOne({ 
      employer: req.user._id 
    }).populate('employer', 'name email');

    if (!company) {
      return res.status(404).json({
        status: 'fail',
        message: 'No company found for this user. Please create a company profile first.',
        data: null
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Company retrieved successfully',
      data: company
    });

  } catch (error) {
    console.error('Error in getMyCompany:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      error: error,
      stack: error.stack
    });
  }
};

// @desc    Create new company
// @route   POST /api/companies
// @access  Private (Employer/Admin)
const createCompany = async (req, res) => {
  try {
    const { name, description, industry, size, location, website, email, phone } = req.body;

    console.log('Creating company with data:', { name, industry, size, location, phone });

    // ✅ Validate required fields
    if (!name || !industry || !size || !location || !phone) {
      return res.status(400).json({
        status: 'fail',
        message: 'Name, industry, size, location, and phone are required fields'
      });
    }

    // ✅ Validate phone format
    const phoneRegex = /^[\+]?[\d\s\-\(\)]{10,}$/;
    if (!phoneRegex.test(phone.trim())) {
      return res.status(400).json({
        status: 'fail',
        message: 'Please enter a valid phone number (at least 10 digits)'
      });
    }

    // ✅ Check if user already has a company
    const existingCompany = await Company.findOne({ employer: req.user._id });
    if (existingCompany) {
      return res.status(400).json({
        status: 'fail',
        message: 'You already have a company profile. Please update your existing company instead.'
      });
    }

    // ✅ Create the company
    const company = await Company.create({
      name: name.trim(),
      description: description?.trim(),
      industry,
      size,
      location: location.trim(),
      website: website?.trim(),
      email: email?.trim(),
      phone: phone.trim(),
      employer: req.user._id
    });

    // ✅ Populate employer data
    await company.populate('employer', 'name email');

    console.log('Company created successfully:', company._id);

    res.status(201).json({
      status: 'success',
      message: 'Company created successfully',
      data: company
    });

  } catch (error) {
    console.error('Error in createCompany:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        status: 'fail',
        message: errors.join('. '),
        error: error
      });
    }

    res.status(500).json({
      status: 'error',
      message: error.message,
      error: error,
      stack: error.stack
    });
  }
};

// @desc    Update current user's company
// @route   PUT /api/companies/my
// @access  Private (Employer/Admin)
const updateCompany = async (req, res) => {
  try {
    const company = await Company.findOne({ employer: req.user._id });

    if (!company) {
      return res.status(404).json({
        status: 'fail',
        message: 'No company found for this user'
      });
    }

    // ✅ Validate phone if provided
    if (req.body.phone) {
      const phoneRegex = /^[\+]?[\d\s\-\(\)]{10,}$/;
      if (!phoneRegex.test(req.body.phone.trim())) {
        return res.status(400).json({
          status: 'fail',
          message: 'Please enter a valid phone number (at least 10 digits)'
        });
      }
    }

    const updatedCompany = await Company.findByIdAndUpdate(
      company._id,
      req.body,
      { 
        new: true, 
        runValidators: true 
      }
    ).populate('employer', 'name email');

    res.status(200).json({
      status: 'success',
      message: 'Company updated successfully',
      data: updatedCompany
    });

  } catch (error) {
    console.error('Error in updateCompany:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        status: 'fail',
        message: errors.join('. ')
      });
    }

    res.status(500).json({
      status: 'error',
      message: error.message,
      error: error
    });
  }
};

// @desc    Update specific company by ID
// @route   PUT /api/companies/:id
// @access  Private (Admin only)
const updateSpecificCompany = async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ Validate ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid company ID format'
      });
    }

    const company = await Company.findById(id);

    if (!company) {
      return res.status(404).json({
        status: 'fail',
        message: 'Company not found'
      });
    }

    // ✅ Only allow admin or company owner to update
    if (req.user.role !== 'admin' && company.employer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: 'fail',
        message: 'You can only update your own company'
      });
    }

    const updatedCompany = await Company.findByIdAndUpdate(
      id,
      req.body,
      { 
        new: true, 
        runValidators: true 
      }
    ).populate('employer', 'name email');

    res.status(200).json({
      status: 'success',
      message: 'Company updated successfully',
      data: updatedCompany
    });

  } catch (error) {
    console.error('Error in updateSpecificCompany:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      error: error
    });
  }
};

// @desc    Delete company
// @route   DELETE /api/companies/:id
// @access  Private (Admin only)
const deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ Validate ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid company ID format'
      });
    }

    const company = await Company.findById(id);

    if (!company) {
      return res.status(404).json({
        status: 'fail',
        message: 'Company not found'
      });
    }

    // ✅ Only allow admin or company owner to delete
    if (req.user.role !== 'admin' && company.employer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: 'fail',
        message: 'You can only delete your own company'
      });
    }

    await Company.findByIdAndDelete(id);

    res.status(200).json({
      status: 'success',
      message: 'Company deleted successfully'
    });

  } catch (error) {
    console.error('Error in deleteCompany:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      error: error
    });
  }
};

module.exports = {
  getCompanies,
  getCompanyById,
  getMyCompany,
  createCompany,
  updateCompany,
  updateSpecificCompany,
  deleteCompany
};