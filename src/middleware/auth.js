// middleware/auth.js - VERSION COMPLÈTE CORRIGÉE
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError, catchAsync } = require('../utils/helpers');

// =====================================
// MIDDLEWARE D'AUTHENTIFICATION PRINCIPAL
// =====================================
const auth = catchAsync(async (req, res, next) => {
  console.log('\n🔐 AUTH MIDDLEWARE DEBUG:');
  console.log('  📍 Path:', req.path);
  console.log('  📋 Method:', req.method);
  console.log('  🕐 Timestamp:', new Date().toISOString());
  
  // 1. Récupérer le token depuis les headers
  let token;
  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
    console.log('  ✅ Token found in Authorization header');
    console.log('  📏 Token length:', token.length);
    console.log('  🔤 Token preview:', token.substring(0, 20) + '...');
  } else {
    console.log('  ❌ No Authorization header found');
    console.log('  📋 Available headers:', Object.keys(req.headers));
    console.log('  🔍 Authorization header value:', req.headers.authorization || 'MISSING');
  }

  if (!token) {
    console.log('  ❌ AUTHENTICATION FAILED: No token provided');
    return next(new AppError('Access token is required. Please log in.', 401));
  }

  try {
    console.log('  🔍 Verifying JWT token...');
    
    // 2. Vérifier le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('  ✅ Token verified successfully');
    console.log('  📦 Decoded payload:', {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      iat: decoded.iat ? new Date(decoded.iat * 1000) : 'Not provided',
      exp: decoded.exp ? new Date(decoded.exp * 1000) : 'Not provided'
    });
    
    // Vérifier l'expiration
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < now) {
      console.log('  ❌ Token has expired');
      return next(new AppError('Your token has expired. Please log in again.', 401));
    }
    
    // 3. Vérifier si l'utilisateur existe toujours
    // ✅ CORRECTION CRITIQUE: Utiliser decoded.id qui correspond au token généré
    const userId = decoded.id;
    console.log('  🔍 Looking up user with ID:', userId);
    
    const currentUser = await User.findById(userId).select('+isActive');
    
    if (!currentUser) {
      console.log('  ❌ User not found in database with ID:', userId);
      return next(new AppError('The user belonging to this token no longer exists.', 401));
    }

    console.log('  ✅ User found in database:', {
      id: currentUser._id,
      email: currentUser.email,
      role: currentUser.role,
      firstName: currentUser.firstName,
      lastName: currentUser.lastName,
      isActive: currentUser.isActive,
      emailVerified: currentUser.emailVerified
    });

    // 4. Vérifier si l'utilisateur est actif
    if (!currentUser.isActive) {
      console.log('  ❌ User account is deactivated');
      return next(new AppError('Your account has been deactivated. Please contact support.', 401));
    }

    // 5. Vérifier si l'email est vérifié (optionnel selon vos besoins)
    if (process.env.REQUIRE_EMAIL_VERIFICATION === 'true' && !currentUser.emailVerified) {
      console.log('  ⚠️  Email not verified but continuing...');
      // Uncomment if you want to enforce email verification:
      // return next(new AppError('Please verify your email address before proceeding.', 403));
    }

    // 6. Attacher l'utilisateur à la requête
    req.user = currentUser;
    console.log('  ✅ AUTHENTICATION SUCCESSFUL');
    console.log('  👤 User attached to request:', {
      id: req.user._id,
      email: req.user.email,
      role: req.user.role,
      name: `${req.user.firstName} ${req.user.lastName}`
    });
    
    next();
    
  } catch (error) {
    console.log('  ❌ Token verification failed:', error.name, '-', error.message);
    
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token. Please log in again.', 401));
    } else if (error.name === 'TokenExpiredError') {
      return next(new AppError('Your token has expired. Please log in again.', 401));
    } else if (error.name === 'NotBeforeError') {
      return next(new AppError('Token not active yet. Please log in again.', 401));
    }
    
    console.error('  🚨 Unexpected authentication error:', error);
    return next(new AppError('Authentication failed. Please log in again.', 401));
  }
});

// =====================================
// MIDDLEWARE D'AUTORISATION PAR RÔLE
// =====================================
const authorize = (...roles) => {
  return (req, res, next) => {
    console.log('\n🔒 AUTHORIZATION CHECK:');
    console.log('  📋 Required roles:', roles);
    console.log('  👤 User present in request:', !!req.user);
    
    if (!req.user) {
      console.log('  ❌ AUTHORIZATION FAILED: No user in request object');
      console.log('  💡 This usually means the auth middleware was not called first');
      return next(new AppError('Authentication required.', 401));
    }

    console.log('  👤 Current user details:', {
      id: req.user._id,
      email: req.user.email,
      role: req.user.role,
      isActive: req.user.isActive,
      name: `${req.user.firstName} ${req.user.lastName}`
    });

    // ✅ CORRECTION: Vérification de rôle stricte et claire
    const userRole = req.user.role;
    const allowedRoles = roles;
    
    console.log('  🔍 Role check details:');
    console.log('    User role:', `"${userRole}"`);
    console.log('    User role type:', typeof userRole);
    console.log('    Allowed roles:', allowedRoles);
    console.log('    Is role in allowed list?', allowedRoles.includes(userRole));

    // Vérifier si le rôle de l'utilisateur est dans la liste des rôles autorisés
    if (!allowedRoles.includes(userRole)) {
      console.log('  ❌ AUTHORIZATION FAILED');
      console.log('    ❌ User role "' + userRole + '" is NOT in allowed roles:', allowedRoles);
      console.log('    💡 User needs one of these roles:', allowedRoles.join(', '));
      
      return next(new AppError(
        `You do not have permission to perform this action. Required: ${roles.join(' or ')}, Your role: ${userRole}`, 
        403
      ));
    }

    console.log('  ✅ AUTHORIZATION SUCCESSFUL');
    console.log('    ✅ User role "' + userRole + '" is authorized');
    next();
  };
};

// =====================================
// MIDDLEWARE D'AUTHENTIFICATION OPTIONNEL
// =====================================
const optionalAuth = catchAsync(async (req, res, next) => {
  console.log('\n🔓 OPTIONAL AUTH CHECK:');
  
  let token;
  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
    console.log('  🔍 Token found, attempting authentication...');
  } else {
    console.log('  ℹ️  No token provided, continuing without authentication');
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    const currentUser = await User.findById(userId).select('+isActive');
    
    if (currentUser && currentUser.isActive) {
      req.user = currentUser;
      console.log('  ✅ Optional auth successful for user:', currentUser.email);
    } else {
      console.log('  ⚠️  User not found or inactive, continuing without auth');
    }
    
    next();
    
  } catch (error) {
    console.log('  ⚠️  Optional auth failed, continuing without authentication:', error.message);
    next();
  }
});

// =====================================
// MIDDLEWARE DE VÉRIFICATION DE PROPRIÉTÉ
// =====================================
const checkOwnership = (model, paramName = 'id', userField = 'user') => {
  return catchAsync(async (req, res, next) => {
    console.log('\n🔐 OWNERSHIP CHECK:');
    
    const resourceId = req.params[paramName];
    console.log('  📋 Resource ID:', resourceId);
    console.log('  📋 Model:', model);
    console.log('  👤 Current user:', req.user._id);
    
    if (!resourceId) {
      return next(new AppError('Resource ID is required.', 400));
    }

    const Model = require(`../models/${model}`);
    const resource = await Model.findById(resourceId);
    
    if (!resource) {
      console.log('  ❌ Resource not found');
      return next(new AppError(`${model} not found.`, 404));
    }

    // Vérifier la propriété
    const resourceUserId = resource[userField];
    const currentUserId = req.user._id;
    
    console.log('  🔍 Ownership check:');
    console.log('    Resource owner:', resourceUserId);
    console.log('    Current user:', currentUserId);
    console.log('    User role:', req.user.role);
    
    const isOwner = resourceUserId.toString() === currentUserId.toString();
    const isAdmin = req.user.role === 'admin';
    
    if (!isOwner && !isAdmin) {
      console.log('  ❌ OWNERSHIP CHECK FAILED');
      return next(new AppError('You can only access your own resources.', 403));
    }

    console.log('  ✅ OWNERSHIP CHECK PASSED');
    // Attacher la ressource à la requête pour éviter une nouvelle requête
    req.resource = resource;
    
    next();
  });
};

// =====================================
// MIDDLEWARE DE LIMITATION DE TENTATIVES DE CONNEXION
// =====================================
const loginLimiter = (req, res, next) => {
  console.log('\n🚦 LOGIN RATE LIMIT CHECK:');
  
  // Implémentation simple basée sur l'IP
  // En production, utiliser Redis pour un stockage distribué
  
  const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
  const windowMs = parseInt(process.env.LOGIN_WINDOW_MS) || 15 * 60 * 1000; // 15 minutes
  
  const clientIp = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
  const key = `login_attempts_${clientIp}`;
  
  console.log('  🌐 Client IP:', clientIp);
  console.log('  📊 Max attempts:', maxAttempts);
  console.log('  ⏰ Window:', windowMs / 1000, 'seconds');
  
  // Simuler un stockage en mémoire (en production, utiliser Redis)
  if (!global.loginAttempts) {
    global.loginAttempts = new Map();
  }
  
  const attempts = global.loginAttempts.get(key);
  const now = Date.now();
  
  if (attempts && attempts.count >= maxAttempts) {
    if (now - attempts.firstAttempt < windowMs) {
      const remainingTime = Math.ceil((windowMs - (now - attempts.firstAttempt)) / 60000);
      console.log('  ❌ Rate limit exceeded for IP:', clientIp);
      console.log('  ⏰ Remaining time:', remainingTime, 'minutes');
      
      return next(new AppError(
        `Too many login attempts. Please try again in ${remainingTime} minutes.`, 
        429
      ));
    } else {
      // Réinitialiser après la fenêtre de temps
      console.log('  🔄 Resetting rate limit for IP:', clientIp);
      global.loginAttempts.delete(key);
    }
  }
  
  console.log('  ✅ Rate limit check passed');
  next();
};

// =====================================
// MIDDLEWARE POUR ENREGISTRER LES ÉCHECS DE CONNEXION
// =====================================
const recordFailedLogin = (req, res, next) => {
  console.log('\n📝 RECORDING FAILED LOGIN ATTEMPT:');
  
  const clientIp = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
  const key = `login_attempts_${clientIp}`;
  
  if (!global.loginAttempts) {
    global.loginAttempts = new Map();
  }
  
  const attempts = global.loginAttempts.get(key);
  const now = Date.now();
  
  if (!attempts) {
    global.loginAttempts.set(key, {
      count: 1,
      firstAttempt: now,
      lastAttempt: now
    });
    console.log('  📝 First failed attempt recorded for IP:', clientIp);
  } else {
    attempts.count += 1;
    attempts.lastAttempt = now;
    global.loginAttempts.set(key, attempts);
    console.log('  📝 Failed attempt #' + attempts.count + ' recorded for IP:', clientIp);
  }
  
  next();
};

// =====================================
// MIDDLEWARE POUR RÉINITIALISER LES TENTATIVES APRÈS SUCCÈS
// =====================================
const resetLoginAttempts = (req, res, next) => {
  console.log('\n🔄 RESETTING LOGIN ATTEMPTS:');
  
  const clientIp = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
  const key = `login_attempts_${clientIp}`;
  
  if (global.loginAttempts && global.loginAttempts.has(key)) {
    global.loginAttempts.delete(key);
    console.log('  ✅ Login attempts reset for IP:', clientIp);
  }
  
  next();
};

// =====================================
// MIDDLEWARE DE VÉRIFICATION DES PERMISSIONS SPÉCIFIQUES
// =====================================
const checkPermission = (permission) => {
  return (req, res, next) => {
    console.log('\n🔐 PERMISSION CHECK:');
    console.log('  📋 Required permission:', permission);
    
    if (!req.user) {
      console.log('  ❌ No user in request');
      return next(new AppError('Authentication required.', 401));
    }

    console.log('  👤 User role:', req.user.role);

    // Système de permissions basé sur les rôles
    const permissions = {
      admin: ['*'], // Toutes les permissions
      employer: [
        'job.create',
        'job.update',
        'job.delete',
        'job.view_all',
        'application.view',
        'application.update',
        'application.respond',
        'company.create',
        'company.update',
        'company.view',
        'analytics.view'
      ],
      candidate: [
        'application.create',
        'application.view_own',
        'application.withdraw',
        'job.view',
        'job.search',
        'job.save',
        'profile.update',
        'profile.view'
      ]
    };

    const userPermissions = permissions[req.user.role] || [];
    console.log('  📋 User permissions:', userPermissions);
    
    // Les admins ont tous les droits
    if (userPermissions.includes('*')) {
      console.log('  ✅ Admin access granted');
      return next();
    }

    // Vérifier la permission spécifique
    if (!userPermissions.includes(permission)) {
      console.log('  ❌ Permission denied');
      console.log('    Required:', permission);
      console.log('    Available:', userPermissions);
      return next(new AppError('Insufficient permissions.', 403));
    }

    console.log('  ✅ Permission granted');
    next();
  };
};

// =====================================
// MIDDLEWARE POUR VALIDER LES PARAMÈTRES UTILISATEUR
// =====================================
const validateUserParams = (req, res, next) => {
  console.log('\n🔍 VALIDATING USER PARAMS:');
  
  const { id } = req.params;
  
  if (id) {
    console.log('  📋 Validating user ID:', id);
    
    // Vérifier le format ObjectId de MongoDB
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      console.log('  ❌ Invalid user ID format');
      return next(new AppError('Invalid user ID format.', 400));
    }
    
    console.log('  ✅ User ID format valid');
  }
  
  next();
};

// =====================================
// MIDDLEWARE POUR VÉRIFIER LA VÉRIFICATION EMAIL
// =====================================
const requireEmailVerification = (req, res, next) => {
  console.log('\n📧 EMAIL VERIFICATION CHECK:');
  
  if (!req.user) {
    return next(new AppError('Authentication required.', 401));
  }
  
  console.log('  📧 Email verified:', req.user.emailVerified);
  
  if (!req.user.emailVerified) {
    console.log('  ❌ Email not verified');
    return next(new AppError('Please verify your email address before proceeding.', 403));
  }
  
  console.log('  ✅ Email verification passed');
  next();
};

// =====================================
// MIDDLEWARE POUR LOGS D'AUDIT
// =====================================
const auditLog = (action) => {
  return (req, res, next) => {
    console.log('\n📊 AUDIT LOG:');
    
    // Log des actions importantes pour audit
    const logData = {
      timestamp: new Date().toISOString(),
      action,
      userId: req.user?._id,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      resourceId: req.params.id,
      method: req.method,
      path: req.path,
      query: req.query,
      body: req.method === 'POST' || req.method === 'PUT' ? 
            (req.body && typeof req.body === 'object' ? Object.keys(req.body) : 'Non-object body') : 
            undefined
    };
    
    console.log('  📊 Audit entry:', JSON.stringify(logData, null, 2));
    
    // En production, envoyer vers un service de logging comme Winston, MongoDB, ou un service externe
    if (process.env.NODE_ENV === 'production') {
      // TODO: Implement actual audit logging service
      // logger.audit(logData);
    }
    
    next();
  };
};

// =====================================
// MIDDLEWARE DE DEBUG (DÉVELOPPEMENT UNIQUEMENT)
// =====================================
const debugAuth = (req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('\n🐛 AUTH DEBUG INFO:');
    console.log('  👤 User authenticated:', !!req.user);
    console.log('  📧 User email:', req.user?.email);
    console.log('  🎭 User role:', req.user?.role);
    console.log('  🆔 User ID:', req.user?._id);
    console.log('  🔑 Token present:', !!req.headers.authorization);
    console.log('  📍 Path:', req.path);
    console.log('  📋 Method:', req.method);
    console.log('  🌐 IP:', req.ip);
    console.log('  🕐 Timestamp:', new Date().toISOString());
  }
  next();
};

// =====================================
// MIDDLEWARE TEMPORAIRE DE BYPASS (TESTING UNIQUEMENT)
// =====================================
const bypassAuth = (req, res, next) => {
  console.log('\n⚠️  AUTH BYPASS ACTIVE (TESTING ONLY)');
  console.log('  🚨 THIS SHOULD NEVER BE USED IN PRODUCTION');
  
  // Créer un utilisateur factice pour les tests
  if (!req.user) {
    req.user = {
      _id: '507f1f77bcf86cd799439011', // ObjectId factice
      email: 'test@example.com',
      role: 'candidate',
      firstName: 'Test',
      lastName: 'User',
      isActive: true,
      emailVerified: true
    };
    console.log('  🤖 Created fake user for testing:', req.user.email);
  }
  
  next();
};

// =====================================
// EXPORTS
// =====================================
module.exports = {
  // Middlewares principaux
  auth,
  authorize,
  optionalAuth,
  
  // Middlewares de vérification
  checkOwnership,
  checkPermission,
  validateUserParams,
  requireEmailVerification,
  
  // Middlewares de sécurité
  loginLimiter,
  recordFailedLogin,
  resetLoginAttempts,
  
  // Middlewares utilitaires
  auditLog,
  debugAuth,
  
  // Middleware de test (à supprimer en production)
  bypassAuth
};