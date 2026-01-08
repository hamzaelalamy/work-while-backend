// routes/applications.js - SOLUTION FINALE CORRIGÉE

const express = require('express');
const applicationController = require('../controllers/applicationController');
const { auth, authorize } = require('../middleware/auth');
const { 
  uploadApplicationFiles, 
  handleUploadError, 
  cleanupFiles, 
  validateApplicationWithFiles 
} = require('../middleware/uploadMiddleware'); // ✅ Utiliser votre middleware existant

const router = express.Router();

// =====================================
// MIDDLEWARE GLOBAL
// =====================================
router.use(auth); // Toutes les routes nécessitent une authentification

// =====================================
// ROUTE DE TEST
// =====================================
router.get('/test', (req, res) => {
  console.log('\n🧪 APPLICATION ROUTES TEST:');
  console.log('  User ID:', req.user._id);
  console.log('  User role:', req.user.role);
  console.log('  User email:', req.user.email);
  
  res.json({ 
    success: true,
    message: 'Application routes are working!', 
    timestamp: new Date().toISOString(),
    user: {
      id: req.user._id,
      role: req.user.role,
      email: req.user.email,
      name: `${req.user.firstName} ${req.user.lastName}`
    },
    endpoints: [
      'GET /applications/test - Test endpoint',
      'GET /applications/my - Get my applications (candidate)',
      'POST /applications - Create application (candidate)',
      'GET /applications/job/:jobId - Get job applications (employer)',
      'PUT /applications/:id/status - Update application status (employer)',
      'PUT /applications/:id/withdraw - Withdraw application (candidate)',
      'GET /applications/stats - Get application statistics'
    ]
  });
});

// =====================================
// ROUTES POUR LES CANDIDATS
// =====================================

// Obtenir mes candidatures
router.get('/my', 
  authorize('candidate', 'admin'), 
  applicationController.getMyApplications
);

// ✅ ROUTE CORRIGÉE: Créer une nouvelle candidature avec upload de fichiers
router.post('/', 
  authorize('candidate', 'admin'),
  cleanupFiles, // Middleware de nettoyage en cas d'erreur
  (req, res, next) => {
    console.log('\n📁 PROCESSING FILE UPLOAD FOR APPLICATION:');
    console.log('  User:', req.user.email);
    console.log('  Content-Type:', req.headers['content-type']);
    console.log('  Content-Length:', req.headers['content-length']);
    
    // ✅ CORRECTION CRITIQUE: Utiliser le middleware d'upload existant
    uploadApplicationFiles(req, res, (err) => {
      if (err) {
        console.error('  ❌ Upload error:', err.message);
        return handleUploadError(err, req, res, next);
      }
      
      console.log('  ✅ Files uploaded successfully');
      console.log('  Files received:', req.files ? Object.keys(req.files) : 'No files');
      
      // Log détaillé des fichiers reçus
      if (req.files) {
        Object.entries(req.files).forEach(([fieldName, files]) => {
          files.forEach(file => {
            console.log(`    ${fieldName}:`, {
              originalname: file.originalname,
              filename: file.filename,
              size: file.size,
              mimetype: file.mimetype,
              path: file.path
            });
          });
        });
      }
      
      next();
    });
  },
  validateApplicationWithFiles, // ✅ Utiliser la validation du middleware
  applicationController.createApplication
);

// Retirer une candidature
router.put('/:id/withdraw',
  authorize('candidate', 'admin'),
  applicationController.withdrawApplication
);

// =====================================
// ROUTES POUR LES EMPLOYEURS
// =====================================

// Obtenir les candidatures pour un job spécifique
router.get('/job/:jobId',
  authorize('employer', 'admin'),
  applicationController.getJobApplications
);

// Mettre à jour le statut d'une candidature
router.put('/:id/status',
  authorize('employer', 'admin'),
  (req, res, next) => {
    // Validation simple du statut
    const allowedStatuses = [
      'pending', 'reviewing', 'shortlisted', 
      'interviewed', 'offered', 'rejected'
    ];
    
    if (req.body.status && !allowedStatuses.includes(req.body.status)) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid status. Allowed values: ${allowedStatuses.join(', ')}`
      });
    }
    
    next();
  },
  applicationController.updateApplicationStatus
);

// =====================================
// ROUTES COMMUNES
// =====================================

// Obtenir les statistiques des candidatures
router.get('/stats',
  applicationController.getApplicationStats
);

// =====================================
// ROUTE DE DEBUG POUR TESTER L'UPLOAD (DÉVELOPPEMENT UNIQUEMENT)
// =====================================
if (process.env.NODE_ENV === 'development') {
  router.post('/test-upload',
    authorize('candidate', 'admin'),
    cleanupFiles,
    (req, res, next) => {
      console.log('\n🧪 TEST UPLOAD ENDPOINT:');
      console.log('  Content-Type:', req.headers['content-type']);
      console.log('  Body keys (before multer):', Object.keys(req.body));
      
      uploadApplicationFiles(req, res, (err) => {
        if (err) {
          console.error('  ❌ Test upload error:', err);
          return handleUploadError(err, req, res, next);
        }
        
        console.log('  ✅ Test upload successful');
        console.log('  Body keys (after multer):', Object.keys(req.body));
        console.log('  Files received:', req.files);
        
        res.json({
          success: true,
          message: 'Test upload successful',
          body: req.body,
          files: req.files ? Object.keys(req.files) : 'No files',
          fileDetails: req.files ? Object.entries(req.files).map(([key, files]) => ({
            field: key,
            files: files.map(file => ({
              originalname: file.originalname,
              filename: file.filename,
              size: file.size,
              mimetype: file.mimetype,
              path: file.path
            }))
          })) : []
        });
      });
    }
  );
}

// =====================================
// GESTION D'ERREURS 404
// =====================================
router.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Application route not found: ${req.originalUrl}`,
    availableRoutes: [
      'GET /applications/test',
      'GET /applications/my',
      'POST /applications',
      'GET /applications/job/:jobId',
      'PUT /applications/:id/status',
      'PUT /applications/:id/withdraw',
      'GET /applications/stats'
    ]
  });
});

module.exports = router;