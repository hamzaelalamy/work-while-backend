/**
 * CandidateProfile - stores CV-derived data and embedding for vector search.
 * One document per user per upload (latest overwrites or we keep history by not overwriting).
 */
const mongoose = require('mongoose');

const candidateProfileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  originalFilename: {
    type: String,
    trim: true,
    maxlength: 255
  },
  extractedText: {
    type: String,
    trim: true,
    maxlength: 30000,
    select: false // Don't return in API by default
  },
  /** Embedding vector (same dimension as Job.embedding, e.g. 384 for Xenova/all-MiniLM-L6-v2) */
  embedding: {
    type: [Number],
    required: true,
    select: false
  },
  /** Optional: extracted skills for highlighting (e.g. from NER or keyword extraction) */
  extractedSkills: [{
    type: String,
    trim: true,
    maxlength: 100
  }]
}, {
  timestamps: true
});

candidateProfileSchema.index({ user: 1, createdAt: -1 });

const CandidateProfile = mongoose.model('CandidateProfile', candidateProfileSchema);
module.exports = CandidateProfile;
