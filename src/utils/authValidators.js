// utils/authValidators.js
const Joi = require('joi');

// Schémas de validation pour l'authentification
const authValidators = {
  // Validation pour l'inscription
  register: Joi.object({
    firstName: Joi.string()
      .trim()
      .min(1)
      .max(50)
      .required()
      .messages({
        'string.empty': 'First name is required',
        'string.min': 'First name must be at least 1 character long',
        'string.max': 'First name cannot exceed 50 characters',
        'any.required': 'First name is required'
      }),
    
    lastName: Joi.string()
      .trim()
      .min(1)
      .max(50)
      .required()
      .messages({
        'string.empty': 'Last name is required',
        'string.min': 'Last name must be at least 1 character long',
        'string.max': 'Last name cannot exceed 50 characters',
        'any.required': 'Last name is required'
      }),
    
    email: Joi.string()
      .email()
      .lowercase()
      .trim()
      .required()
      .messages({
        'string.empty': 'Email is required',
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
      }),
    
    password: Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required()
      .messages({
        'string.empty': 'Password is required',
        'string.min': 'Password must be at least 8 characters long',
        'string.max': 'Password cannot exceed 128 characters',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'any.required': 'Password is required'
      }),
    
    role: Joi.string()
      .valid('candidate', 'employer', 'admin')
      .default('candidate')
      .messages({
        'any.only': 'Role must be either candidate, employer, or admin'
      })
  }),

  // Validation pour la connexion
  login: Joi.object({
    email: Joi.string()
      .email()
      .lowercase()
      .trim()
      .required()
      .messages({
        'string.empty': 'Email is required',
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
      }),
    
    password: Joi.string()
      .min(1)
      .required()
      .messages({
        'string.empty': 'Password is required',
        'any.required': 'Password is required'
      })
  }),

  // Validation pour mot de passe oublié
  forgotPassword: Joi.object({
    email: Joi.string()
      .email()
      .lowercase()
      .trim()
      .required()
      .messages({
        'string.empty': 'Email is required',
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
      })
  }),

  // Validation pour réinitialisation de mot de passe
  resetPassword: Joi.object({
    token: Joi.string()
      .required()
      .messages({
        'string.empty': 'Reset token is required',
        'any.required': 'Reset token is required'
      }),
    
    password: Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required()
      .messages({
        'string.empty': 'Password is required',
        'string.min': 'Password must be at least 8 characters long',
        'string.max': 'Password cannot exceed 128 characters',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'any.required': 'Password is required'
      })
  }),

  // Validation pour refresh token
  refreshToken: Joi.object({
    refreshToken: Joi.string()
      .required()
      .messages({
        'string.empty': 'Refresh token is required',
        'any.required': 'Refresh token is required'
      })
  }),

  // Validation pour changement de mot de passe
  changePassword: Joi.object({
    currentPassword: Joi.string()
      .required()
      .messages({
        'string.empty': 'Current password is required',
        'any.required': 'Current password is required'
      }),
    
    newPassword: Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required()
      .invalid(Joi.ref('currentPassword'))
      .messages({
        'string.empty': 'New password is required',
        'string.min': 'New password must be at least 8 characters long',
        'string.max': 'New password cannot exceed 128 characters',
        'string.pattern.base': 'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'any.invalid': 'New password must be different from current password',
        'any.required': 'New password is required'
      })
  }),

  // Validation pour mise à jour de profil
  updateProfile: Joi.object({
    firstName: Joi.string()
      .trim()
      .min(1)
      .max(50)
      .messages({
        'string.min': 'First name must be at least 1 character long',
        'string.max': 'First name cannot exceed 50 characters'
      }),
    
    lastName: Joi.string()
      .trim()
      .min(1)
      .max(50)
      .messages({
        'string.min': 'Last name must be at least 1 character long',
        'string.max': 'Last name cannot exceed 50 characters'
      }),
    
    profile: Joi.object({
      phone: Joi.string()
        .pattern(/^\+?[\d\s\-\(\)]{10,}$/)
        .allow('')
        .messages({
          'string.pattern.base': 'Please provide a valid phone number'
        }),
      
      location: Joi.string()
        .max(100)
        .allow('')
        .messages({
          'string.max': 'Location cannot exceed 100 characters'
        }),
      
      bio: Joi.string()
        .max(500)
        .allow('')
        .messages({
          'string.max': 'Bio cannot exceed 500 characters'
        }),
      
      skills: Joi.array()
        .items(Joi.string().trim().max(50))
        .max(20)
        .messages({
          'array.max': 'Maximum 20 skills allowed',
          'string.max': 'Each skill cannot exceed 50 characters'
        }),
      
      experience: Joi.string()
        .max(1000)
        .allow('')
        .messages({
          'string.max': 'Experience cannot exceed 1000 characters'
        }),
      
      education: Joi.string()
        .max(500)
        .allow('')
        .messages({
          'string.max': 'Education cannot exceed 500 characters'
        }),
      
      avatar: Joi.string()
        .uri()
        .allow('')
        .messages({
          'string.uri': 'Avatar must be a valid URL'
        })
    }).allow(null)
  }).min(1).messages({
    'object.min': 'At least one field must be provided for update'
  })
};

module.exports = {
  authValidators
};