/**
 * CV-based Job Matching Controller
 * Upload CV -> extract text -> generate embedding -> vector search -> return matched jobs with scores.
 */
const CandidateProfile = require('../models/CandidateProfile');
const { catchAsync, AppError, sendResponse } = require('../utils/helpers');
const cvExtractionService = require('../services/cvExtractionService');
const vectorSearchService = require('../services/vectorSearchService');
const AiService = require('../services/AiService');

/**
 * POST /api/cv/upload
 * Upload CV (PDF/DOCX), extract text, generate embedding, run vector search, return matches.
 */
const uploadCVAndGetMatches = catchAsync(async (req, res, next) => {
  if (!req.file || !req.file.buffer) {
    return next(new AppError('No CV file uploaded. Use field name "cv" and PDF or DOCX.', 400));
  }

  const userId = req.user._id;
  const limitParam = req.body.limit != null ? req.body.limit : req.query.limit;

  // 1) Extract text
  const { text } = await cvExtractionService.extractTextFromBuffer(
    req.file.buffer,
    req.file.mimetype
  );

  // 2) Generate embedding (same model as jobs: 384-dim Xenova)
  const embedding = await AiService.generateEmbedding(text);
  if (!embedding || embedding.length === 0) {
    return next(new AppError('Failed to generate CV embedding.', 500));
  }

  // 3) Store/update candidate profile (optional: keep last N or overwrite)
  await CandidateProfile.findOneAndUpdate(
    { user: userId },
    {
      user: userId,
      originalFilename: req.file.originalname,
      extractedText: text.substring(0, 30000),
      embedding,
      extractedSkills: extractSkillsFromText(text)
    },
    { upsert: true, new: true }
  );

  // 4) Vector search (numCandidates 200 for better coverage)
  const limitNum = Math.min(parseInt(limitParam, 10) || 20, 50);
  let results = await vectorSearchService.findSimilarJobs(embedding, {
    limit: limitNum,
    numCandidates: 200
  });

  const semanticCount = results.length;
  if (semanticCount === 0) {
    const Job = require('../models/Job');
    const activeWithEmbedding = await Job.countDocuments({
      status: 'active',
      embedding: { $exists: true, $ne: [] }
    });
    const activeTotal = await Job.countDocuments({ status: 'active' });
    console.warn('[CV Match] 0 semantic results. Active jobs:', activeTotal, 'active with embedding:', activeWithEmbedding, 'CV embedding length:', embedding.length);
  }

  // 5) Fallback: only pad with recent jobs when we have few semantic results (so list still varies by CV when we have some)
  const minResults = Math.min(10, limitNum);
  if (results.length < minResults) {
    const recent = await vectorSearchService.getRecentActiveJobs(limitNum);
    const seenIds = new Set(results.map(r => (r.job && r.job._id && r.job._id.toString())).filter(Boolean));
    for (const { job } of recent) {
      if (job && job._id && !seenIds.has(job._id.toString()) && results.length < limitNum) {
        results.push({ job, score: 0 });
        seenIds.add(job._id.toString());
      }
    }
  }

  // 6) Format response: jobs with similarity percentage and matching skills
  const jobsWithScores = results.map(({ job, score }) => {
    const similarityPercent = vectorSearchService.scoreToPercentage(score);
    const jobObj = job && job._id ? { ...job, id: job._id } : job;
    const matchingSkills = getMatchingSkills(text, job?.skills || []);
    return {
      ...jobObj,
      similarityScore: similarityPercent,
      matchingSkills
    };
  });

  const usedFallback = results.some(r => r.score === 0);
  sendResponse(res, 200, 'success', usedFallback
    ? (semanticCount === 0
      ? 'No personalized matches (run "npm run vectorize-jobs" to vectorize jobs). Showing recent listings.'
      : 'CV processed. Some jobs are recent listings (no similarity score).')
    : 'CV processed and matches retrieved',
  {
    matches: jobsWithScores,
    total: jobsWithScores.length,
    semanticCount,
    ...(usedFallback && { fallback: true })
  });
});

/**
 * GET /api/cv/matches
 * Get job matches for the current user's latest CV embedding (no new upload).
 */
const getMatches = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);

  const profile = await CandidateProfile.findOne({ user: userId })
    .select('embedding extractedText')
    .sort({ createdAt: -1 })
    .lean();

  if (!profile || !profile.embedding || profile.embedding.length === 0) {
    return sendResponse(res, 200, 'success', 'No CV uploaded yet. Upload a CV to get matches.', {
      matches: [],
      total: 0
    });
  }

  let results = await vectorSearchService.findSimilarJobs(profile.embedding, { limit, numCandidates: 200 });
  const semanticCount = results.length;
  const minResults = Math.min(10, limit);
  if (results.length < minResults) {
    const recent = await vectorSearchService.getRecentActiveJobs(limit);
    const seenIds = new Set(results.map(r => (r.job && r.job._id && r.job._id.toString())).filter(Boolean));
    for (const { job } of recent) {
      if (job && job._id && !seenIds.has(job._id.toString()) && results.length < limit) {
        results.push({ job, score: 0 });
        seenIds.add(job._id.toString());
      }
    }
  }
  const text = profile.extractedText || '';

  const jobsWithScores = results.map(({ job, score }) => {
    const similarityPercent = vectorSearchService.scoreToPercentage(score);
    const jobObj = job && job._id ? { ...job, id: job._id } : job;
    const matchingSkills = getMatchingSkills(text, job?.skills || []);
    return {
      ...jobObj,
      similarityScore: similarityPercent,
      matchingSkills
    };
  });

  const usedFallback = results.some(r => r.score === 0);
  sendResponse(res, 200, 'success', usedFallback
    ? (semanticCount === 0
      ? 'No personalized matches. Showing recent listings.'
      : 'Matches retrieved. Some are recent listings.')
    : 'Matches retrieved',
  {
    matches: jobsWithScores,
    total: jobsWithScores.length,
    semanticCount,
    ...(usedFallback && { fallback: true })
  });
});

/**
 * Simple skill extraction from text: look for common skill-like words (capitalized, known list).
 * For production, consider NER or a skills taxonomy.
 */
function extractSkillsFromText(text) {
  const skillLike = new Set();
  const words = (text || '').split(/\s+/).filter(w => w.length >= 2 && w.length <= 40);
  const commonSkills = [
    'JavaScript', 'Python', 'Java', 'React', 'Node', 'SQL', 'MongoDB', 'AWS', 'Git',
    'Communication', 'Leadership', 'Management', 'Analytics', 'Excel', 'Marketing',
    'Sales', 'Design', 'UX', 'UI', 'Testing', 'Agile', 'Scrum', 'French', 'English', 'Arabic'
  ];
  const lower = text.toLowerCase();
  commonSkills.forEach(skill => {
    if (lower.includes(skill.toLowerCase())) skillLike.add(skill);
  });
  return Array.from(skillLike).slice(0, 30);
}

/**
 * Find which job skills appear in the CV text (case-insensitive) for highlighting.
 */
function getMatchingSkills(cvText, jobSkills) {
  if (!Array.isArray(jobSkills) || jobSkills.length === 0) return [];
  const lower = (cvText || '').toLowerCase();
  return jobSkills.filter(skill => lower.includes(String(skill).toLowerCase()));
}

module.exports = {
  uploadCVAndGetMatches,
  getMatches
};
