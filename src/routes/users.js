// routes/users.js
const express = require('express');
const userController = require('../controllers/userController');
const { auth, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { userValidators } = require('../utils/validators');

const router = express.Router();

// Toutes les routes nécessitent une authentification
router.use(auth);

// Route de test
router.get('/test', (req, res) => {
  res.json({ 
    message: 'User routes are working!', 
    timestamp: new Date(),
    user: {
      id: req.user._id,
      role: req.user.role,
      email: req.user.email
    },
    endpoints: [
      'GET /users/profile - Get user profile',
      'PUT /users/profile - Update user profile',
      'GET /users/saved-jobs - Get saved jobs',
      'POST /users/save-job/:jobId - Save a job',
      'DELETE /users/save-job/:jobId - Remove saved job',
      'PUT /users/change-password - Change password',
      'GET /users/stats - Get user statistics',
      'DELETE /users/profile - Delete account'
    ]
  });
});

// Routes du profil utilisateur

// Obtenir le profil utilisateur
router.get('/profile', userController.getProfile);

// Mettre à jour le profil utilisateur
router.put('/profile', 
  validate(userValidators.updateProfile),
  userController.updateProfile
);

// Supprimer le compte
router.delete('/profile', userController.deleteAccount);

// Routes des emplois sauvegardés

// Obtenir les emplois sauvegardés
router.get('/saved-jobs', userController.getSavedJobs);

// Sauvegarder un emploi
router.post('/save-job/:jobId', userController.saveJob);

// Retirer un emploi des favoris
router.delete('/save-job/:jobId', userController.removeSavedJob);

// Routes de sécurité

// Changer le mot de passe
router.put('/change-password',
  validate(userValidators.changePassword || {
    validate: (data) => {
      const errors = [];
      if (!data.currentPassword) errors.push('Current password is required');
      if (!data.newPassword) errors.push('New password is required');
      if (data.newPassword && data.newPassword.length < 8) errors.push('New password must be at least 8 characters');
      return { error: errors.length > 0 ? { details: errors.map(e => ({ message: e })) } : null };
    }
  }),
  userController.changePassword
);

// Routes des statistiques

// Obtenir les statistiques utilisateur
router.get('/stats', userController.getUserStats);

module.exports = router;