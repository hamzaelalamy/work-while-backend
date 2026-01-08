// controllers/authController.js - VERSION COMPLÈTE CORRIGÉE
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { catchAsync, AppError, sendResponse } = require('../utils/helpers');
const { authValidators } = require('../utils/validators');

// =====================================
// FONCTIONS UTILITAIRES POUR LES TOKENS
// =====================================

// Générer un token JWT avec logging pour debug
const generateToken = (payload) => {
  console.log('🎟️  GENERATING TOKEN:');
  console.log('  Input payload:', payload);
  
  // ✅ CORRECTION CRITIQUE: S'assurer que l'ID est bien présent
  const tokenPayload = {
    id: payload.id || payload._id,  // Support des deux formats
    email: payload.email,
    role: payload.role
  };
  
  console.log('  Final token payload:', tokenPayload);
  console.log('  JWT_SECRET present:', !!process.env.JWT_SECRET);
  console.log('  JWT_EXPIRE:', process.env.JWT_EXPIRE || '15m');
  
  const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '15m'
  });
  
  console.log('  Token generated successfully, length:', token.length);
  console.log('  Token preview:', token.substring(0, 20) + '...');
  
  return token;
};

// Générer un refresh token
const generateRefreshToken = (payload) => {
  console.log('🔄 GENERATING REFRESH TOKEN:');
  
  const refreshPayload = {
    id: payload.id || payload._id,
    email: payload.email,
    role: payload.role,
    type: 'refresh'
  };
  
  console.log('  Refresh token payload:', refreshPayload);
  
  const refreshToken = jwt.sign(refreshPayload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d'
  });
  
  console.log('  Refresh token generated successfully');
  
  return refreshToken;
};

// Valider et nettoyer les données d'entrée
const sanitizeUserInput = (data) => {
  const sanitized = {};
  
  if (data.firstName) sanitized.firstName = data.firstName.trim();
  if (data.lastName) sanitized.lastName = data.lastName.trim();
  if (data.email) sanitized.email = data.email.toLowerCase().trim();
  if (data.password) sanitized.password = data.password;
  if (data.role) sanitized.role = data.role;
  
  return sanitized;
};

// =====================================
// INSCRIPTION D'UN NOUVEL UTILISATEUR
// =====================================
const register = catchAsync(async (req, res, next) => {
  console.log('\n📝 REGISTRATION ATTEMPT:');
  console.log('  Raw request body:', req.body);
  console.log('  Email:', req.body.email);
  console.log('  Role:', req.body.role);
  console.log('  IP:', req.ip);
  console.log('  User-Agent:', req.get('User-Agent'));

  // Validation des données d'entrée
  const { error } = authValidators.register.validate(req.body);
  if (error) {
    console.log('  ❌ Validation error:', error.details[0].message);
    return next(new AppError(error.details[0].message, 400));
  }

  // Extraire et nettoyer les données
  const { firstName, lastName, email, password, role = 'candidate' } = sanitizeUserInput(req.body);
  
  console.log('  ✅ Validation passed');
  console.log('  Sanitized data:', { firstName, lastName, email, role });

  // Vérifier si l'utilisateur existe déjà
  console.log('  🔍 Checking if user already exists...');
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    console.log('  ❌ User already exists with email:', email);
    return next(new AppError('User with this email already exists', 409));
  }

  console.log('  ✅ Email is available');

  try {
    console.log('  👤 Creating new user...');
    
    // ✅ CORRECTION: S'assurer que le rôle est bien défini
    const userData = {
      firstName,
      lastName,
      email,
      password,
      role: role || 'candidate', // Double vérification du rôle
      isActive: true,
      emailVerified: process.env.NODE_ENV === 'development' // Auto-verify en dev
    };
    
    console.log('  📋 User data to save:', {
      ...userData,
      password: '[HIDDEN]'
    });

    // Créer le nouvel utilisateur
    const user = new User(userData);
    await user.save();
    
    console.log('  ✅ User created successfully:');
    console.log('    ID:', user._id);
    console.log('    Email:', user.email);
    console.log('    Role:', user.role);
    console.log('    Active:', user.isActive);

    // Générer les tokens
    console.log('  🎟️  Generating authentication tokens...');
    const tokenPayload = {
      id: user._id,
      email: user.email,
      role: user.role
    };

    const token = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Préparer la réponse utilisateur (sans le mot de passe)
    const userResponse = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role, // ✅ CRITIQUE: Inclure le rôle dans la réponse
      profile: user.profile || {},
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt
    };

    console.log('  ✅ REGISTRATION SUCCESSFUL');
    console.log('    User response prepared:', {
      id: userResponse._id,
      email: userResponse.email,
      role: userResponse.role
    });

    // Envoyer la réponse
    sendResponse(res, 201, 'success', 'User registered successfully', {
      user: userResponse,
      token,
      refreshToken
    });

  } catch (error) {
    console.error('  ❌ Registration error:', error);
    
    // Gestion des erreurs spécifiques de MongoDB
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return next(new AppError(`${field} already exists`, 409));
    }
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return next(new AppError(`Validation error: ${messages.join(', ')}`, 400));
    }
    
    return next(new AppError('Registration failed. Please try again.', 500));
  }
});

// =====================================
// CONNEXION D'UN UTILISATEUR
// =====================================
const login = catchAsync(async (req, res, next) => {
  console.log('\n🔐 LOGIN ATTEMPT:');
  console.log('  Email:', req.body.email);
  console.log('  IP:', req.ip);
  console.log('  User-Agent:', req.get('User-Agent'));
  console.log('  Timestamp:', new Date().toISOString());

  // Validation des données d'entrée
  const { error } = authValidators.login.validate(req.body);
  if (error) {
    console.log('  ❌ Validation error:', error.details[0].message);
    return next(new AppError(error.details[0].message, 400));
  }

  const { email, password } = sanitizeUserInput(req.body);
  console.log('  ✅ Input validation passed');

  try {
    console.log('  🔍 Searching for user...');
    
    // Rechercher l'utilisateur avec le mot de passe
    const user = await User.findOne({ email }).select('+password +isActive');

    if (!user) {
      console.log('  ❌ User not found with email:', email);
      return next(new AppError('Invalid email or password', 401));
    }

    console.log('  ✅ User found:');
    console.log('    ID:', user._id);
    console.log('    Email:', user.email);
    console.log('    Role:', user.role);
    console.log('    Active:', user.isActive);
    console.log('    Email verified:', user.emailVerified);

    // Vérifier si l'utilisateur est actif
    if (!user.isActive) {
      console.log('  ❌ User account is deactivated');
      return next(new AppError('Account has been deactivated. Please contact support.', 401));
    }

    console.log('  🔐 Verifying password...');
    
    // Vérifier le mot de passe
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      console.log('  ❌ Invalid password');
      return next(new AppError('Invalid email or password', 401));
    }

    console.log('  ✅ Password verified');

    // Mettre à jour la dernière connexion
    console.log('  📅 Updating last login...');
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    console.log('  ✅ LOGIN SUCCESSFUL for user:', user._id);

    // Générer les tokens
    console.log('  🎟️  Generating authentication tokens...');
    const tokenPayload = {
      id: user._id,
      email: user.email,
      role: user.role
    };

    const token = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Préparer la réponse utilisateur (sans le mot de passe)
    const userResponse = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role, // ✅ CRITIQUE: Inclure le rôle
      profile: user.profile || {},
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    console.log('  📤 Sending login response');
    console.log('    User data:', {
      id: userResponse._id,
      email: userResponse.email,
      role: userResponse.role
    });

    // Envoyer la réponse
    sendResponse(res, 200, 'success', 'Login successful', {
      user: userResponse,
      token,
      refreshToken
    });

  } catch (error) {
    console.error('  ❌ Login error:', error);
    return next(new AppError('Login failed. Please try again.', 500));
  }
});

// =====================================
// DÉCONNEXION D'UN UTILISATEUR
// =====================================
const logout = catchAsync(async (req, res, next) => {
  console.log('\n👋 LOGOUT REQUEST:');
  console.log('  User ID:', req.user?._id);
  console.log('  User email:', req.user?.email);
  console.log('  Timestamp:', new Date().toISOString());

  // En production, vous pourriez vouloir invalider le token
  // Pour l'instant, on renvoie juste une réponse de succès
  console.log('  ✅ Logout successful');
  
  sendResponse(res, 200, 'success', 'Logout successful');
});

// =====================================
// OBTENIR LE PROFIL DE L'UTILISATEUR CONNECTÉ
// =====================================
const getMe = catchAsync(async (req, res, next) => {
  console.log('\n👤 GET USER PROFILE:');
  console.log('  Requested by user ID:', req.user._id);
  console.log('  User email:', req.user.email);
  console.log('  User role:', req.user.role);

  try {
    console.log('  🔍 Fetching complete user profile...');
    
    // ✅ CORRECTION: Utiliser req.user._id au lieu de req.user.id
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
      console.log('  ❌ User not found in database');
      return next(new AppError('User not found', 404));
    }

    console.log('  ✅ User profile retrieved:');
    console.log('    ID:', user._id);
    console.log('    Email:', user.email);
    console.log('    Role:', user.role);
    console.log('    Saved jobs count:', user.savedJobs?.length || 0);

    // Préparer la réponse
    const userResponse = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role, // ✅ CRITIQUE: Toujours inclure le rôle
      profile: user.profile || {},
      savedJobs: user.savedJobs || [],
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    console.log('  📤 Sending profile response');

    sendResponse(res, 200, 'success', 'Profile retrieved successfully', {
      user: userResponse
    });

  } catch (error) {
    console.error('  ❌ Get profile error:', error);
    return next(new AppError('Failed to retrieve profile', 500));
  }
});

// =====================================
// RAFRAÎCHIR LE TOKEN
// =====================================
const refreshToken = catchAsync(async (req, res, next) => {
  console.log('\n🔄 TOKEN REFRESH REQUEST:');
  
  const { refreshToken: clientRefreshToken } = req.body;

  if (!clientRefreshToken) {
    console.log('  ❌ No refresh token provided');
    return next(new AppError('Refresh token is required', 400));
  }

  console.log('  🔍 Validating refresh token...');
  console.log('  Token length:', clientRefreshToken.length);

  try {
    // Vérifier le refresh token
    const decoded = jwt.verify(clientRefreshToken, process.env.JWT_REFRESH_SECRET);
    console.log('  ✅ Refresh token verified');
    console.log('  Token payload:', {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      type: decoded.type
    });

    // Rechercher l'utilisateur
    console.log('  🔍 Looking up user...');
    const user = await User.findById(decoded.id).select('+isActive');
    
    if (!user || !user.isActive) {
      console.log('  ❌ User not found or inactive');
      return next(new AppError('Invalid refresh token', 401));
    }

    console.log('  ✅ User found and active');

    // Générer de nouveaux tokens
    console.log('  🎟️  Generating new tokens...');
    const tokenPayload = {
      id: user._id,
      email: user.email,
      role: user.role
    };

    const newToken = generateToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    console.log('  ✅ New tokens generated successfully');

    sendResponse(res, 200, 'success', 'Token refreshed successfully', {
      token: newToken,
      refreshToken: newRefreshToken
    });

  } catch (error) {
    console.error('  ❌ Refresh token error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid refresh token', 401));
    } else if (error.name === 'TokenExpiredError') {
      return next(new AppError('Refresh token has expired', 401));
    }
    
    return next(new AppError('Invalid or expired refresh token', 401));
  }
});

// =====================================
// DEMANDE DE RÉINITIALISATION DE MOT DE PASSE
// =====================================
const forgotPassword = catchAsync(async (req, res, next) => {
  console.log('\n🔑 PASSWORD RESET REQUEST:');
  
  const { error } = authValidators.forgotPassword.validate(req.body);
  if (error) {
    console.log('  ❌ Validation error:', error.details[0].message);
    return next(new AppError(error.details[0].message, 400));
  }

  const { email } = sanitizeUserInput(req.body);
  console.log('  📧 Email:', email);

  try {
    console.log('  🔍 Looking up user...');
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log('  ⚠️  User not found, but sending generic response for security');
      // Pour la sécurité, on renvoie toujours la même réponse
      return sendResponse(res, 200, 'success', 
        'If an account with that email exists, a password reset link has been sent');
    }

    console.log('  ✅ User found, generating reset token...');

    // Générer un token de réinitialisation
    const resetToken = jwt.sign(
      { id: user._id, purpose: 'password-reset' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Sauvegarder le token dans la base (hashé)
    const crypto = require('crypto');
    user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 heure
    await user.save({ validateBeforeSave: false });

    console.log('  ✅ Reset token saved to database');
    console.log('  🔑 Reset token (dev only):', resetToken);

    // En production, envoyer l'email ici
    // await sendResetPasswordEmail(user.email, resetToken);

    sendResponse(res, 200, 'success', 
      'If an account with that email exists, a password reset link has been sent');

  } catch (error) {
    console.error('  ❌ Forgot password error:', error);
    return next(new AppError('Failed to process password reset request', 500));
  }
});

// =====================================
// RÉINITIALISATION DE MOT DE PASSE
// =====================================
const resetPassword = catchAsync(async (req, res, next) => {
  console.log('\n🔄 PASSWORD RESET:');
  
  const { error } = authValidators.resetPassword.validate(req.body);
  if (error) {
    console.log('  ❌ Validation error:', error.details[0].message);
    return next(new AppError(error.details[0].message, 400));
  }

  const { token, password } = req.body;
  console.log('  🔑 Reset token received, length:', token.length);

  try {
    console.log('  🔍 Verifying reset token...');
    
    // Vérifier le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.purpose !== 'password-reset') {
      console.log('  ❌ Invalid token purpose:', decoded.purpose);
      return next(new AppError('Invalid reset token', 400));
    }

    console.log('  ✅ Token verified, looking up user...');

    // Hasher le token pour comparer avec la base
    const crypto = require('crypto');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Rechercher l'utilisateur avec le token valide
    const user = await User.findOne({
      _id: decoded.id,
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      console.log('  ❌ User not found or token expired');
      return next(new AppError('Invalid or expired reset token', 400));
    }

    console.log('  ✅ User found, updating password...');

    // Mettre à jour le mot de passe
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    console.log('  ✅ Password updated successfully');

    // Générer de nouveaux tokens
    const tokenPayload = {
      id: user._id,
      email: user.email,
      role: user.role
    };

    const newToken = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Préparer la réponse utilisateur
    const userResponse = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      emailVerified: user.emailVerified
    };

    console.log('  ✅ Password reset completed successfully');

    sendResponse(res, 200, 'success', 'Password reset successful', {
      user: userResponse,
      token: newToken,
      refreshToken
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      console.log('  ❌ Token verification failed:', error.message);
      return next(new AppError('Invalid or expired reset token', 400));
    }
    
    console.error('  ❌ Reset password error:', error);
    return next(new AppError('Failed to reset password', 500));
  }
});

// =====================================
// VÉRIFICATION D'EMAIL
// =====================================
const verifyEmail = catchAsync(async (req, res, next) => {
  console.log('\n📧 EMAIL VERIFICATION:');
  
  const { token } = req.params;
  console.log('  🔑 Verification token received');

  try {
    console.log('  🔍 Verifying token...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.purpose !== 'email-verification') {
      console.log('  ❌ Invalid token purpose:', decoded.purpose);
      return next(new AppError('Invalid verification token', 400));
    }

    console.log('  ✅ Token verified, looking up user...');
    const user = await User.findById(decoded.id);
    
    if (!user) {
      console.log('  ❌ User not found');
      return next(new AppError('Invalid verification token', 400));
    }

    if (user.emailVerified) {
      console.log('  ℹ️  Email already verified');
      return sendResponse(res, 200, 'success', 'Email already verified');
    }

    console.log('  ✅ Marking email as verified...');
    user.emailVerified = true;
    await user.save({ validateBeforeSave: false });

    console.log('  ✅ Email verification completed for user:', user._id);

    sendResponse(res, 200, 'success', 'Email verified successfully');

  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      console.log('  ❌ Token verification failed:', error.message);
      return next(new AppError('Invalid or expired verification token', 400));
    }
    
    console.error('  ❌ Email verification error:', error);
    return next(new AppError('Failed to verify email', 500));
  }
});

// =====================================
// ROUTE DE DEBUG (DÉVELOPPEMENT UNIQUEMENT)
// =====================================
const debug = catchAsync(async (req, res, next) => {
  if (process.env.NODE_ENV !== 'development') {
    return next(new AppError('Debug endpoint only available in development', 403));
  }

  console.log('\n🐛 AUTH DEBUG ENDPOINT:');
  
  const debugInfo = {
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    server: {
      jwtSecret: process.env.JWT_SECRET ? 'Set' : 'Not set',
      jwtExpire: process.env.JWT_EXPIRE || 'Not set',
      mongoUri: process.env.MONGODB_URI ? 'Set' : 'Not set'
    },
    request: {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      authorization: req.headers.authorization ? 'Present' : 'Missing'
    },
    user: req.user ? {
      id: req.user._id,
      email: req.user.email,
      role: req.user.role,
      isActive: req.user.isActive,
      emailVerified: req.user.emailVerified
    } : 'No user attached to request'
  };

  console.log('  Debug info prepared:', debugInfo);

  res.status(200).json({
    status: 'success',
    message: 'Auth debug information',
    data: debugInfo
  });
});

// =====================================
// MISE À JOUR DU PROFIL UTILISATEUR
// =====================================
const updateProfile = catchAsync(async (req, res, next) => {
  console.log('\n📝 PROFILE UPDATE:');
  console.log('  User ID:', req.user._id);
  console.log('  Update data:', req.body);
  
  const allowedFields = [
    'firstName', 
    'lastName', 
    'profile'
  ];
  
  const updates = {};
  Object.keys(req.body).forEach(key => {
    if (allowedFields.includes(key)) {
      updates[key] = req.body[key];
    }
  });

  console.log('  Allowed updates:', updates);

  const user = await User.findByIdAndUpdate(
    req.user._id,
    updates,
    { new: true, runValidators: true }
  ).select('-password');

  console.log('  ✅ Profile updated successfully');

  sendResponse(res, 200, 'success', 'Profile updated successfully', {
    user
  });
});

// =====================================
// CHANGER LE MOT DE PASSE
// =====================================
const changePassword = catchAsync(async (req, res, next) => {
  console.log('\n🔐 PASSWORD CHANGE:');
  console.log('  User ID:', req.user._id);
  
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return next(new AppError('Current password and new password are required', 400));
  }

  // Récupérer l'utilisateur avec le mot de passe
  const user = await User.findById(req.user._id).select('+password');

  // Vérifier le mot de passe actuel
  const isCurrentPasswordValid = await user.comparePassword(currentPassword);
  if (!isCurrentPasswordValid) {
    console.log('  ❌ Current password is incorrect');
    return next(new AppError('Current password is incorrect', 400));
  }

  console.log('  ✅ Current password verified');
  console.log('  🔄 Updating to new password...');

  // Mettre à jour le mot de passe
  user.password = newPassword;
  await user.save();

  console.log('  ✅ Password changed successfully');

  sendResponse(res, 200, 'success', 'Password changed successfully');
});

// =====================================
// EXPORTS
// =====================================
module.exports = {
  // Fonctions principales
  register,
  login,
  logout,
  getMe,
  refreshToken,
  
  // Gestion des mots de passe
  forgotPassword,
  resetPassword,
  changePassword,
  
  // Vérifications
  verifyEmail,
  
  // Profil utilisateur
  updateProfile,
  
  // Debug (développement uniquement)
  debug,
  
  // Utilitaires (pour tests ou usage interne)
  generateToken,
  generateRefreshToken
};