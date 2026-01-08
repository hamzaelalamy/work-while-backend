// controllers/jobController.js - FIXED VERSION
const Job = require('../models/Job');
const { catchAsync, AppError, sendResponse, getPaginationMeta } = require('../utils/helpers');
const { jobValidators } = require('../utils/validators');

// Obtenir tous les emplois avec filtres et pagination
const getAllJobs = catchAsync(async (req, res, next) => {
  console.log('Fetching jobs with query:', req.query);

  try {
    // Extraction des paramètres de requête
    const {
      search = '',
      location = '',
      type = '',
      category = '',
      experienceLevel = '',
      minSalary = '',
      maxSalary = '',
      isRemote = '',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 10
    } = req.query;

    // Construction du filtre
    const filter = { status: 'active' }; // Seulement les emplois actifs

    // Recherche textuelle
    if (search.trim()) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { skills: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Filtres spécifiques
    if (location.trim()) {
      filter.location = { $regex: location, $options: 'i' };
    }

    if (type) {
      filter.type = type;
    }

    if (category) {
      filter.category = { $regex: category, $options: 'i' };
    }

    if (experienceLevel) {
      filter.experienceLevel = experienceLevel;
    }

    if (isRemote === 'true') {
      filter.isRemote = true;
    }

    // Filtres de salaire
    if (minSalary || maxSalary) {
      filter['salary.min'] = {};
      if (minSalary) filter['salary.min'].$gte = parseInt(minSalary);
      if (maxSalary) filter['salary.max'] = { $lte: parseInt(maxSalary) };
    }

    // Construction du tri
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calcul de la pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Requête avec pagination
    const [jobs, totalResults] = await Promise.all([
      Job.find(filter)
        .populate('company', 'name logo location')
        .populate('postedBy', 'firstName lastName')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Job.countDocuments(filter)
    ]);

    // Métadonnées de pagination
    const pagination = getPaginationMeta(totalResults, pageNum, limitNum);

    // Enrichir les données des emplois
    const enrichedJobs = jobs.map(job => ({
      ...job,
      applicationsCount: job.applications?.length || 0,
      isNew: (new Date() - new Date(job.createdAt)) < (7 * 24 * 60 * 60 * 1000), // 7 jours
      timeAgo: getTimeAgo(job.createdAt)
    }));

    console.log(`Found ${totalResults} jobs, returning ${enrichedJobs.length} for page ${pageNum}`);

    sendResponse(res, 200, 'success', 'Jobs retrieved successfully', {
      jobs: enrichedJobs,
      pagination,
      filters: {
        search,
        location,
        type,
        category,
        experienceLevel,
        isRemote: isRemote === 'true',
        salary: { min: minSalary, max: maxSalary }
      }
    });

  } catch (error) {
    console.error('Get all jobs error:', error);
    return next(new AppError('Failed to retrieve jobs', 500));
  }
});

// Obtenir un emploi par ID
const getJobById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  console.log('Fetching job by ID:', id);

  try {
    const job = await Job.findById(id)
      .populate('company', 'name logo location description website')
      .populate('postedBy', 'firstName lastName')
      .populate('applications', 'applicant status createdAt')
      .lean();

    if (!job) {
      return next(new AppError('Job not found', 404));
    }

    // Enrichir les données
    const enrichedJob = {
      ...job,
      applicationsCount: job.applications?.length || 0,
      isNew: (new Date() - new Date(job.createdAt)) < (7 * 24 * 60 * 60 * 1000),
      timeAgo: getTimeAgo(job.createdAt),
      viewsCount: job.viewsCount || 0
    };

    // Incrémenter le compteur de vues (optionnel)
    await Job.findByIdAndUpdate(id, { $inc: { viewsCount: 1 } });

    sendResponse(res, 200, 'success', 'Job retrieved successfully', {
      job: enrichedJob
    });

  } catch (error) {
    console.error('Get job by ID error:', error);
    return next(new AppError('Failed to retrieve job', 500));
  }
});

// ✅ FIXED: Créer un nouvel emploi (pour les employeurs)
const createJob = catchAsync(async (req, res, next) => {
  console.log('📝 Creating job - Request body:', req.body);
  console.log('👤 User info:', { id: req.user._id, role: req.user.role });

  try {
    // ✅ STEP 1: Validate user permissions
    if (req.user.role !== 'employer' && req.user.role !== 'admin') {
      console.log('❌ Permission denied - User role:', req.user.role);
      return next(new AppError('Only employers can create jobs', 403));
    }

    // ✅ STEP 2: Clean and validate request data (WITHOUT postedBy - added after validation)
    const cleanedData = {
      title: String(req.body.title || '').trim(),
      description: String(req.body.description || '').trim(),
      location: String(req.body.location || '').trim(),
      type: req.body.type || 'full-time',
      category: String(req.body.category || '').trim(),
      experienceLevel: req.body.experienceLevel || 'mid',
      isRemote: Boolean(req.body.isRemote),
      urgency: req.body.urgency || 'medium'
      // NOTE: postedBy will be added AFTER validation
    };

    console.log('🧹 Cleaned basic data:', cleanedData);

    // ✅ STEP 3: Handle salary with proper validation
    if (req.body.salary && typeof req.body.salary === 'object') {
      cleanedData.salary = {
        currency: req.body.salary.currency || 'USD',
        period: req.body.salary.period || 'yearly'
      };

      // Only add numeric values that are valid
      if (req.body.salary.min && !isNaN(Number(req.body.salary.min)) && Number(req.body.salary.min) > 0) {
        cleanedData.salary.min = Number(req.body.salary.min);
      }

      if (req.body.salary.max && !isNaN(Number(req.body.salary.max)) && Number(req.body.salary.max) > 0) {
        cleanedData.salary.max = Number(req.body.salary.max);
      }

      console.log('💰 Processed salary:', cleanedData.salary);
    }

    // ✅ STEP 4: Handle arrays with validation
    ['skills', 'benefits', 'requirements', 'tags'].forEach(field => {
      if (req.body[field]) {
        if (Array.isArray(req.body[field])) {
          cleanedData[field] = req.body[field]
            .map(item => String(item).trim())
            .filter(item => item.length > 0);
        } else if (typeof req.body[field] === 'string' && req.body[field].trim()) {
          // Handle comma or newline separated strings
          const separator = field === 'skills' || field === 'tags' ? ',' : '\n';
          cleanedData[field] = req.body[field]
            .split(separator)
            .map(item => String(item).trim())
            .filter(item => item.length > 0);
        }
        console.log(`📋 Processed ${field}:`, cleanedData[field]);
      }
    });

    // ✅ STEP 5: Handle optional fields
    if (req.body.deadlineDate) {
      const deadline = new Date(req.body.deadlineDate);
      if (!isNaN(deadline.getTime()) && deadline > new Date()) {
        cleanedData.deadlineDate = deadline;
      }
    }

    console.log('✨ Final cleaned data before validation:', cleanedData);

    // ✅ STEP 6: Validation with Joi (without postedBy field)
    const { error } = jobValidators.createJob.validate(cleanedData, { 
      allowUnknown: false, // Don't allow unknown fields
      stripUnknown: true   // Remove unknown fields if any
    });
    if (error) {
      console.log('❌ Validation error:', error.details);
      const errorMessage = error.details.map(detail => detail.message).join(', ');
      return next(new AppError(`Validation failed: ${errorMessage}`, 400));
    }

    console.log('✅ Validation passed');

    // ✅ STEP 7: Add user-specific fields AFTER validation
    cleanedData.postedBy = req.user._id; // Set the user who is creating the job

    // Add company if available
    if (req.body.company) {
      cleanedData.company = req.body.company;
    } else if (req.user.company) {
      cleanedData.company = req.user.company;
    }

    // ✅ STEP 8: Create the job
    const job = new Job(cleanedData);
    await job.save();

    console.log('💾 Job saved to database:', job._id);

    // ✅ STEP 9: Populate response data
    const populatedJob = await Job.findById(job._id)
      .populate('company', 'name logo location')
      .populate('postedBy', 'firstName lastName');

    console.log('🎉 Job created successfully:', populatedJob._id);

    sendResponse(res, 201, 'success', 'Job created successfully', {
      job: populatedJob
    });

  } catch (error) {
    console.error('💥 Create job error:', error);
    
    // ✅ BETTER ERROR HANDLING
    if (error.name === 'ValidationError') {
      // Mongoose validation error
      const errors = Object.values(error.errors).map(err => err.message);
      return next(new AppError(`Validation failed: ${errors.join(', ')}`, 400));
    }
    
    if (error.name === 'CastError') {
      // Invalid ObjectId or type casting error
      return next(new AppError('Invalid data format provided', 400));
    }
    
    if (error.code === 11000) {
      // Duplicate key error
      return next(new AppError('Duplicate entry detected', 400));
    }
    
    // Generic server error
    return next(new AppError('Failed to create job. Please try again.', 500));
  }
});

// Mettre à jour un emploi
const updateJob = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  console.log('Updating job:', id, req.body);

  // Validation
  const { error } = jobValidators.updateJob.validate(req.body);
  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }

  try {
    // Trouver l'emploi
    const job = await Job.findById(id);
    if (!job) {
      return next(new AppError('Job not found', 404));
    }

    // Vérifier les permissions
    if (job.postedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return next(new AppError('You can only update your own jobs', 403));
    }

    // Mettre à jour
    const updatedJob = await Job.findByIdAndUpdate(
      id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    )
      .populate('company', 'name logo location')
      .populate('postedBy', 'firstName lastName');

    console.log('Job updated successfully:', id);

    sendResponse(res, 200, 'success', 'Job updated successfully', {
      job: updatedJob
    });

  } catch (error) {
    console.error('Update job error:', error);
    return next(new AppError('Failed to update job', 500));
  }
});

// Supprimer un emploi
const deleteJob = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  console.log('Deleting job:', id);

  try {
    // Trouver l'emploi
    const job = await Job.findById(id);
    if (!job) {
      return next(new AppError('Job not found', 404));
    }

    // Vérifier les permissions
    if (job.postedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return next(new AppError('You can only delete your own jobs', 403));
    }

    // Supprimer
    await Job.findByIdAndDelete(id);

    console.log('Job deleted successfully:', id);

    sendResponse(res, 200, 'success', 'Job deleted successfully');

  } catch (error) {
    console.error('Delete job error:', error);
    return next(new AppError('Failed to delete job', 500));
  }
});

// Obtenir mes emplois (pour les employeurs)
const getMyJobs = catchAsync(async (req, res, next) => {
  console.log('Fetching jobs for user:', req.user._id);

  try {
    const {
      status = '',
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Filtre de base
    const filter = { postedBy: req.user._id };

    // Filtre par statut
    if (status) {
      filter.status = status;
    }

    // Construction du tri
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Requête
    const [jobs, totalResults] = await Promise.all([
      Job.find(filter)
        .populate('company', 'name logo')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Job.countDocuments(filter)
    ]);

    // Enrichir avec les statistiques
    const enrichedJobs = jobs.map(job => ({
      ...job,
      applicationsCount: job.applications?.length || 0,
      viewsCount: job.viewsCount || 0,
      timeAgo: getTimeAgo(job.createdAt)
    }));

    const pagination = getPaginationMeta(totalResults, pageNum, limitNum);

    sendResponse(res, 200, 'success', 'Your jobs retrieved successfully', {
      jobs: enrichedJobs,
      pagination
    });

  } catch (error) {
    console.error('Get my jobs error:', error);
    return next(new AppError('Failed to retrieve your jobs', 500));
  }
});

// Obtenir les emplois recommandés
const getRecommendedJobs = catchAsync(async (req, res, next) => {
  const { limit = 6 } = req.query;

  try {
    // Pour l'instant, retourner les emplois les plus récents
    // Dans une vraie application, on utiliserait l'IA/ML pour les recommandations
    const jobs = await Job.find({ status: 'active' })
      .populate('company', 'name logo location')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    const enrichedJobs = jobs.map(job => ({
      ...job,
      applicationsCount: job.applications?.length || 0,
      timeAgo: getTimeAgo(job.createdAt)
    }));

    sendResponse(res, 200, 'success', 'Recommended jobs retrieved successfully', {
      jobs: enrichedJobs
    });

  } catch (error) {
    console.error('Get recommended jobs error:', error);
    return next(new AppError('Failed to retrieve recommended jobs', 500));
  }
});

// Obtenir les statistiques des emplois
const getJobStats = catchAsync(async (req, res, next) => {
  try {
    const [
      totalJobs,
      activeJobs,
      totalApplications,
      jobsByType,
      jobsByCategory
    ] = await Promise.all([
      Job.countDocuments(),
      Job.countDocuments({ status: 'active' }),
      Job.aggregate([
        { $unwind: '$applications' },
        { $count: 'total' }
      ]),
      Job.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Job.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
    ]);

    const stats = {
      totalJobs,
      activeJobs,
      totalApplications: totalApplications[0]?.total || 0,
      jobsByType,
      topCategories: jobsByCategory
    };

    sendResponse(res, 200, 'success', 'Job statistics retrieved successfully', {
      stats
    });

  } catch (error) {
    console.error('Get job stats error:', error);
    return next(new AppError('Failed to retrieve job statistics', 500));
  }
});

// Fonction utilitaire pour calculer le temps écoulé
const getTimeAgo = (date) => {
  const now = new Date();
  const diff = now - new Date(date);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
};

module.exports = {
  getAllJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  getMyJobs,
  getRecommendedJobs,
  getJobStats
};