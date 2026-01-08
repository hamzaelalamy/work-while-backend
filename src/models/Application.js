// models/Application.js
const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  applicant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Application must have an applicant']
  },
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: [true, 'Application must be for a specific job']
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'reviewing', 'shortlisted', 'interviewed', 'offered', 'rejected', 'withdrawn'],
      message: 'Status must be one of: pending, reviewing, shortlisted, interviewed, offered, rejected, withdrawn'
    },
    default: 'pending'
  },
  coverLetter: {
    type: String,
    trim: true,
    maxlength: [2000, 'Cover letter cannot exceed 2000 characters']
  },
  resume: {
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    url: String
  },
  additionalDocuments: [{
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    url: String,
    type: {
      type: String,
      enum: ['portfolio', 'certificate', 'reference', 'other']
    }
  }],
  personalInfo: {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters']
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      validate: {
        validator: function(phone) {
          return /^\+?[\d\s\-()]{10,}$/.test(phone);
        },
        message: 'Please provide a valid phone number'
      }
    },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      zipCode: String
    }
  },
  expectedSalary: {
    amount: {
      type: Number,
      min: [0, 'Expected salary cannot be negative']
    },
    currency: {
      type: String,
      enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'INR'],
      default: 'USD'
    },
    period: {
      type: String,
      enum: ['hourly', 'daily', 'weekly', 'monthly', 'yearly'],
      default: 'yearly'
    }
  },
  availability: {
    startDate: {
      type: Date,
      validate: {
        validator: function(date) {
          return !date || date >= new Date();
        },
        message: 'Start date cannot be in the past'
      }
    },
    noticePeriod: {
      type: String,
      enum: ['immediate', '1-week', '2-weeks', '1-month', '2-months', '3-months', 'other']
    },
    workType: {
      type: String,
      enum: ['full-time', 'part-time', 'contract', 'freelance', 'remote', 'hybrid']
    }
  },
  experience: {
    totalYears: {
      type: Number,
      min: [0, 'Experience cannot be negative'],
      max: [50, 'Experience cannot exceed 50 years']
    },
    relevantYears: {
      type: Number,
      min: [0, 'Relevant experience cannot be negative'],
      max: [50, 'Relevant experience cannot exceed 50 years']
    },
    previousPositions: [{
      title: String,
      company: String,
      duration: String,
      description: String
    }]
  },
  skills: [{
    name: {
      type: String,
      trim: true,
      maxlength: [50, 'Skill name cannot exceed 50 characters']
    },
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'expert']
    },
    yearsOfExperience: {
      type: Number,
      min: [0, 'Years of experience cannot be negative']
    }
  }],
  education: [{
    degree: String,
    field: String,
    institution: String,
    graduationYear: {
      type: Number,
      min: [1950, 'Graduation year cannot be before 1950'],
      max: [new Date().getFullYear() + 10, 'Graduation year cannot be too far in the future']
    },
    gpa: {
      type: Number,
      min: [0, 'GPA cannot be negative'],
      max: [4, 'GPA cannot exceed 4.0']
    }
  }],
  languages: [{
    name: String,
    proficiency: {
      type: String,
      enum: ['basic', 'conversational', 'fluent', 'native']
    }
  }],
  timeline: [{
    status: {
      type: String,
      enum: ['submitted', 'reviewing', 'shortlisted', 'interviewed', 'offered', 'rejected', 'withdrawn']
    },
    date: {
      type: Date,
      default: Date.now
    },
    notes: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  notes: {
    applicantNotes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Applicant notes cannot exceed 1000 characters']
    },
    recruiterNotes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Recruiter notes cannot exceed 1000 characters']
    }
  },
  interviews: [{
    type: {
      type: String,
      enum: ['phone', 'video', 'in-person', 'technical', 'final']
    },
    scheduledDate: Date,
    duration: Number, // in minutes
    interviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    feedback: String,
    score: {
      type: Number,
      min: [1, 'Score cannot be less than 1'],
      max: [10, 'Score cannot exceed 10']
    },
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled', 'rescheduled']
    }
  }],
  references: [{
    name: String,
    position: String,
    company: String,
    email: String,
    phone: String,
    relationship: String
  }],
  questionnaire: [{
    question: String,
    answer: String,
    required: Boolean
  }],
  source: {
    type: String,
    enum: ['website', 'linkedin', 'referral', 'job-board', 'company-page', 'other'],
    default: 'website'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, 'Each tag cannot exceed 30 characters']
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
applicationSchema.index({ applicant: 1, job: 1 }, { unique: true }); // Un candidat ne peut postuler qu'une fois par emploi
applicationSchema.index({ job: 1, status: 1 });
applicationSchema.index({ applicant: 1, status: 1 });
applicationSchema.index({ status: 1, createdAt: -1 });
applicationSchema.index({ 'personalInfo.email': 1 });
applicationSchema.index({ createdAt: -1 });

// Virtual pour le nom complet
applicationSchema.virtual('fullName').get(function() {
  if (this.personalInfo) {
    return `${this.personalInfo.firstName} ${this.personalInfo.lastName}`;
  }
  return '';
});

// Virtual pour vérifier si la candidature est récente
applicationSchema.virtual('isRecent').get(function() {
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  return this.createdAt > threeDaysAgo;
});

// Virtual pour calculer la durée depuis la candidature
applicationSchema.virtual('daysAgo').get(function() {
  const now = new Date();
  const diff = now - this.createdAt;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
});

// Middleware pre-save
applicationSchema.pre('save', function(next) {
  // Ajouter une entrée dans la timeline lors de changements de statut
  if (this.isModified('status') && !this.isNew) {
    this.timeline.push({
      status: this.status,
      date: new Date(),
      notes: `Status changed to ${this.status}`
    });
  }
  
  // Ajouter l'entrée initiale dans la timeline pour les nouvelles candidatures
  if (this.isNew) {
    this.timeline.push({
      status: 'submitted',
      date: new Date(),
      notes: 'Application submitted'
    });
  }
  
  // Nettoyer les tags
  if (this.tags) {
    this.tags = [...new Set(this.tags.map(tag => tag.trim().toLowerCase()).filter(Boolean))];
  }
  
  next();
});

// Middleware post-save pour mettre à jour le job
applicationSchema.post('save', async function() {
  try {
    const Job = require('./Job');
    const job = await Job.findById(this.job);
    
    if (job && !job.applications.includes(this._id)) {
      job.applications.push(this._id);
      await job.save();
    }
  } catch (error) {
    console.error('Error updating job applications:', error);
  }
});

// Méthode pour mettre à jour le statut
applicationSchema.methods.updateStatus = function(newStatus, notes = '', updatedBy = null) {
  this.status = newStatus;
  
  // Ajouter à la timeline
  this.timeline.push({
    status: newStatus,
    date: new Date(),
    notes: notes || `Status updated to ${newStatus}`,
    updatedBy
  });
  
  return this.save();
};

// Méthode pour ajouter une interview
applicationSchema.methods.scheduleInterview = function(interviewData) {
  this.interviews.push({
    ...interviewData,
    status: 'scheduled'
  });
  
  return this.save();
};

// Méthode pour ajouter des notes du recruteur
applicationSchema.methods.addRecruiterNotes = function(notes) {
  this.notes.recruiterNotes = notes;
  return this.save();
};

// Méthode pour calculer le score de compatibilité
applicationSchema.methods.calculateCompatibilityScore = function(jobRequirements) {
  let score = 0;
  let maxScore = 0;
  
  // Comparer les compétences
  if (jobRequirements.skills && this.skills) {
    const jobSkills = jobRequirements.skills.map(s => s.toLowerCase());
    const applicantSkills = this.skills.map(s => s.name.toLowerCase());
    
    jobSkills.forEach(skill => {
      maxScore += 10;
      if (applicantSkills.includes(skill)) {
        score += 10;
      }
    });
  }
  
  // Comparer l'expérience
  if (jobRequirements.experienceLevel && this.experience.totalYears !== undefined) {
    maxScore += 20;
    const requiredExp = {
      'entry': 0,
      'mid': 3,
      'senior': 7,
      'executive': 15
    };
    
    const required = requiredExp[jobRequirements.experienceLevel] || 0;
    if (this.experience.totalYears >= required) {
      score += 20;
    } else if (this.experience.totalYears >= required * 0.7) {
      score += 10;
    }
  }
  
  return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
};

// Méthode statique pour obtenir les statistiques des candidatures
applicationSchema.statics.getApplicationStats = function(filters = {}) {
  const pipeline = [];
  
  // Ajouter des filtres si nécessaire
  if (Object.keys(filters).length > 0) {
    pipeline.push({ $match: filters });
  }
  
  pipeline.push({
    $group: {
      _id: null,
      totalApplications: { $sum: 1 },
      pendingApplications: {
        $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
      },
      reviewingApplications: {
        $sum: { $cond: [{ $eq: ['$status', 'reviewing'] }, 1, 0] }
      },
      shortlistedApplications: {
        $sum: { $cond: [{ $eq: ['$status', 'shortlisted'] }, 1, 0] }
      },
      rejectedApplications: {
        $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
      },
      averageResponseTime: { $avg: '$responseTime' }
    }
  });
  
  return this.aggregate(pipeline);
};

// Méthode statique pour rechercher des candidatures
applicationSchema.statics.searchApplications = function(searchTerm, filters = {}) {
  const query = this.find();
  
  if (searchTerm) {
    query.where({
      $or: [
        { 'personalInfo.firstName': { $regex: searchTerm, $options: 'i' } },
        { 'personalInfo.lastName': { $regex: searchTerm, $options: 'i' } },
        { 'personalInfo.email': { $regex: searchTerm, $options: 'i' } },
        { 'skills.name': { $in: [new RegExp(searchTerm, 'i')] } }
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

const Application = mongoose.model('Application', applicationSchema);

module.exports = Application;