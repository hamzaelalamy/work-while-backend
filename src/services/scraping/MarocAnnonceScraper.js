const BaseScraper = require('./BaseScraper');

class MarocAnnonceScraper extends BaseScraper {
    constructor() {
        super('maroc-annonce');
        this.baseUrl = 'https://www.marocannonces.com/categorie/309/Emploi/Offres-emploi.html';
    }

    async scrape() {
        await this.initialize();

        try {
            console.log(`[${this.sourceName}] Navigating to ${this.baseUrl}`);
            await this.page.goto(this.baseUrl, { waitUntil: 'domcontentloaded' });
            await this.sleep(2000); // Wait for potential dynamic content

            // Extract job links from the listing page
            const jobLinks = await this.page.evaluate(() => {
                const links = [];
                // Selectors might need adjustment based on actual DOM, but this is a common pattern for MarocAnn
                // Looking for <a> tags inside the listing container
                const items = document.querySelectorAll('ul.cars-list li a');
                items.forEach(item => {
                    if (item.href) links.push(item.href);
                });
                return links.slice(0, 10); // Limit to 10 for demo/testing
            });

            console.log(`[${this.sourceName}] Found ${jobLinks.length} potential jobs. Processing...`);

            for (const link of jobLinks) {
                try {
                    // Navigate to details page
                    await this.page.goto(link, { waitUntil: 'domcontentloaded' });
                    await this.sleep(1000);

                    // Extract Details
                    const jobData = await this.page.evaluate(() => {
                        const titleElement = document.querySelector('h1');
                        const descriptionElement = document.querySelector('.description');
                        const infoElements = document.querySelectorAll('.parameter ul li');

                        let location = 'Morocco';
                        let city = '';
                        let type = 'full-time';

                        // Extract metadata from list items
                        infoElements.forEach(el => {
                            const text = el.innerText.toLowerCase();
                            if (text.includes('ville')) city = el.innerText.split(':')[1]?.trim();
                            if (text.includes('contrat')) type = el.innerText.split(':')[1]?.trim();
                        });

                        // Helper for mapping job types
                        const mapJobType = (rawType) => {
                            if (!rawType) return 'full-time';
                            const lower = rawType.toLowerCase();
                            if (lower.includes('cdi')) return 'full-time';
                            if (lower.includes('cdd')) return 'contract';
                            if (lower.includes('intérim')) return 'contract';
                            if (lower.includes('freelance')) return 'freelance';
                            if (lower.includes('stage')) return 'internship';
                            if (lower.includes('anapec')) return 'internship'; // or contract? usually entry level
                            return 'full-time'; // Default fallback
                        };

                        return {
                            title: titleElement ? titleElement.innerText.trim() : 'No Title',
                            description: descriptionElement ? descriptionElement.innerText.trim() : 'No Description',
                            location: city || location,
                            companyName: 'MarocAnnonce Listing',
                            type: mapJobType(type),
                            category: 'Other',
                            // Default values for required fields
                            experienceLevel: 'entry',
                            salary: { min: 0, max: 0, currency: 'MAD' },
                        };
                    });

                    // Add metadata
                    jobData.originalLink = link;
                    jobData.source = this.sourceName;
                    // Find an admin user to assign as poster
                    let posterId = '5f8d0d55b54764421b7156c1'; // Default fallback
                    try {
                        const User = require('../../models/User');
                        const adminUser = await User.findOne({ role: 'admin' });
                        if (adminUser) {
                            posterId = adminUser._id;
                        }
                    } catch (err) {
                        console.warn('Could not fetch admin user, using default ID');
                    }
                    jobData.postedBy = posterId;

                    // Save to DB
                    const savedJob = await this.saveJob(jobData);
                    if (savedJob) {
                        console.log(`[${this.sourceName}] Saved: ${savedJob.title}`);
                    }

                } catch (innerError) {
                    await this.logError(`Error processing link ${link}: ${innerError.message}`);
                }
                // Random sleep to be nice
                await this.sleep(Math.random() * 2000 + 1000);
            }

        } catch (error) {
            await this.logError('Scraping failed: ' + error.message);
        } finally {
            await this.close();
        }
    }
}

module.exports = MarocAnnonceScraper;
