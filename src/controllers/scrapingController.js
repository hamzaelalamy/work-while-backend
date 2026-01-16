const scraperManager = require('../services/scraping/ScraperManager');
const ScrapingLog = require('../models/ScrapingLog');
const Job = require('../models/Job');

class ScrapingController {
    // Trigger scraping
    async triggerScraping(req, res) {
        try {
            const { source } = req.body; // 'indeed', 'maroc-annonce', 'rekrute', or 'all'

            if (!source) {
                return res.status(400).json({ message: 'Source is required' });
            }

            const result = await scraperManager.runScraper(source);
            res.status(200).json(result);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    // Get scraping history/logs
    async getHistory(req, res) {
        try {
            const logs = await ScrapingLog.find().sort({ createdAt: -1 }).limit(20);
            res.status(200).json(logs);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    // Get scraped jobs (Drafts)
    async getScrapedJobs(req, res) {
        try {
            const jobs = await Job.find({ isScraped: true, status: 'draft' })
                .sort({ createdAt: -1 })
                .limit(50);
            res.status(200).json(jobs);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    // Approve a scraped job (Publish it)
    async approveJob(req, res) {
        try {
            const { id } = req.params;
            const job = await Job.findByIdAndUpdate(
                id,
                { status: 'active' },
                { new: true }
            );

            if (!job) return res.status(404).json({ message: 'Job not found' });

            res.status(200).json({ message: 'Job approved and published', job });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    // Reject/Delete a scraped job
    async rejectJob(req, res) {
        try {
            const { id } = req.params;
            await Job.findByIdAndDelete(id);
            res.status(200).json({ message: 'Job rejected and deleted' });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    // Bulk approve scraped jobs
    async bulkApproveJobs(req, res) {
        console.log('[BULK APPROVE BACKEND] Request received');
        console.log('[BULK APPROVE BACKEND] Body:', req.body);
        console.log('[BULK APPROVE BACKEND] User:', req.user?.email);

        try {
            const { jobIds } = req.body;

            console.log('[BULK APPROVE BACKEND] Job IDs received:', jobIds);
            console.log('[BULK APPROVE BACKEND] Job IDs count:', jobIds?.length);

            if (!Array.isArray(jobIds) || jobIds.length === 0) {
                console.log('[BULK APPROVE BACKEND] Invalid jobIds - returning 400');
                return res.status(400).json({ message: 'jobIds array is required' });
            }

            console.log('[BULK APPROVE BACKEND] Updating jobs in database...');
            const result = await Job.updateMany(
                { _id: { $in: jobIds }, isScraped: true, status: 'draft' },
                { status: 'active' }
            );

            console.log('[BULK APPROVE BACKEND] Update result:', result);
            console.log('[BULK APPROVE BACKEND] Modified count:', result.modifiedCount);

            res.status(200).json({
                message: `${result.modifiedCount} job(s) approved and published`,
                modifiedCount: result.modifiedCount
            });
        } catch (error) {
            console.error('[BULK APPROVE BACKEND] Error:', error);
            res.status(500).json({ message: error.message });
        }
    }

    // Bulk reject/delete scraped jobs
    async bulkRejectJobs(req, res) {
        try {
            const { jobIds } = req.body;

            if (!Array.isArray(jobIds) || jobIds.length === 0) {
                return res.status(400).json({ message: 'jobIds array is required' });
            }

            const result = await Job.deleteMany(
                { _id: { $in: jobIds }, isScraped: true, status: 'draft' }
            );

            res.status(200).json({
                message: `${result.deletedCount} job(s) rejected and deleted`,
                deletedCount: result.deletedCount
            });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
}

module.exports = new ScrapingController();
