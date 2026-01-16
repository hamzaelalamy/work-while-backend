// models/Job.js - FIXED VERSION with MAD currency
const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Job title is required'],
    trim: true,
    maxlength: [100, 'Job title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Job description is required'],
    trim: true,
    maxlength: [5000, 'Job description cannot exceed 5000 characters']
  },
  location: {
    type: String,
    required: [true, 'Job location is required'],
    trim: true,
    maxlength: [100, 'Location cannot exceed 100 characters']
  },
  type: {
    type: String,
    required: [true, 'Job type is required'],
    enum: {
      values: ['full-time', 'part-time', 'contract', 'freelance', 'internship'],
      message: 'Job type must be one of: full-time, part-time, contract, freelance, internship'
    }
  },
  category: {
    type: String,
    required: [true, 'Job category is required'],
    trim: true,
    maxlength: [50, 'Category cannot exceed 50 characters']
  },
  experienceLevel: {
    type: String,
    required: [true, 'Experience level is required'],
    enum: {
      values: ['entry', 'mid', 'senior', 'executive'],
      message: 'Experience level must be one of: entry, mid, senior, executive'
    }
  },
  salary: {
    min: {
      type: Number,
      min: [0, 'Minimum salary cannot be negative']
    },
    max: {
      type: Number,
      min: [0, 'Maximum salary cannot be negative']
    },
    currency: {
      type: String,
      // ✅ FIXED: Added MAD to the enum values
      enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'INR', 'MAD'],
      default: 'USD'
    },
    period: {
      type: String,
      enum: ['hourly', 'daily', 'weekly', 'monthly', 'yearly'],
      default: 'yearly'
    }
  },
  isRemote: {
    type: Boolean,
    default: false
  },
  skills: [{
    type: String,
    trim: true,
    maxlength: [50, 'Each skill cannot exceed 50 characters']
  }],
  benefits: [{
    type: String,
    trim: true,
    maxlength: [100, 'Each benefit cannot exceed 100 characters']
  }],
  requirements: [{
    type: String,
    trim: true,
    maxlength: [200, 'Each requirement cannot exceed 200 characters']
  }],
  deadlineDate: {
    type: Date,
    validate: {
      validator: function (date) {
        return !date || date > new Date();
      },
      message: 'Deadline must be in the future'
    }
  },
  status: {
    type: String,
    enum: {
      values: ['active', 'paused', 'closed', 'draft'],
      message: 'Status must be one of: active, paused, closed, draft'
    },
    default: 'active'
  },
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Job must have a poster']
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company'
  },
  companyName: {
    type: String,
    trim: true,
    maxlength: [100, 'Company name cannot exceed 100 characters']
  },
  applications: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application'
  }],
  viewsCount: {
    type: Number,
    default: 0
  },
  urgency: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  featured: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, 'Each tag cannot exceed 30 characters']
  }],
  // Scraping fields
  source: {
    type: String,
    default: 'internal',
    index: true // "internal", "indeed", "maroc-annonce"
  },
  originalLink: {
    type: String,
    unique: true,
    sparse: true, // Allows null/undefined for internal jobs
    select: false
  },
  externalId: {
    type: String,
    index: true
  },
  isScraped: {
    type: Boolean,
    default: false
  },
  // AI Embeddings
  embedding: {
    type: [Number], // 384 dimensions for all-MiniLM-L6-v2
    select: false   // Don't return by default to save bandwidth
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Pre-save hook to generate embedding
jobSchema.pre('save', async function (next) {
  if (this.isModified('title') || this.isModified('description') || this.isModified('skills')) {
    try {
      const AiService = require('../services/AiService');
      const text = AiService.getJobText(this);
      this.embedding = await AiService.generateEmbedding(text);
    } catch (error) {
      console.error('Error generating embedding:', error);
      // Don't block save on AI failure
    }
  }
  next();
});

// Indexes pour optimiser les requêtes
jobSchema.index({ title: 'text', description: 'text', skills: 'text' });
jobSchema.index({ status: 1, createdAt: -1 });
jobSchema.index({ location: 1 });
jobSchema.index({ type: 1 });
jobSchema.index({ category: 1 });
jobSchema.index({ experienceLevel: 1 });
jobSchema.index({ isRemote: 1 });
jobSchema.index({ postedBy: 1 });
jobSchema.index({ company: 1 });
jobSchema.index({ 'salary.min': 1, 'salary.max': 1 });
jobSchema.index({ featured: 1, createdAt: -1 });

// Virtual pour le nombre de candidatures
jobSchema.virtual('applicationsCount').get(function () {
  return this.applications ? this.applications.length : 0;
});

// Virtual pour vérifier si l'emploi est nouveau (moins de 7 jours)
jobSchema.virtual('isNew').get(function () {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  return this.createdAt > weekAgo;
});

// Virtual pour vérifier si l'emploi expire bientôt
jobSchema.virtual('expiresSoon').get(function () {
  if (!this.deadlineDate) return false;
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  return this.deadlineDate <= threeDaysFromNow;
});

// Virtual pour le salaire formaté
jobSchema.virtual('formattedSalary').get(function () {
  if (!this.salary || (!this.salary.min && !this.salary.max)) {
    return 'Salary not specified';
  }

  const currency = this.salary.currency || 'USD';
  const period = this.salary.period || 'yearly';

  if (this.salary.min && this.salary.max) {
    return `${currency} ${this.salary.min.toLocaleString()} - ${this.salary.max.toLocaleString()} per ${period}`;
  } else if (this.salary.min) {
    return `From ${currency} ${this.salary.min.toLocaleString()} per ${period}`;
  } else if (this.salary.max) {
    return `Up to ${currency} ${this.salary.max.toLocaleString()} per ${period}`;
  }
});

// Middleware pre-save pour valider les données
jobSchema.pre('save', function (next) {
  // Valider que max salary >= min salary
  if (this.salary && this.salary.min && this.salary.max) {
    if (this.salary.max < this.salary.min) {
      return next(new Error('Maximum salary must be greater than or equal to minimum salary'));
    }
  }

  // Nettoyer les skills (supprimer les doublons et les espaces)
  if (this.skills) {
    this.skills = [...new Set(this.skills.map(skill => skill.trim()).filter(Boolean))];
  }

  // Nettoyer les benefits
  if (this.benefits) {
    this.benefits = [...new Set(this.benefits.map(benefit => benefit.trim()).filter(Boolean))];
  }

  // Nettoyer les requirements
  if (this.requirements) {
    this.requirements = [...new Set(this.requirements.map(req => req.trim()).filter(Boolean))];
  }

  // Nettoyer les tags
  if (this.tags) {
    this.tags = [...new Set(this.tags.map(tag => tag.trim().toLowerCase()).filter(Boolean))];
  }

  next();
});

// Méthode statique pour rechercher des emplois
jobSchema.statics.searchJobs = function (searchTerm, filters = {}) {
  const query = this.find();

  if (searchTerm) {
    query.where({
      $or: [
        { title: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } },
        { skills: { $in: [new RegExp(searchTerm, 'i')] } }
      ]
    });
  }

  // Appliquer les filtres
  Object.keys(filters).forEach(key => {
    if (filters[key] !== undefined && filters[key] !== '') {
      query.where(key, filters[key]);
    }
  });

  return query;
};

// Méthode pour obtenir les emplois similaires
jobSchema.methods.getSimilarJobs = function (limit = 5) {
  return this.constructor.find({
    _id: { $ne: this._id },
    $or: [
      { category: this.category },
      { skills: { $in: this.skills } },
      { location: this.location }
    ],
    status: 'active'
  })
    .limit(limit)
    .populate('company', 'name logo')
    .sort({ createdAt: -1 });
};

// Méthode pour vérifier si un utilisateur peut postuler
jobSchema.methods.canUserApply = function (userId) {
  // Vérifier si l'utilisateur a déjà postulé
  return !this.applications.some(appId => appId.toString() === userId.toString());
};

// Méthode pour incrémenter les vues
jobSchema.methods.incrementViews = function () {
  this.viewsCount = (this.viewsCount || 0) + 1;
  return this.save({ validateBeforeSave: false });
};

// Méthode pour mettre à jour le statut
jobSchema.methods.updateStatus = function (newStatus) {
  this.status = newStatus;
  return this.save();
};

const Job = mongoose.model('Job', jobSchema);

module.exports = Job;