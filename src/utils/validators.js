// utils/validators.js
const Joi = require('joi');

// Validateurs pour l'authentification
const authValidators = {
  register: Joi.object({
    firstName: Joi.string()
      .min(2)
      .max(50)
      .trim()
      .required()
      .messages({
        'string.min': 'First name must be at least 2 characters',
        'string.max': 'First name cannot exceed 50 characters',
        'any.required': 'First name is required'
      }),
    
    lastName: Joi.string()
      .min(2)
      .max(50)
      .trim()
      .required()
      .messages({
        'string.min': 'Last name must be at least 2 characters',
        'string.max': 'Last name cannot exceed 50 characters',
        'any.required': 'Last name is required'
      }),
    
    email: Joi.string()
      .email()
      .trim()
      .lowercase()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
      }),
    
    password: Joi.string()
      .min(8)
      .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]'))
      .required()
      .messages({
        'string.min': 'Password must be at least 8 characters long',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'any.required': 'Password is required'
      }),
    
    role: Joi.string()
      .valid('candidate', 'employer')
      .default('candidate')
      .messages({
        'any.only': 'Role must be either candidate or employer'
      })
  }),

  login: Joi.object({
    email: Joi.string()
      .email()
      .trim()
      .lowercase()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
      }),
    
    password: Joi.string()
      .required()
      .messages({
        'any.required': 'Password is required'
      })
  }),

  forgotPassword: Joi.object({
    email: Joi.string()
      .email()
      .trim()
      .lowercase()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
      })
  }),

  resetPassword: Joi.object({
    token: Joi.string()
      .required()
      .messages({
        'any.required': 'Reset token is required'
      }),
    
    password: Joi.string()
      .min(8)
      .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]'))
      .required()
      .messages({
        'string.min': 'Password must be at least 8 characters long',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'any.required': 'Password is required'
      })
  })
};

// Validateurs pour les emplois
const jobValidators = {
  createJob: Joi.object({
    title: Joi.string()
      .min(5)
      .max(100)
      .trim()
      .required()
      .messages({
        'string.min': 'Job title must be at least 5 characters',
        'string.max': 'Job title cannot exceed 100 characters',
        'any.required': 'Job title is required'
      }),
    
    description: Joi.string()
      .min(50)
      .max(5000)
      .trim()
      .required()
      .messages({
        'string.min': 'Job description must be at least 50 characters',
        'string.max': 'Job description cannot exceed 5000 characters',
        'any.required': 'Job description is required'
      }),
    
    location: Joi.string()
      .min(2)
      .max(100)
      .trim()
      .required()
      .messages({
        'string.min': 'Location must be at least 2 characters',
        'string.max': 'Location cannot exceed 100 characters',
        'any.required': 'Location is required'
      }),
    
    type: Joi.string()
      .valid('full-time', 'part-time', 'contract', 'freelance', 'internship')
      .required()
      .messages({
        'any.only': 'Job type must be one of: full-time, part-time, contract, freelance, internship',
        'any.required': 'Job type is required'
      }),
    
    category: Joi.string()
      .min(2)
      .max(50)
      .trim()
      .required()
      .messages({
        'string.min': 'Category must be at least 2 characters',
        'string.max': 'Category cannot exceed 50 characters',
        'any.required': 'Category is required'
      }),
    
    experienceLevel: Joi.string()
      .valid('entry', 'mid', 'senior', 'executive')
      .required()
      .messages({
        'any.only': 'Experience level must be one of: entry, mid, senior, executive',
        'any.required': 'Experience level is required'
      }),
    
    salary: Joi.object({
      min: Joi.number().min(0).allow(null),
      max: Joi.number().min(0).allow(null),
      currency: Joi.string().valid('USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'INR', 'MAD').default('USD'),
      period: Joi.string().valid('hourly', 'daily', 'weekly', 'monthly', 'yearly').default('yearly')
    }).optional(),
    
    isRemote: Joi.boolean().default(false),
    
    skills: Joi.array()
      .items(Joi.string().trim().max(50))
      .max(20)
      .optional(),
    
    benefits: Joi.array()
      .items(Joi.string().trim().max(100))
      .max(20)
      .optional(),
    
    requirements: Joi.array()
      .items(Joi.string().trim().max(200))
      .max(20)
      .optional(),
    
    deadlineDate: Joi.date()
      .greater('now')
      .optional()
      .messages({
        'date.greater': 'Deadline must be in the future'
      }),
    
    urgency: Joi.string()
      .valid('low', 'medium', 'high')
      .default('medium'),
    
    tags: Joi.array()
      .items(Joi.string().trim().max(30))
      .max(10)
      .optional(),
    
    company: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .optional()
      .messages({
        'string.pattern.base': 'Invalid company ID format'
      })
  }),

  updateJob: Joi.object({
    title: Joi.string()
      .min(5)
      .max(100)
      .trim()
      .optional(),
    
    description: Joi.string()
      .min(50)
      .max(5000)
      .trim()
      .optional(),
    
    location: Joi.string()
      .min(2)
      .max(100)
      .trim()
      .optional(),
    
    type: Joi.string()
      .valid('full-time', 'part-time', 'contract', 'freelance', 'internship')
      .optional(),
    
    category: Joi.string()
      .min(2)
      .max(50)
      .trim()
      .optional(),
    
    experienceLevel: Joi.string()
      .valid('entry', 'mid', 'senior', 'executive')
      .optional(),
    
    salary: Joi.object({
      min: Joi.number().min(0).allow(null),
      max: Joi.number().min(0).allow(null),
      currency: Joi.string().valid('USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'INR', 'MAD'),
      period: Joi.string().valid('hourly', 'daily', 'weekly', 'monthly', 'yearly')
    }).optional(),
    
    isRemote: Joi.boolean().optional(),
    
    skills: Joi.array()
      .items(Joi.string().trim().max(50))
      .max(20)
      .optional(),
    
    benefits: Joi.array()
      .items(Joi.string().trim().max(100))
      .max(20)
      .optional(),
    
    requirements: Joi.array()
      .items(Joi.string().trim().max(200))
      .max(20)
      .optional(),
    
    deadlineDate: Joi.date()
      .greater('now')
      .allow(null)
      .optional(),
    
    urgency: Joi.string()
      .valid('low', 'medium', 'high')
      .optional(),
    
    tags: Joi.array()
      .items(Joi.string().trim().max(30))
      .max(10)
      .optional(),
    
    status: Joi.string()
      .valid('active', 'paused', 'closed', 'draft')
      .optional()
  })
};

// Validateurs pour les candidatures
const applicationValidators = {
  updateApplicationStatus: Joi.object({
    status: Joi.string()
      .valid('pending', 'reviewing', 'shortlisted', 'interviewed', 'offered', 'rejected', 'withdrawn')
      .required()
      .messages({
        'any.only': 'Status must be one of: pending, reviewing, shortlisted, interviewed, offered, rejected, withdrawn',
        'any.required': 'Status is required'
      }),
    
    notes: Joi.string()
      .max(1000)
      .trim()
      .optional()
      .messages({
        'string.max': 'Notes cannot exceed 1000 characters'
      })
  })
};

// Validateurs pour les utilisateurs
const userValidators = {
  updateProfile: Joi.object({
    firstName: Joi.string()
      .min(2)
      .max(50)
      .trim()
      .optional(),
    
    lastName: Joi.string()
      .min(2)
      .max(50)
      .trim()
      .optional(),
    
    profile: Joi.object({
      phone: Joi.string()
        .pattern(/^\+?[\d\s\-()]{10,}$/)
        .optional()
        .messages({
          'string.pattern.base': 'Please provide a valid phone number'
        }),
      
      location: Joi.string()
        .max(100)
        .trim()
        .optional(),
      
      bio: Joi.string()
        .max(500)
        .trim()
        .optional()
        .messages({
          'string.max': 'Bio cannot exceed 500 characters'
        }),
      
      skills: Joi.array()
        .items(Joi.string().trim().max(50))
        .max(50)
        .optional(),
      
      experience: Joi.string()
        .max(1000)
        .trim()
        .optional(),
      
      education: Joi.string()
        .max(1000)
        .trim()
        .optional(),
      
      avatar: Joi.string()
        .uri()
        .optional()
    }).optional()
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string()
      .required()
      .messages({
        'any.required': 'Current password is required'
      }),
    
    newPassword: Joi.string()
      .min(8)
      .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]'))
      .required()
      .messages({
        'string.min': 'New password must be at least 8 characters long',
        'string.pattern.base': 'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'any.required': 'New password is required'
      })
  })
};

// Validateurs pour les entreprises
const companyValidators = {
  createCompany: Joi.object({
    name: Joi.string()
      .min(2)
      .max(100)
      .trim()
      .required()
      .messages({
        'string.min': 'Company name must be at least 2 characters',
        'string.max': 'Company name cannot exceed 100 characters',
        'any.required': 'Company name is required'
      }),
    
    description: Joi.string()
      .max(2000)
      .trim()
      .optional()
      .messages({
        'string.max': 'Description cannot exceed 2000 characters'
      }),
    
    industry: Joi.string()
      .min(2)
      .max(50)
      .trim()
      .required()
      .messages({
        'string.min': 'Industry must be at least 2 characters',
        'string.max': 'Industry cannot exceed 50 characters',
        'any.required': 'Industry is required'
      }),
    
    size: Joi.string()
      .valid('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+')
      .required()
      .messages({
        'any.only': 'Company size must be one of: 1-10, 11-50, 51-200, 201-500, 501-1000, 1000+',
        'any.required': 'Company size is required'
      }),
    
    location: Joi.string()
      .min(2)
      .max(100)
      .trim()
      .required()
      .messages({
        'string.min': 'Location must be at least 2 characters',
        'string.max': 'Location cannot exceed 100 characters',
        'any.required': 'Location is required'
      }),
    
    website: Joi.string()
      .uri()
      .optional()
      .messages({
        'string.uri': 'Please provide a valid website URL'
      }),
    
    email: Joi.string()
      .email()
      .trim()
      .lowercase()
      .optional()
      .messages({
        'string.email': 'Please provide a valid email address'
      }),
    
    phone: Joi.string()
      .pattern(/^\+?[\d\s\-()]{10,}$/)
      .optional()
      .messages({
        'string.pattern.base': 'Please provide a valid phone number'
      }),
    
    founded: Joi.number()
      .integer()
      .min(1800)
      .max(new Date().getFullYear())
      .optional()
      .messages({
        'number.min': 'Founded year cannot be before 1800',
        'number.max': 'Founded year cannot be in the future'
      }),
    
    socialLinks: Joi.object({
      linkedin: Joi.string()
        .uri()
        .pattern(/^https?:\/\/(www\.)?linkedin\.com\//)
        .optional()
        .messages({
          'string.pattern.base': 'Please provide a valid LinkedIn URL'
        }),
      
      twitter: Joi.string()
        .uri()
        .pattern(/^https?:\/\/(www\.)?(twitter\.com|x\.com)\//)
        .optional()
        .messages({
          'string.pattern.base': 'Please provide a valid Twitter/X URL'
        }),
      
      facebook: Joi.string()
        .uri()
        .pattern(/^https?:\/\/(www\.)?facebook\.com\//)
        .optional()
        .messages({
          'string.pattern.base': 'Please provide a valid Facebook URL'
        })
    }).optional(),
    
    benefits: Joi.array()
      .items(Joi.string().trim().max(100))
      .max(20)
      .optional(),
    
    culture: Joi.array()
      .items(Joi.string().trim().max(50))
      .max(10)
      .optional(),
    
    techStack: Joi.array()
      .items(Joi.string().trim().max(30))
      .max(30)
      .optional()
  }),

  updateCompany: Joi.object({
    name: Joi.string()
      .min(2)
      .max(100)
      .trim()
      .optional(),
    
    description: Joi.string()
      .max(2000)
      .trim()
      .optional(),
    
    industry: Joi.string()
      .min(2)
      .max(50)
      .trim()
      .optional(),
    
    size: Joi.string()
      .valid('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+')
      .optional(),
    
    location: Joi.string()
      .min(2)
      .max(100)
      .trim()
      .optional(),
    
    website: Joi.string()
      .uri()
      .optional(),
    
    email: Joi.string()
      .email()
      .trim()
      .lowercase()
      .optional(),
    
    phone: Joi.string()
      .pattern(/^\+?[\d\s\-()]{10,}$/)
      .optional(),
    
    founded: Joi.number()
      .integer()
      .min(1800)
      .max(new Date().getFullYear())
      .optional(),
    
    socialLinks: Joi.object({
      linkedin: Joi.string().uri().optional(),
      twitter: Joi.string().uri().optional(),
      facebook: Joi.string().uri().optional()
    }).optional(),
    
    benefits: Joi.array()
      .items(Joi.string().trim().max(100))
      .max(20)
      .optional(),
    
    culture: Joi.array()
      .items(Joi.string().trim().max(50))
      .max(10)
      .optional(),
    
    techStack: Joi.array()
      .items(Joi.string().trim().max(30))
      .max(30)
      .optional()
  })
};

module.exports = {
  authValidators,
  jobValidators,
  applicationValidators,
  userValidators,
  companyValidators
};