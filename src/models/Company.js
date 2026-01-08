// src/models/Company.js
const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
    maxlength: [100, 'Company name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Company description cannot exceed 1000 characters']
  },
  industry: {
    type: String,
    required: [true, 'Industry is required'],
    enum: ['technology', 'finance', 'healthcare', 'education', 'retail', 'manufacturing', 'consulting', 'other']
  },
  size: {
    type: String,
    required: [true, 'Company size is required'],
    enum: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true
  },
  website: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Allow empty website
        return /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/.test(v);
      },
      message: 'Please enter a valid website URL'
    }
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Allow empty email
        return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v);
      },
      message: 'Please enter a valid email address'
    }
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    validate: {
      validator: function(v) {
        return /^[\+]?[\d\s\-\(\)]{10,}$/.test(v);
      },
      message: 'Please enter a valid phone number (at least 10 digits)'
    }
  },
  logo: {
    type: String,
    trim: true
  },
  founded: {
    type: Date
  },
  employer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Employer reference is required']
  },
  socialMedia: {
    linkedin: {
      type: String,
      trim: true
    },
    twitter: {
      type: String,
      trim: true
    },
    facebook: {
      type: String,
      trim: true
    }
  },
  benefits: [{
    type: String,
    trim: true
  }],
  culture: {
    type: String,
    trim: true,
    maxlength: [500, 'Culture description cannot exceed 500 characters']
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for getting jobs posted by this company
companySchema.virtual('jobs', {
  ref: 'Job',
  localField: '_id',
  foreignField: 'company'
});

// Indexes for better query performance
companySchema.index({ employer: 1 });
companySchema.index({ industry: 1 });
companySchema.index({ location: 1 });
companySchema.index({ name: 'text', description: 'text' });

// Pre-save middleware to ensure only one company per employer
companySchema.pre('save', async function(next) {
  if (this.isNew) {
    const existingCompany = await this.constructor.findOne({ employer: this.employer });
    if (existingCompany) {
      const error = new Error('Employer already has a company profile');
      error.name = 'ValidationError';
      return next(error);
    }
  }
  next();
});

const Company = mongoose.model('Company', companySchema);

module.exports = Company;