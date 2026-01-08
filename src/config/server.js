// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
require('dotenv').config();

// Import des routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const jobRoutes = require('./routes/jobs');
const applicationRoutes = require('./routes/applications');
const companyRoutes = require('./routes/companies');

// Import des middlewares
const { globalErrorHandler } = require('./middleware/errorHandler');
const { auth } = require('./middleware/auth');

const app = express();

// Configuration de sécurité
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" } // Permet l'accès aux fichiers uploadés
}));

// Compression des réponses
app.use(compression());

// Configuration CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Rate limiting spécifique pour les uploads
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limite à 10 uploads par IP toutes les 15 minutes
  message: 'Too many file uploads, please try again later.'
});
app.use('/api/applications', uploadLimiter);

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir les fichiers statiques depuis le dossier uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  // Configuration pour les fichiers statiques
  maxAge: '1h',
  etag: false,
  // Ajouter des headers de sécurité
  setHeaders: (res, path) => {
    // Empêcher l'exécution de scripts
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
    
    // Permettre seulement certains types de fichiers
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.zip', '.rar'];
    const fileExtension = path.substring(path.lastIndexOf('.')).toLowerCase();
    
    if (!allowedExtensions.includes(fileExtension)) {
      res.status(403).end();
      return;
    }
  }
}));

// Middleware de logging pour le développement
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    if (req.body && Object.keys(req.body).length > 0) {
      console.log('Body:', JSON.stringify(req.body, null, 2));
    }
    if (req.files) {
      console.log('Files:', Object.keys(req.files));
    }
    next();
  });
}

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/companies', companyRoutes);

// Route de test
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: '1.0.0'
  });
});

// Route pour tester les uploads (développement uniquement)
if (process.env.NODE_ENV === 'development') {
  const multer = require('multer');
  const upload = multer({ dest: 'uploads/test/' });
  
  app.post('/api/test-upload', upload.single('file'), (req, res) => {
    res.json({
      message: 'File uploaded successfully',
      file: req.file,
      body: req.body
    });
  });
}

// Middleware pour servir les fichiers de l'application React en production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
}

// Gestion des routes non trouvées
app.all('*', (req, res, next) => {
  const error = new Error(`Route ${req.originalUrl} not found`);
  error.status = 404;
  next(error);
});

// Gestionnaire d'erreurs global
app.use(globalErrorHandler);

// Connexion à MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Créer les index nécessaires
    await createIndexes();
    
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

// Création des index pour optimiser les performances
const createIndexes = async () => {
  try {
    const Application = require('./models/Application');
    const Job = require('./models/Job');
    const User = require('./models/User');
    
    // Index pour les applications
    await Application.createIndexes();
    console.log('Application indexes created');
    
    // Index pour les emplois
    await Job.createIndexes();
    console.log('Job indexes created');
    
    // Index pour les utilisateurs
    await User.createIndexes();
    console.log('User indexes created');
    
  } catch (error) {
    console.error('Error creating indexes:', error);
  }
};

// Gestion des signaux pour un arrêt propre
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    mongoose.connection.close(() => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    mongoose.connection.close(() => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Démarrage du serveur
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
    console.log(`API Documentation: http://localhost:${PORT}/api/health`);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`Upload test endpoint: http://localhost:${PORT}/api/test-upload`);
      console.log(`Uploads served at: http://localhost:${PORT}/uploads/`);
    }
  });
  
  return server;
};

// Exporter pour les tests
module.exports = { app, startServer };

// Démarrer le serveur si ce fichier est exécuté directement
if (require.main === module) {
  startServer();
}