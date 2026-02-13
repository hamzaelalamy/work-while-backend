/**
 * Scraping Scheduler - Runs job scrapers automatically every hour
 * Set ENABLE_SCRAPING_SCHEDULER=true in .env to enable
 */
const cron = require('node-cron');
const scraperManager = require('./ScraperManager');
const logger = require('../../utils/logger');

const CRON_EXPRESSION = '0 * * * *'; // Every hour at minute 0 (e.g. 1:00, 2:00, 3:00...)

function startScrapingScheduler() {
    const enabled = process.env.ENABLE_SCRAPING_SCHEDULER === 'true';

    if (!enabled) {
        logger.info('[Scraping Scheduler] Disabled. Set ENABLE_SCRAPING_SCHEDULER=true to enable hourly scraping.');
        return null;
    }

    logger.info('[Scraping Scheduler] Starting hourly scraping (runs at :00 every hour)');

    const task = cron.schedule(CRON_EXPRESSION, async () => {
        try {
            logger.info('[Scraping Scheduler] Triggering automated scraping (all sources)...');
            await scraperManager.runAll();
            logger.info('[Scraping Scheduler] Scraping run completed.');
        } catch (error) {
            logger.error('[Scraping Scheduler] Error during scheduled scraping:', error);
        }
    }, {
        scheduled: true,
        timezone: process.env.SCRAPING_SCHEDULER_TIMEZONE || 'Africa/Casablanca'
    });

    return task;
}

module.exports = { startScrapingScheduler };
