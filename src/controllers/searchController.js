const Job = require('../models/Job');
const aiService = require('../services/AiService');
const calculateCosineSimilarity = require('compute-cosine-similarity');

class SearchController {

    // GET /api/v1/jobs/search/semantic
    async searchJobs(req, res) {
        try {
            const { query } = req.query;

            if (!query) {
                return res.status(400).json({ message: 'Query parameter is required' });
            }

            // 1. Generate embedding for user query
            const queryEmbedding = await aiService.generateEmbedding(query);

            // 2. Fetch active jobs with their embeddings
            // Note: In a real production at scale, use a Vector Database (Pinecone, Atlas Vector Search).
            // For this project (<10k jobs), in-memory comparison is fine.
            const jobs = await Job.find({
                status: 'active',
                embedding: { $exists: true, $ne: [] }
            }).select('+embedding');

            if (!jobs.length) {
                return res.status(200).json([]);
            }

            // 3. Calculate Similarity and Rank
            const rankedJobs = jobs.map(job => {
                const similarity = calculateCosineSimilarity(queryEmbedding, job.embedding);
                return {
                    ...job.toObject(),
                    similarity
                };
            })
                .filter(job => job.similarity > 0.3) // Filter irrelevant results
                .sort((a, b) => b.similarity - a.similarity) // Sort by highest similarity
                .slice(0, 20); // Top 20 results

            // Remove embedding array from response to reduce size
            const cleanResults = rankedJobs.map(({ embedding, ...job }) => job);

            res.status(200).json(cleanResults);

        } catch (error) {
            console.error('Semantic Search Error:', error);
            res.status(500).json({ message: 'Semantic search failed' });
        }
    }

    // POST /api/v1/admin/ai/generate-embeddings
    async generateEmbeddings(req, res) {
        try {
            const jobs = await Job.find({
                $or: [
                    { embedding: { $exists: false } },
                    { embedding: { $size: 0 } }
                ]
            });

            console.log(`[AI] Found ${jobs.length} jobs to process.`);
            let processed = 0;

            // Process in background to avoid timeout
            // Note: In real serverless, this might be killed. In persistent Node, it's ok-ish.
            (async () => {
                for (const job of jobs) {
                    try {
                        // Retrieve full job to be sure
                        const fullJob = await Job.findById(job._id);
                        if (fullJob) {
                            // Pre-save hook will trigger embedding generation!
                            // We just need to mark something as modified??
                            // Or call AiService directly? directly is better.
                            const text = aiService.getJobText(fullJob);
                            fullJob.embedding = await aiService.generateEmbedding(text);
                            await fullJob.save();
                            processed++;
                            if (processed % 10 === 0) console.log(`[AI] Processed ${processed}/${jobs.length}`);
                        }
                    } catch (e) {
                        console.error(`[AI] Error processing job ${job._id}:`, e);
                    }
                }
                console.log(`[AI] Generation Completed. ${processed} jobs updated.`);
            })();

            res.status(200).json({ message: `Started generation for ${jobs.length} jobs. Check server logs for progress.` });

        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
}

module.exports = new SearchController();
