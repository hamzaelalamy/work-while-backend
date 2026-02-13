/**
 * Script to vectorize job postings (add or refresh embeddings).
 * Run from backend root: node src/scripts/vectorizeJobs.js [--force]
 *
 * By default: only jobs without an embedding (or empty) are processed.
 * With --force: all active jobs are re-vectorized (overwrites existing embedding).
 *
 * Uses the same embedding model as the app (Xenova/all-MiniLM-L6-v2, 384 dimensions).
 */
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const Job = require('../models/Job');
const AiService = require('../services/AiService');

const EXPECTED_DIM = 384; // all-MiniLM-L6-v2
const force = process.argv.includes('--force');

async function vectorizeAllJobs() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected.');

    const query = force
      ? {} // all jobs
      : {
          $or: [
            { embedding: { $exists: false } },
            { embedding: { $size: 0 } },
            { embedding: null }
          ]
        };
    const jobs = await Job.find(query).select('title description skills requirements status');

    console.log(force ? `Found ${jobs.length} jobs (re-vectorizing all).` : `Found ${jobs.length} jobs without embeddings.`);

    if (jobs.length === 0) {
      if (!force) console.log('Nothing to do. Run with --force to re-vectorize all jobs.');
      process.exit(0);
      return;
    }

    let processed = 0;
    let failed = 0;

    for (const job of jobs) {
      try {
        const text = AiService.getJobText(job);
        if (!text || !text.trim()) {
          console.warn(`[Skip] Job ${job._id}: no text to embed`);
          failed++;
          continue;
        }
        const embedding = await AiService.generateEmbedding(text);
        if (!embedding || !Array.isArray(embedding)) {
          console.warn(`[Skip] Job ${job._id}: no embedding returned`);
          failed++;
          continue;
        }
        if (embedding.length !== EXPECTED_DIM) {
          console.warn(`[Warn] Job ${job._id}: embedding length ${embedding.length} (expected ${EXPECTED_DIM})`);
        }
        await Job.updateOne(
          { _id: job._id },
          { $set: { embedding } }
        );
        processed++;
        if (processed % 5 === 0) {
          console.log(`Processed ${processed}/${jobs.length} jobs...`);
        }
      } catch (err) {
        console.error(`Error processing job ${job._id}:`, err.message);
        failed++;
      }
    }

    console.log(`Done. Vectorized ${processed} jobs, ${failed} failed/skipped.`);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('DB connection closed.');
    process.exit(0);
  }
}

vectorizeAllJobs();
