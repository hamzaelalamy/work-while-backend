/**
 * Vector Search Service
 * Uses MongoDB Atlas Vector Search ($vectorSearch) when available,
 * otherwise falls back to application-side cosine similarity.
 */
const Job = require('../models/Job');
const calculateCosineSimilarity = require('compute-cosine-similarity');

/** Atlas vector search index name - must match the index created in Atlas */
const VECTOR_INDEX_NAME = 'job_embedding_index';
const EMBEDDING_PATH = 'embedding';
const DEFAULT_NUM_CANDIDATES = 200;
const DEFAULT_LIMIT = 20;
const DEBUG = process.env.DEBUG_VECTOR === 'true';

/**
 * Find jobs most similar to a query embedding using Atlas $vectorSearch or fallback.
 * @param {number[]} queryEmbedding - Vector (e.g. from CV), same dimension as job.embedding
 * @param {Object} options - { limit, numCandidates }
 * @returns {Promise<Array<{ job: Object, score: number }>>}
 */
async function findSimilarJobs(queryEmbedding, options = {}) {
  const limit = Math.min(options.limit || DEFAULT_LIMIT, 50);
  const numCandidates = options.numCandidates || DEFAULT_NUM_CANDIDATES;

  if (!queryEmbedding || !Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
    if (DEBUG) console.log('[VectorSearch] No valid query embedding');
    return [];
  }

  if (DEBUG) {
    console.log('[VectorSearch] Query embedding length:', queryEmbedding.length, 'numCandidates:', numCandidates, 'limit:', limit);
  }

  // Try Atlas Vector Search first (requires Atlas M10+ and index)
  try {
    const pipeline = [
      {
        $vectorSearch: {
          index: VECTOR_INDEX_NAME,
          path: EMBEDDING_PATH,
          queryVector: queryEmbedding,
          numCandidates: numCandidates,
          limit: limit,
          filter: { status: 'active' }
        }
      },
      {
        $project: {
          title: 1,
          description: 1,
          skills: 1,
          location: 1,
          type: 1,
          category: 1,
          experienceLevel: 1,
          salary: 1,
          company: 1,
          companyName: 1,
          status: 1,
          createdAt: 1,
          score: { $meta: 'vectorSearchScore' }
        }
      },
      {
        $lookup: {
          from: 'companies',
          localField: 'company',
          foreignField: '_id',
          as: 'companyDoc',
          pipeline: [{ $project: { name: 1, logo: 1, location: 1 } }]
        }
      },
      {
        $addFields: {
          company: { $arrayElemAt: ['$companyDoc', 0] }
        }
      },
      { $project: { companyDoc: 0 } }
    ];

    const JobCollection = Job.collection;
    const cursor = JobCollection.aggregate(pipeline);
    const results = await cursor.toArray();

    if (DEBUG && results.length > 0) {
      const scores = results.map(r => r.score);
      console.log('[VectorSearch] Atlas results:', results.length, 'scores sample:', scores.slice(0, 3));
    }

    // If Atlas returns 0 results (e.g. index empty, not synced, or no matching docs), use fallback
    // so we still get semantic matches from DB when jobs have embeddings
    if (results.length === 0) {
      if (DEBUG) console.log('[VectorSearch] Atlas returned 0 results, trying fallback');
      return findSimilarJobsFallback(queryEmbedding, limit);
    }

    return results.map(doc => ({
      job: doc,
      score: doc.score != null ? doc.score : 0
    }));
  } catch (atlasError) {
    // Atlas vector search not available (e.g. index missing, or not Atlas)
    if (atlasError.message && (atlasError.message.includes('vector') || atlasError.message.includes('index') || atlasError.code === 267)) {
      console.warn('[VectorSearch] Atlas $vectorSearch not available, using fallback:', atlasError.message);
      return findSimilarJobsFallback(queryEmbedding, limit);
    }
    throw atlasError;
  }
}

/**
 * Fallback: load jobs with embeddings and compute cosine similarity in Node.
 */
async function findSimilarJobsFallback(queryEmbedding, limit = DEFAULT_LIMIT) {
  const jobs = await Job.find({
    status: 'active',
    embedding: { $exists: true, $ne: [] }
  })
    .select('+embedding')
    .populate('company', 'name logo location')
    .lean();

  if (DEBUG) console.log('[VectorSearch] Fallback: jobs with embeddings:', jobs.length);

  // Score all jobs; only skip if embedding dimension mismatch (would produce wrong similarity)
  const queryLen = queryEmbedding.length;
  const scored = jobs
    .map(job => {
      const emb = job.embedding || [];
      if (emb.length !== queryLen) return null; // dimension mismatch
      const similarity = calculateCosineSimilarity(queryEmbedding, emb);
      return { job: { ...job, embedding: undefined }, score: Number.isFinite(similarity) ? similarity : 0 };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (DEBUG && scored.length > 0) {
    console.log('[VectorSearch] Fallback results:', scored.length, 'scores:', scored.map(s => s.score).slice(0, 3));
  }

  return scored;
}

/**
 * Get recent active jobs (no similarity). Used when vector search returns too few results.
 */
async function getRecentActiveJobs(limit = 10) {
  const jobs = await Job.find({ status: 'active' })
    .populate('company', 'name logo location')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return jobs.map(job => ({ job, score: 0 }));
}

/**
 * Normalize vector search score to a 0-100 similarity percentage for display.
 * Atlas returns score in [0,1] or similar; cosine is in [-1,1]. We map to 0-100.
 */
function scoreToPercentage(score) {
  if (score == null || typeof score !== 'number') return 0;
  // Cosine similarity is in [-1, 1]; map to [0, 100]. Atlas vectorSearchScore is often in [0,1].
  if (score <= 1 && score >= 0) return Math.round(score * 100);
  const normalized = (score + 1) / 2;
  return Math.round(Math.max(0, Math.min(1, normalized)) * 100);
}

module.exports = {
  findSimilarJobs,
  findSimilarJobsFallback,
  getRecentActiveJobs,
  scoreToPercentage,
  VECTOR_INDEX_NAME,
  EMBEDDING_PATH
};
