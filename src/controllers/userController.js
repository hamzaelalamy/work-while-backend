// controllers/userController.js
const User = require('../models/User');
const Job = require('../models/Job');
const { catchAsync, AppError, sendResponse, getPaginationMeta } = require('../utils/helpers');
const { userValidators } = require('../utils/validators');

// Obtenir tous les utilisateurs (Admin)
const getAllUsers = catchAsync(async (req, res, next) => {
  const users = await User.find({})
    .select('-password')
    .sort({ createdAt: -1 });

  sendResponse(res, 200, 'success', 'Users retrieved successfully', {
    data: users
  });
});

// Obtenir le profil de l'utilisateur
const getProfile = catchAsync(async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('savedJobs', 'title location type salary company')
      .populate({
        path: 'savedJobs',
        populate: {
          path: 'company',
          select: 'name logo'
        }
      });

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    sendResponse(res, 200, 'success', 'Profile retrieved successfully', {
      user
    });

  } catch (error) {
    console.error('Get profile error:', error);
    return next(new AppError('Failed to retrieve profile', 500));
  }
});

// Mettre à jour le profil de l'utilisateur
const updateProfile = catchAsync(async (req, res, next) => {
  try {
    // Filtrer les champs autorisés
    const allowedFields = ['firstName', 'lastName', 'profile'];
    const updates = {};

    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    );

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    sendResponse(res, 200, 'success', 'Profile updated successfully', {
      user
    });

  } catch (error) {
    console.error('Update profile error:', error);
    return next(new AppError('Failed to update profile', 500));
  }
});

// Obtenir les emplois sauvegardés
const getSavedJobs = catchAsync(async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    const user = await User.findById(req.user._id)
      .populate({
        path: 'savedJobs',
        populate: {
          path: 'company',
          select: 'name logo location'
        },
        options: {
          skip: (pageNum - 1) * limitNum,
          limit: limitNum,
          sort: { createdAt: -1 }
        }
      });

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Calculer le total pour la pagination
    const totalSavedJobs = user.savedJobs.length;
    const pagination = getPaginationMeta(totalSavedJobs, pageNum, limitNum);

    // Enrichir les emplois avec des informations supplémentaires
    const enrichedJobs = user.savedJobs.map(job => ({
      ...job.toObject(),
      saved: true,
      timeAgo: getTimeAgo(job.createdAt)
    }));

    sendResponse(res, 200, 'success', 'Saved jobs retrieved successfully', {
      savedJobs: enrichedJobs,
      pagination
    });

  } catch (error) {
    console.error('Get saved jobs error:', error);
    return next(new AppError('Failed to retrieve saved jobs', 500));
  }
});

// Sauvegarder un emploi
const saveJob = catchAsync(async (req, res, next) => {
  const { jobId } = req.params;

  try {
    // Vérifier que l'emploi existe
    const job = await Job.findById(jobId);
    if (!job) {
      return next(new AppError('Job not found', 404));
    }

    // Vérifier que l'emploi n'est pas déjà sauvegardé
    const user = await User.findById(req.user._id);
    if (user.savedJobs.includes(jobId)) {
      return next(new AppError('Job already saved', 409));
    }

    // Ajouter l'emploi aux favoris
    user.savedJobs.push(jobId);
    await user.save();

    sendResponse(res, 200, 'success', 'Job saved successfully', {
      jobId,
      saved: true
    });

  } catch (error) {
    console.error('Save job error:', error);
    return next(new AppError('Failed to save job', 500));
  }
});

// Retirer un emploi des favoris
const removeSavedJob = catchAsync(async (req, res, next) => {
  const { jobId } = req.params;

  try {
    const user = await User.findById(req.user._id);

    // Retirer l'emploi des favoris
    user.savedJobs = user.savedJobs.filter(id => id.toString() !== jobId);
    await user.save();

    sendResponse(res, 200, 'success', 'Job removed from saved jobs', {
      jobId,
      saved: false
    });

  } catch (error) {
    console.error('Remove saved job error:', error);
    return next(new AppError('Failed to remove saved job', 500));
  }
});

// Changer le mot de passe
const changePassword = catchAsync(async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Récupérer l'utilisateur avec le mot de passe
    const user = await User.findById(req.user._id).select('+password');

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Vérifier le mot de passe actuel
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return next(new AppError('Current password is incorrect', 400));
    }

    // Mettre à jour le mot de passe
    user.password = newPassword;
    await user.save();

    sendResponse(res, 200, 'success', 'Password changed successfully');

  } catch (error) {
    console.error('Change password error:', error);
    return next(new AppError('Failed to change password', 500));
  }
});

// Obtenir les statistiques de l'utilisateur
const getUserStats = catchAsync(async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate('savedJobs');

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Calculer les statistiques selon le rôle
    let stats = {
      profileCompleteness: calculateProfileCompleteness(user),
      savedJobsCount: user.savedJobs.length,
      accountAge: Math.floor((new Date() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24))
    };

    // Statistiques spécifiques aux candidats
    if (user.role === 'candidate') {
      const Application = require('../models/Application');
      const applications = await Application.find({ applicant: user._id });

      stats.applicationsCount = applications.length;
      stats.pendingApplications = applications.filter(app => app.status === 'pending').length;
      stats.shortlistedApplications = applications.filter(app => app.status === 'shortlisted').length;
    }

    // Statistiques spécifiques aux employeurs
    if (user.role === 'employer') {
      const myJobs = await Job.find({ postedBy: user._id });
      stats.postedJobsCount = myJobs.length;
      stats.activeJobsCount = myJobs.filter(job => job.status === 'active').length;
    }

    sendResponse(res, 200, 'success', 'User statistics retrieved successfully', {
      stats
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    return next(new AppError('Failed to retrieve user statistics', 500));
  }
});

// Supprimer le compte (soft delete)
const deleteAccount = catchAsync(async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        isActive: false,
        email: `deleted_${Date.now()}_${user.email}` // Éviter les conflits d'email
      },
      { new: true }
    );

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    sendResponse(res, 200, 'success', 'Account deactivated successfully');

  } catch (error) {
    console.error('Delete account error:', error);
    return next(new AppError('Failed to delete account', 500));
  }
});

// Fonction utilitaire pour calculer la complétude du profil
const calculateProfileCompleteness = (user) => {
  const fields = [
    user.firstName,
    user.lastName,
    user.email,
    user.profile?.phone,
    user.profile?.location,
    user.profile?.bio,
    user.profile?.skills?.length > 0,
    user.profile?.experience,
    user.profile?.education
  ];

  const completedFields = fields.filter(Boolean).length;
  return Math.round((completedFields / fields.length) * 100);
};

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
  getAllUsers,
  getProfile,
  updateProfile,
  getSavedJobs,
  saveJob,
  removeSavedJob,
  changePassword,
  getUserStats,
  deleteAccount
};