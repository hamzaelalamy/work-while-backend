const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const Job = require('../../models/Job');
const ScrapingLog = require('../../models/ScrapingLog');

puppeteer.use(StealthPlugin());

class BaseScraper {
    constructor(sourceName) {
        this.sourceName = sourceName;
        this.browser = null;
        this.page = null;
        this.logEntry = null;
        this.processedCount = 0;
        this.insertedCount = 0;
    }

    async initialize() {
        this.logEntry = await ScrapingLog.create({
            source: this.sourceName,
            status: 'running',
            startTime: new Date()
        });

        try {
            this.browser = await puppeteer.launch({
                headless: false, // Set to true for production, false for demo
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            this.page = await this.browser.newPage();
            // Set a realistic viewport
            await this.page.setViewport({ width: 1366, height: 768 });
        } catch (error) {
            await this.logError('Initialization failed: ' + error.message);
            throw error;
        }
    }

    async scrape() {
        throw new Error('Method "scrape" must be implemented');
    }

    async saveJob(jobData) {
        try {
            // Ensure source is set
            jobData.source = this.sourceName;
            jobData.isScraped = true;
            jobData.status = 'draft'; // Scraped jobs are drafts by default

            // Normalize salary if needed (simple check)
            if (!jobData.salary) {
                jobData.salary = { currency: 'MAD', period: 'monthly' };
            }

            // Allow saving without throwing error for duplicates (deduplication)
            const existingJob = await Job.findOne({ originalLink: jobData.originalLink });

            if (existingJob) {
                console.log(`Duplicate found: ${jobData.title}`);
                return null;
            }

            const job = await Job.create(jobData);
            this.insertedCount++;
            return job;
        } catch (error) {
            // Handle duplicate key error gracefully if race condition occurs
            if (error.code === 11000) {
                console.warn(`Duplicate key error for ${jobData.originalLink}`);
                return null;
            }
            await this.logError(`Failed to save job "${jobData.title}": ${error.message}`);
            return null;
        }
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async logError(message) {
        if (this.logEntry) {
            this.logEntry.errors.push({ message, timestamp: new Date() });
            await this.logEntry.save();
        }
        console.error(`[${this.sourceName}] Error: ${message}`);
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
        }

        if (this.logEntry) {
            this.logEntry.status = 'completed';
            this.logEntry.endTime = new Date();
            this.logEntry.jobsFound = this.processedCount;
            this.logEntry.jobsInserted = this.insertedCount;
            await this.logEntry.save();
        }
    }
}

module.exports = BaseScraper;
