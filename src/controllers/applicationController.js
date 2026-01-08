// controllers/applicationController.js - VERSION SIMPLIFIÉE COMPATIBLE

const Application = require('../models/Application');
const Job = require('../models/Job');
const User = require('../models/User');
const { catchAsync, AppError, sendResponse } = require('../utils/helpers');

// =====================================
// CRÉER UNE NOUVELLE CANDIDATURE
// =====================================
const createApplication = catchAsync(async (req, res, next) => {
  console.log('\n📝 CREATE APPLICATION:');
  console.log('  User ID:', req.user._id);
  console.log('  User role:', req.user.role);
  console.log('  Job ID:', req.body.jobId);
  console.log('  Body keys:', Object.keys(req.body));
  console.log('  Files:', req.files ? Object.keys(req.files) : 'No files');

  // À ce point, les fichiers ont déjà été validés par le middleware uploadMiddleware
  // et les données ont été validées par validateApplicationWithFiles

  // Vérifier que l'utilisateur est un candidat
  if (req.user.role !== 'candidate') {
    console.log('  ❌ User is not a candidate:', req.user.role);
    return next(new AppError('Only candidates can submit applications', 403));
  }

  // Vérifier que le job existe
  console.log('  🔍 Checking if job exists...');
  const job = await Job.findById(req.body.jobId);
  if (!job) {
    console.log('  ❌ Job not found:', req.body.jobId);
    return next(new AppError('Job not found', 404));
  }

  console.log('  ✅ Job found:', job.title);

  // Vérifier si l'utilisateur a déjà postulé
  console.log('  🔍 Checking for existing application...');
  const existingApplication = await Application.findOne({
    applicant: req.user._id,
    job: req.body.jobId
  });

  if (existingApplication) {
    console.log('  ❌ User has already applied to this job');
    return next(new AppError('You have already applied to this job', 409));
  }

  console.log('  ✅ No existing application found');

  try {
    // Les données personnelles ont déjà été parsées par le middleware
    const personalInfo = req.body.personalInfo;
    console.log('  📋 Using parsed personal information:', {
      name: `${personalInfo.firstName} ${personalInfo.lastName}`,
      email: personalInfo.email
    });

    // Préparer les données de l'application
    const applicationData = {
      applicant: req.user._id,
      job: req.body.jobId,
      status: 'pending',
      personalInfo: {
        firstName: personalInfo.firstName.trim(),
        lastName: personalInfo.lastName.trim(),
        email: personalInfo.email.trim(),
        phone: personalInfo.phone.trim()
      }
    };

    // Ajouter la lettre de motivation si fournie
    if (req.body.coverLetter && req.body.coverLetter.trim()) {
      applicationData.coverLetter = req.body.coverLetter.trim();
      console.log('  ✅ Cover letter added');
    }

    // Ajouter le salaire attendu si fourni
    if (req.body.expectedSalary && !isNaN(req.body.expectedSalary)) {
      applicationData.expectedSalary = {
        amount: Number(req.body.expectedSalary),
        currency: 'MAD',
        period: 'monthly'
      };
      console.log('  ✅ Expected salary added:', applicationData.expectedSalary.amount);
    }

    // Ajouter la date de disponibilité si fournie
    if (req.body.availableFrom) {
      applicationData.availability = {
        startDate: new Date(req.body.availableFrom)
      };
      console.log('  ✅ Availability date added');
    }

    // ✅ TRAITEMENT DES FICHIERS (déjà uploadés par le middleware)
    console.log('  📁 Processing uploaded files...');

    // Traiter le CV (obligatoire)
    if (req.files && req.files.resume && req.files.resume[0]) {
      const resumeFile = req.files.resume[0];
      applicationData.resume = {
        filename: resumeFile.filename,
        originalName: resumeFile.originalname,
        mimetype: resumeFile.mimetype,
        size: resumeFile.size,
        url: `/uploads/resumes/${resumeFile.filename}`
      };
      console.log('  ✅ Resume file processed:', resumeFile.originalname);
    } else {
      console.log('  ❌ No resume file found');
      return next(new AppError('Resume file is required', 400));
    }

    // Traiter le portfolio (optionnel)
    if (req.files && req.files.portfolio && req.files.portfolio[0]) {
      const portfolioFile = req.files.portfolio[0];
      applicationData.additionalDocuments = [{
        filename: portfolioFile.filename,
        originalName: portfolioFile.originalname,
        mimetype: portfolioFile.mimetype,
        size: portfolioFile.size,
        url: `/uploads/portfolios/${portfolioFile.filename}`,
        type: 'portfolio'
      }];
      console.log('  ✅ Portfolio file processed:', portfolioFile.originalname);
    }

    // Traiter les documents additionnels (optionnels)
    if (req.files && req.files.additionalDocuments && req.files.additionalDocuments.length > 0) {
      if (!applicationData.additionalDocuments) {
        applicationData.additionalDocuments = [];
      }
      
      req.files.additionalDocuments.forEach(file => {
        applicationData.additionalDocuments.push({
          filename: file.filename,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          url: `/uploads/portfolios/${file.filename}`,
          type: 'other'
        });
      });
      console.log('  ✅ Additional documents processed:', req.files.additionalDocuments.length);
    }

    // Ajouter des informations supplémentaires si disponibles
    if (personalInfo.currentPosition) {
      applicationData.experience = {
        totalYears: personalInfo.totalExperience || 0,
        previousPositions: [{
          title: personalInfo.currentPosition,
          description: personalInfo.motivation || ''
        }]
      };
    }

    if (personalInfo.skills) {
      const skillsArray = personalInfo.skills.split(',').map(skill => skill.trim()).filter(Boolean);
      applicationData.skills = skillsArray.map(skill => ({
        name: skill,
        level: 'intermediate' // Valeur par défaut
      }));
    }

    console.log('  💾 Saving application to database...');
    console.log('  Application data summary:', {
      applicant: applicationData.applicant,
      job: applicationData.job,
      hasResume: !!applicationData.resume,
      hasPortfolio: !!applicationData.additionalDocuments?.length,
      coverLetterLength: applicationData.coverLetter?.length || 0
    });

    // Créer l'application
    const application = await Application.create(applicationData);
    console.log('  ✅ Application created successfully:', application._id);

    // Peupler les relations pour la réponse
    await application.populate([
      { path: 'applicant', select: 'firstName lastName email' },
      { path: 'job', select: 'title company location' }
    ]);

    console.log('  📤 Sending success response');

    sendResponse(res, 201, 'success', 'Application submitted successfully', {
      application: {
        _id: application._id,
        status: application.status,
        job: application.job,
        applicant: application.applicant,
        coverLetter: application.coverLetter,
        resume: application.resume,
        additionalDocuments: application.additionalDocuments,
        createdAt: application.createdAt
      }
    });

  } catch (error) {
    console.error('  ❌ Error creating application:', error);

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return next(new AppError(`Validation error: ${messages.join(', ')}`, 400));
    }

    return next(new AppError('Failed to submit application', 500));
  }
});

// =====================================
// OBTENIR MES CANDIDATURES
// =====================================
const getMyApplications = catchAsync(async (req, res, next) => {
  console.log('\n📋 GET MY APPLICATIONS:');
  console.log('  User ID:', req.user._id);
  console.log('  User role:', req.user.role);

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const status = req.query.status;

  console.log('  Query params:', { page, limit, status });

  // Construire la requête
  const query = { applicant: req.user._id };
  if (status) {
    query.status = status;
  }

  console.log('  Database query:', query);

  // Calculer le nombre total
  const totalApplications = await Application.countDocuments(query);
  console.log('  Total applications:', totalApplications);

  // Récupérer les candidatures avec pagination
  const applications = await Application.find(query)
    .populate({
      path: 'job',
      select: 'title company location type salary status',
      populate: {
        path: 'company',
        select: 'name logo'
      }
    })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  console.log('  Applications retrieved:', applications.length);

  sendResponse(res, 200, 'success', 'Applications retrieved successfully', {
    applications,
    pagination: {
      current: page,
      pages: Math.ceil(totalApplications / limit),
      total: totalApplications,
      limit
    }
  });
});

// =====================================
// OBTENIR LES CANDIDATURES POUR UN JOB (EMPLOYEURS)
// =====================================
const getJobApplications = catchAsync(async (req, res, next) => {
  console.log('\n📋 GET JOB APPLICATIONS:');
  console.log('  User ID:', req.user._id);
  console.log('  User role:', req.user.role);
  console.log('  Job ID:', req.params.jobId);

  // Vérifier que le job appartient à l'employeur ou que l'utilisateur est admin
  const job = await Job.findById(req.params.jobId);
  if (!job) {
    return next(new AppError('Job not found', 404));
  }

  if (req.user.role !== 'admin' && job.employer.toString() !== req.user._id.toString()) {
    return next(new AppError('You can only view applications for your own jobs', 403));
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const status = req.query.status;

  const query = { job: req.params.jobId };
  if (status) query.status = status;

  const totalApplications = await Application.countDocuments(query);

  const applications = await Application.find(query)
    .populate('applicant', 'firstName lastName email profile')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  console.log('  Job applications retrieved:', applications.length);

  sendResponse(res, 200, 'success', 'Job applications retrieved successfully', {
    applications,
    job: {
      _id: job._id,
      title: job.title,
      company: job.company
    },
    pagination: {
      current: page,
      pages: Math.ceil(totalApplications / limit),
      total: totalApplications,
      limit
    }
  });
});

// =====================================
// METTRE À JOUR LE STATUT D'UNE CANDIDATURE (EMPLOYEURS)
// =====================================
const updateApplicationStatus = catchAsync(async (req, res, next) => {
  console.log('\n📝 UPDATE APPLICATION STATUS:');
  console.log('  User ID:', req.user._id);
  console.log('  Application ID:', req.params.id);
  console.log('  New status:', req.body.status);

  const { status, notes } = req.body;

  const application = await Application.findById(req.params.id)
    .populate('job', 'employer');

  if (!application) {
    return next(new AppError('Application not found', 404));
  }

  // Vérifier les permissions
  if (req.user.role !== 'admin' && 
      application.job.employer.toString() !== req.user._id.toString()) {
    return next(new AppError('You can only update applications for your own jobs', 403));
  }

  // Mettre à jour le statut
  await application.updateStatus(status, notes, req.user._id);

  console.log('  ✅ Application status updated');

  sendResponse(res, 200, 'success', 'Application status updated successfully', {
    application
  });
});

// =====================================
// RETIRER UNE CANDIDATURE (CANDIDATS)
// =====================================
const withdrawApplication = catchAsync(async (req, res, next) => {
  console.log('\n🔄 WITHDRAW APPLICATION:');
  console.log('  User ID:', req.user._id);
  console.log('  Application ID:', req.params.id);

  const application = await Application.findById(req.params.id);

  if (!application) {
    return next(new AppError('Application not found', 404));
  }

  // Vérifier que l'application appartient à l'utilisateur
  if (application.applicant.toString() !== req.user._id.toString()) {
    return next(new AppError('You can only withdraw your own applications', 403));
  }

  // Vérifier que l'application peut être retirée
  if (['offered', 'rejected', 'withdrawn'].includes(application.status)) {
    return next(new AppError('This application cannot be withdrawn', 400));
  }

  // Retirer l'application
  await application.updateStatus('withdrawn', 'Application withdrawn by candidate');

  console.log('  ✅ Application withdrawn');

  sendResponse(res, 200, 'success', 'Application withdrawn successfully', {
    application
  });
});

// =====================================
// OBTENIR LES STATISTIQUES DES CANDIDATURES
// =====================================
const getApplicationStats = catchAsync(async (req, res, next) => {
  console.log('\n📊 GET APPLICATION STATS:');
  console.log('  User ID:', req.user._id);
  console.log('  User role:', req.user.role);

  let stats;

  if (req.user.role === 'candidate') {
    // Statistiques pour les candidats
    const applications = await Application.find({ applicant: req.user._id });
    
    stats = {
      total: applications.length,
      pending: applications.filter(app => app.status === 'pending').length,
      reviewing: applications.filter(app => app.status === 'reviewing').length,
      shortlisted: applications.filter(app => app.status === 'shortlisted').length,
      interviewed: applications.filter(app => app.status === 'interviewed').length,
      offered: applications.filter(app => app.status === 'offered').length,
      rejected: applications.filter(app => app.status === 'rejected').length,
      withdrawn: applications.filter(app => app.status === 'withdrawn').length
    };
  } else {
    // Statistiques pour les employeurs/admins
    const query = req.user.role === 'admin' ? {} : {};
    
    // Pour les employeurs, filtrer par leurs jobs
    if (req.user.role === 'employer') {
      const userJobs = await Job.find({ employer: req.user._id });
      const jobIds = userJobs.map(job => job._id);
      query.job = { $in: jobIds };
    }

    const statsData = await Application.getApplicationStats(query);
    stats = statsData[0] || {
      totalApplications: 0,
      pendingApplications: 0,
      reviewingApplications: 0,
      shortlistedApplications: 0,
      rejectedApplications: 0
    };
  }

  console.log('  Stats calculated:', stats);

  sendResponse(res, 200, 'success', 'Application statistics retrieved successfully', {
    stats
  });
});

// =====================================
// EXPORTS
// =====================================
module.exports = {
  createApplication,
  getMyApplications,
  getJobApplications,
  updateApplicationStatus,
  withdrawApplication,
  getApplicationStats
};