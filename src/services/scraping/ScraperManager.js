const MarocAnnonceScraper = require('./MarocAnnonceScraper');
const RekruteScraper = require('./RekruteScraper');
// const IndeedScraper = require('./IndeedScraper'); // Disabled for now

class ScraperManager {
    constructor() {
        this.scrapers = {
            'maroc-annonce': new MarocAnnonceScraper(),
            'rekrute': new RekruteScraper(),
            // 'indeed': new IndeedScraper()
        };
        this.isRunning = false;
    }

    async runScraper(sourceName) {
        if (sourceName === 'all') {
            return this.runAll();
        }

        const scraper = this.scrapers[sourceName];
        if (!scraper) {
            throw new Error(`Scraper for source "${sourceName}" not found`);
        }

        console.log(`[ScraperManager] Starting ${sourceName} scraper...`);
        // Run in background (fire and forget from API perspective, but logged in DB)
        this.executeScraper(scraper);
        return { message: `Scraping started for ${sourceName}` };
    }

    async runAll() {
        console.log('[ScraperManager] Starting all scrapers...');
        const result = {};

        // Execute sequentially to avoid overwhelming system resources (browser instances)
        // Could be parallelized if resources allow (e.g. 4 core+ VPS)
        this.executeAllSequentially();

        return { message: 'Scraping started for all sources' };
    }

    async executeScraper(scraper) {
        try {
            if (this.isRunning) {
                console.log('A scraping job is already running. Queuing or skipping...');
                // Simple lock mechanism, for now we just log
            }
            this.isRunning = true;
            await scraper.scrape();
        } catch (error) {
            console.error(`[ScraperManager] Error running ${scraper.sourceName}:`, error);
        } finally {
            this.isRunning = false;
        }
    }

    async executeAllSequentially() {
        for (const key of Object.keys(this.scrapers)) {
            await this.executeScraper(this.scrapers[key]);
        }
    }

    getAvailableScrapers() {
        return Object.keys(this.scrapers);
    }
}

module.exports = new ScraperManager(); // Singleton instance
