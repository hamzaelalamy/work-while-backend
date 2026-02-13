const Job = require('../models/Job');
const aiService = require('../services/AiService');
const calculateCosineSimilarity = require('compute-cosine-similarity');

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class SearchController {

    // GET /api/jobs/search/semantic - AI-powered search matching keywords in titles, descriptions, skills
    async searchJobs(req, res) {
        try {
            const { query } = req.query;

            if (!query || !String(query).trim()) {
                return res.status(400).json({ message: 'Query parameter is required' });
            }

            const searchQuery = String(query).trim();

            // 1. Generate embedding for user query for semantic matching
            let queryEmbedding = null;
            try {
                queryEmbedding = await aiService.generateEmbedding(searchQuery);
            } catch (aiErr) {
                console.warn('[AI Search] Embedding generation failed, using text fallback:', aiErr.message);
            }

            // 2. Fetch active jobs - prefer those with embeddings for semantic search
            const jobsWithEmbeddings = await Job.find({
                status: 'active',
                embedding: { $exists: true, $ne: [] }
            }).select('+embedding')
                .lean();

            // 3. If we have embeddings, do semantic similarity search
            if (queryEmbedding && jobsWithEmbeddings.length > 0) {
                const rankedJobs = jobsWithEmbeddings
                    .map(job => {
                        const similarity = calculateCosineSimilarity(queryEmbedding, job.embedding);
                        return { ...job, similarity };
                    })
                    .filter(job => job.similarity > 0.25) // Lowered threshold for broader matching
                    .sort((a, b) => b.similarity - a.similarity)
                    .slice(0, 50);

                const cleanResults = rankedJobs.map(({ embedding, ...job }) => job);
                return res.status(200).json(cleanResults);
            }

            // 4. Fallback: keyword search - match query in title, description, skills, category
            // Supports phrase match and individual keywords
            const keywords = searchQuery.split(/\s+/).filter(Boolean);
            const orConditions = [
                { title: { $regex: searchQuery, $options: 'i' } },
                { description: { $regex: searchQuery, $options: 'i' } },
                { category: { $regex: searchQuery, $options: 'i' } },
                { skills: { $in: [new RegExp(escapeRegex(searchQuery), 'i')] } }
            ];
            // Also match any individual keyword for powerful multi-word search
            keywords.forEach(kw => {
                if (kw.length >= 2) {
                    const re = new RegExp(escapeRegex(kw), 'i');
                    orConditions.push(
                        { title: { $regex: re } },
                        { description: { $regex: re } },
                        { skills: { $in: [re] } }
                    );
                }
            });

            const textMatchJobs = await Job.find({
                status: 'active',
                $or: orConditions
            })
                .limit(50)
                .lean();

            res.status(200).json(textMatchJobs);

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
