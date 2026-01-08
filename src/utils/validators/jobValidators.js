// utils/validators/jobValidators.js
const Joi = require('joi');

const createJobValidator = Joi.object({
  title: Joi.string()
    .trim()
    .min(3)
    .max(100)
    .required()
    .messages({
      'string.empty': 'Job title is required',
      'string.min': 'Job title must be at least 3 characters long',
      'string.max': 'Job title cannot exceed 100 characters'
    }),

  description: Joi.string()
    .trim()
    .min(50)
    .max(5000)
    .required()
    .messages({
      'string.empty': 'Job description is required',
      'string.min': 'Job description must be at least 50 characters long',
      'string.max': 'Job description cannot exceed 5000 characters'
    }),

  location: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.empty': 'Location is required',
      'string.min': 'Location must be at least 2 characters long',
      'string.max': 'Location cannot exceed 100 characters'
    }),

  type: Joi.string()
    .valid('full-time', 'part-time', 'contract', 'freelance', 'internship')
    .required()
    .messages({
      'any.only': 'Job type must be one of: full-time, part-time, contract, freelance, internship'
    }),

  category: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.empty': 'Category is required',
      'string.min': 'Category must be at least 2 characters long',
      'string.max': 'Category cannot exceed 50 characters'
    }),

  experienceLevel: Joi.string()
    .valid('entry', 'mid', 'senior', 'executive')
    .required()
    .messages({
      'any.only': 'Experience level must be one of: entry, mid, senior, executive'
    }),

  salary: Joi.object({
    min: Joi.number().min(0).messages({
      'number.min': 'Minimum salary cannot be negative'
    }),
    max: Joi.number().min(0).messages({
      'number.min': 'Maximum salary cannot be negative'
    }),
    currency: Joi.string()
      .valid('USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'INR', 'MAD')
      .default('USD'),
    period: Joi.string()
      .valid('hourly', 'daily', 'weekly', 'monthly', 'yearly')
      .default('yearly')
  }).custom((value, helpers) => {
    if (value.min && value.max && value.min >= value.max) {
      return helpers.error('any.invalid', {
        message: 'Maximum salary must be greater than minimum salary'
      });
    }
    return value;
  }).optional(),

  isRemote: Joi.boolean().default(false),

  skills: Joi.array()
    .items(Joi.string().trim().max(50))
    .max(20)
    .messages({
      'array.max': 'Cannot have more than 20 skills'
    })
    .optional(),

  benefits: Joi.array()
    .items(Joi.string().trim().max(100))
    .max(10)
    .messages({
      'array.max': 'Cannot have more than 10 benefits'
    })
    .optional(),

  requirements: Joi.array()
    .items(Joi.string().trim().max(200))
    .max(15)
    .messages({
      'array.max': 'Cannot have more than 15 requirements'
    })
    .optional(),

  deadlineDate: Joi.date()
    .min('now')
    .messages({
      'date.min': 'Deadline must be in the future'
    })
    .optional(),

  urgency: Joi.string()
    .valid('low', 'medium', 'high')
    .default('medium'),

  tags: Joi.array()
    .items(Joi.string().trim().max(30))
    .max(10)
    .messages({
      'array.max': 'Cannot have more than 10 tags'
    })
    .optional(),

  company: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .messages({
      'string.pattern.base': 'Invalid company ID format'
    })
    .optional()
});

const updateJobValidator = Joi.object({
  title: Joi.string()
    .trim()
    .min(3)
    .max(100)
    .messages({
      'string.min': 'Job title must be at least 3 characters long',
      'string.max': 'Job title cannot exceed 100 characters'
    }),

  description: Joi.string()
    .trim()
    .min(50)
    .max(5000)
    .messages({
      'string.min': 'Job description must be at least 50 characters long',
      'string.max': 'Job description cannot exceed 5000 characters'
    }),

  location: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .messages({
      'string.min': 'Location must be at least 2 characters long',
      'string.max': 'Location cannot exceed 100 characters'
    }),

  type: Joi.string()
    .valid('full-time', 'part-time', 'contract', 'freelance', 'internship')
    .messages({
      'any.only': 'Job type must be one of: full-time, part-time, contract, freelance, internship'
    }),

  category: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .messages({
      'string.min': 'Category must be at least 2 characters long',
      'string.max': 'Category cannot exceed 50 characters'
    }),

  experienceLevel: Joi.string()
    .valid('entry', 'mid', 'senior', 'executive')
    .messages({
      'any.only': 'Experience level must be one of: entry, mid, senior, executive'
    }),

  salary: Joi.object({
    min: Joi.number().min(0).messages({
      'number.min': 'Minimum salary cannot be negative'
    }),
    max: Joi.number().min(0).messages({
      'number.min': 'Maximum salary cannot be negative'
    }),
    currency: Joi.string()
      .valid('USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'INR', 'MAD'),
    period: Joi.string()
      .valid('hourly', 'daily', 'weekly', 'monthly', 'yearly')
  }).custom((value, helpers) => {
    if (value.min && value.max && value.min >= value.max) {
      return helpers.error('any.invalid', {
        message: 'Maximum salary must be greater than minimum salary'
      });
    }
    return value;
  }),

  isRemote: Joi.boolean(),

  skills: Joi.array()
    .items(Joi.string().trim().max(50))
    .max(20)
    .messages({
      'array.max': 'Cannot have more than 20 skills'
    }),

  benefits: Joi.array()
    .items(Joi.string().trim().max(100))
    .max(10)
    .messages({
      'array.max': 'Cannot have more than 10 benefits'
    }),

  requirements: Joi.array()
    .items(Joi.string().trim().max(200))
    .max(15)
    .messages({
      'array.max': 'Cannot have more than 15 requirements'
    }),

  deadlineDate: Joi.date()
    .min('now')
    .messages({
      'date.min': 'Deadline must be in the future'
    }),

  urgency: Joi.string()
    .valid('low', 'medium', 'high'),

  tags: Joi.array()
    .items(Joi.string().trim().max(30))
    .max(10)
    .messages({
      'array.max': 'Cannot have more than 10 tags'
    }),

  status: Joi.string()
    .valid('active', 'paused', 'closed', 'draft')
    .messages({
      'any.only': 'Status must be one of: active, paused, closed, draft'
    })
});

module.exports = {
  jobValidators: {
    createJob: createJobValidator,
    updateJob: updateJobValidator
  }
};