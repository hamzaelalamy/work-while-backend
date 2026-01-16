const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');
const searchController = require('../controllers/searchController');
const { auth, authorize, optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { jobValidators } = require('../utils/validators');

// Route de test
router.get('/test', (req, res) => {
  res.json({
    message: 'Job routes are working!',
    timestamp: new Date(),
    endpoints: [
      'GET /jobs - Get all jobs',
      'GET /jobs/:id - Get job by ID',
      'POST /jobs - Create job (auth required)',
      'PUT /jobs/:id - Update job (auth required)',
      'DELETE /jobs/:id - Delete job (auth required)',
      'GET /jobs/my/jobs - Get my jobs (auth required)',
      'GET /jobs/recommended - Get recommended jobs',
      'GET /jobs/stats - Get job statistics'
    ]
  });
});

// Routes publiques (pas d'authentification requise)

// Obtenir tous les emplois avec filtres et pagination
router.get('/', optionalAuth, jobController.getAllJobs);

// Obtenir les emplois recommandés
router.get('/recommended', jobController.getRecommendedJobs);

// Obtenir les statistiques des emplois
router.get('/stats', jobController.getJobStats);

// Nouvelle route pour la recherche sémantique (ajoutée avant /:id pour éviter les collisions)
router.get('/search/semantic', searchController.searchJobs); // Added new route

// Route ADMIN pour régénérer les embeddings
router.post(
  '/admin/regenerate-embeddings',
  auth,
  authorize('admin'),
  searchController.generateEmbeddings
);

// Obtenir un emploi par ID
router.get('/:id', optionalAuth, jobController.getJobById);

// Routes protégées (authentification requise)

// Obtenir mes emplois (pour les employeurs)
router.get('/my/jobs', auth, authorize('employer', 'admin'), jobController.getMyJobs);

// Créer un nouvel emploi
router.post('/',
  auth,
  authorize('employer', 'admin'),
  validate(jobValidators.createJob),
  jobController.createJob
);

// Mettre à jour un emploi
router.put('/:id',
  auth,
  authorize('employer', 'admin'),
  validate(jobValidators.updateJob),
  jobController.updateJob
);

// Supprimer un emploi
router.delete('/:id',
  auth,
  authorize('employer', 'admin'),
  jobController.deleteJob
);

module.exports = router;