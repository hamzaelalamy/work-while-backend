const Job = require('../models/Job');
const Company = require('../models/Company');
const Application = require('../models/Application');
const User = require('../models/User');

class AnalyticsController {

    // GET /api/v1/analytics/overview
    async getMarketOverview(req, res) {
        try {
            const totalJobs = await Job.countDocuments();
            const activeJobs = await Job.countDocuments({ status: 'active' });
            const totalCompanies = await Company.countDocuments();
            const totalApplications = await Application.countDocuments();
            const totalCandidates = await User.countDocuments({ role: 'candidate' });

            // Scraped vs Internal
            const sourceDistribution = await Job.aggregate([
                {
                    $group: {
                        _id: "$source",
                        count: { $sum: 1 }
                    }
                }
            ]);

            res.status(200).json({
                totalJobs,
                activeJobs,
                totalCompanies,
                totalApplications,
                totalCandidates,
                sourceDistribution
            });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    // GET /api/v1/analytics/sectors
    async getTopSectors(req, res) {
        try {
            const sectors = await Job.aggregate([
                { $match: { status: { $in: ['active', 'draft'] } } },
                {
                    $group: {
                        _id: "$category",
                        count: { $sum: 1 },
                        avgSalary: { $avg: "$salary.max" }
                    }
                },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]);

            res.status(200).json(sectors);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    // GET /api/v1/analytics/skills
    async getTopSkills(req, res) {
        try {
            const skills = await Job.aggregate([
                { $match: { status: 'active' } },
                { $unwind: "$skills" },
                {
                    $group: {
                        _id: { $toLower: "$skills" }, // Normalize skill name
                        count: { $sum: 1 }
                    }
                },
                { $sort: { count: -1 } },
                { $limit: 20 }
            ]);

            res.status(200).json(skills);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    // GET /api/v1/analytics/locations
    async getLocationTrends(req, res) {
        try {
            const locations = await Job.aggregate([
                {
                    $group: {
                        _id: "$location",
                        count: { $sum: 1 },
                        avgSalary: { $avg: { $ifNull: ["$salary.max", 0] } }
                    }
                },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]);

            res.status(200).json(locations);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    // GET /api/v1/analytics/trends (Time series – last 30 calendar days)
    async getJobTrends(req, res) {
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const trends = await Job.aggregate([
                { $match: { createdAt: { $gte: thirtyDaysAgo } } },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                        },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]);

            res.status(200).json(trends);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    // GET /api/v1/analytics/application-status
    async getApplicationStatusDistribution(req, res) {
        try {
            const distribution = await Application.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]);

            res.status(200).json(distribution);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
}

module.exports = new AnalyticsController();
