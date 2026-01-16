const mongoose = require('mongoose');

const scrapingLogSchema = new mongoose.Schema({
    source: {
        type: String,
        required: true,
        enum: ['indeed', 'maroc-annonce', 'rekrute', 'other']
    },
    status: {
        type: String,
        required: true,
        enum: ['running', 'completed', 'failed'],
        default: 'running'
    },
    jobsFound: {
        type: Number,
        default: 0
    },
    jobsInserted: {
        type: Number,
        default: 0
    },
    errors: [{
        message: String,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    startTime: {
        type: Date,
        default: Date.now
    },
    endTime: Date
}, {
    timestamps: true
});

const ScrapingLog = mongoose.model('ScrapingLog', scrapingLogSchema);

module.exports = ScrapingLog;
