// middleware/uploadMiddleware.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Créer le dossier uploads s'il n'existe pas
const uploadsDir = path.join(__dirname, '../uploads');
const resumesDir = path.join(uploadsDir, 'resumes');
const portfoliosDir = path.join(uploadsDir, 'portfolios');

[uploadsDir, resumesDir, portfoliosDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configuration du stockage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadPath = uploadsDir;
    
    // Déterminer le dossier selon le type de fichier
    if (file.fieldname === 'resume') {
      uploadPath = resumesDir;
    } else if (file.fieldname === 'portfolio' || file.fieldname === 'additionalDocuments') {
      uploadPath = portfoliosDir;
    }
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Générer un nom unique pour le fichier
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const filename = `${file.fieldname}-${uniqueSuffix}${extension}`;
    
    cb(null, filename);
  }
});

// Validation des fichiers
const fileFilter = (req, file, cb) => {
  console.log('Validating file:', file.fieldname, file.originalname, file.mimetype);
  
  // Types MIME autorisés
  const allowedMimeTypes = {
    resume: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ],
    portfolio: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/zip',
      'application/x-zip-compressed',
      'application/x-rar-compressed',
      'image/jpeg',
      'image/png'
    ],
    additionalDocuments: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/zip',
      'application/x-zip-compressed',
      'application/x-rar-compressed',
      'image/jpeg',
      'image/png'
    ]
  };
  
  // Extensions autorisées
  const allowedExtensions = {
    resume: ['.pdf', '.doc', '.docx'],
    portfolio: ['.pdf', '.doc', '.docx', '.zip', '.rar', '.jpg', '.jpeg', '.png'],
    additionalDocuments: ['.pdf', '.doc', '.docx', '.zip', '.rar', '.jpg', '.jpeg', '.png']
  };
  
  const fileExtension = path.extname(file.originalname).toLowerCase();
  const fieldAllowedTypes = allowedMimeTypes[file.fieldname] || [];
  const fieldAllowedExtensions = allowedExtensions[file.fieldname] || [];
  
  // Vérifier le type MIME ET l'extension
  const isMimeTypeValid = fieldAllowedTypes.includes(file.mimetype);
  const isExtensionValid = fieldAllowedExtensions.includes(fileExtension);
  
  if (isMimeTypeValid && isExtensionValid) {
    cb(null, true);
  } else {
    const error = new Error(
      `Invalid file type for ${file.fieldname}. Allowed types: ${fieldAllowedExtensions.join(', ')}`
    );
    error.code = 'INVALID_FILE_TYPE';
    cb(error, false);
  }
};

// Configuration de multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
    files: 3 // Maximum 3 fichiers (resume + portfolio + additionalDocuments)
  },
  fileFilter: fileFilter
});

// CV upload for job matching: memory storage so we get buffer for text extraction
const cvStorage = multer.memoryStorage();
const cvFileFilter = (req, file, cb) => {
  const allowed = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(file.mimetype) && ['.pdf', '.doc', '.docx'].includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('CV must be PDF or DOCX'), false);
  }
};
const uploadCV = multer({
  storage: cvStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: cvFileFilter
}).single('cv');

// Middleware pour gérer les uploads d'application - supporte les deux noms de champs
const uploadApplicationFiles = upload.fields([
  { name: 'resume', maxCount: 1 },
  { name: 'portfolio', maxCount: 1 },
  { name: 'additionalDocuments', maxCount: 5 }
]);

// Middleware pour gérer les erreurs de multer
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    let message = 'File upload error';
    
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File size too large. Maximum size is 5MB.';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files. Maximum files allowed per field exceeded.';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = `Unexpected file field: ${error.field}. Expected fields: resume, portfolio`;
        break;
      default:
        message = error.message;
    }
    
    return res.status(400).json({
      status: 'error',
      message: message
    });
  } else if (error && error.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
  
  next(error);
};

// Middleware pour nettoyer les fichiers en cas d'erreur
const cleanupFiles = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Si la réponse est une erreur, supprimer les fichiers uploadés
    if (res.statusCode >= 400 && req.files) {
      Object.values(req.files).flat().forEach(file => {
        fs.unlink(file.path, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      });
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

// Utilitaire pour supprimer un fichier
const deleteFile = (filePath) => {
  return new Promise((resolve, reject) => {
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error('Error deleting file:', err);
        reject(err);
      } else {
        console.log('File deleted successfully:', filePath);
        resolve();
      }
    });
  });
};

// Utilitaire pour obtenir l'URL publique d'un fichier
const getFileUrl = (filename, type) => {
  const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
  return `${baseUrl}/uploads/${type}/${filename}`;
};

// Middleware pour servir les fichiers statiques avec authentification
const serveProtectedFile = (req, res, next) => {
  const { type, filename } = req.params;
  const allowedTypes = ['resumes', 'portfolios'];
  
  if (!allowedTypes.includes(type)) {
    return res.status(404).json({ message: 'File type not found' });
  }
  
  const filePath = path.join(uploadsDir, type, filename);
  
  // Vérifier que le fichier existe
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'File not found' });
  }
  
  // TODO: Ajouter une vérification d'autorisation
  // Vérifier que l'utilisateur a le droit d'accéder à ce fichier
  
  res.sendFile(filePath);
};

// Middleware pour valider les données d'application avec fichiers
const validateApplicationWithFiles = (req, res, next) => {
  try {
    // Parser les données JSON si elles existent
    if (req.body.personalInfo) {
      try {
        req.body.personalInfo = JSON.parse(req.body.personalInfo);
      } catch (error) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid JSON format for personalInfo'
        });
      }
    }
    
    // Valider que les champs requis sont présents
    const requiredFields = ['jobId', 'personalInfo'];
    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res.status(400).json({
          status: 'error',
          message: `${field} is required`
        });
      }
    }
    
    // Valider que le CV est présent
    if (!req.files || !req.files.resume || req.files.resume.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Resume file is required'
      });
    }
    
    // Valider les informations personnelles
    const { personalInfo } = req.body;
    const requiredPersonalFields = ['firstName', 'lastName', 'email', 'phone'];
    
    for (const field of requiredPersonalFields) {
      if (!personalInfo[field] || !personalInfo[field].trim()) {
        return res.status(400).json({
          status: 'error',
          message: `${field} is required in personal information`
        });
      }
    }
    
    // Valider l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(personalInfo.email)) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide a valid email address'
      });
    }
    
    next();
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Validation error occurred'
    });
  }
};

module.exports = {
  uploadApplicationFiles,
  uploadCV,
  handleUploadError,
  cleanupFiles,
  deleteFile,
  getFileUrl,
  serveProtectedFile,
  validateApplicationWithFiles
};