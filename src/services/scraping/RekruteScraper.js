const BaseScraper = require('./BaseScraper');

class RekruteScraper extends BaseScraper {
    constructor() {
        super('rekrute');
        this.baseUrl = 'https://www.rekrute.com/offres-emploi-maroc.html';
    }

    async scrape() {
        await this.initialize();

        try {
            console.log(`[${this.sourceName}] Navigating to ${this.baseUrl}`);
            await this.page.goto(this.baseUrl, { waitUntil: 'networkidle2' });

            // Cookie banner handling might be needed
            try {
                const cookieBtn = await this.page.$('#cookie_accept'); // Hypothetical selector
                if (cookieBtn) await cookieBtn.click();
            } catch (e) { /* ignore */ }

            // Extract job links
            const jobLinks = await this.page.evaluate(() => {
                const links = [];
                // Rekrute structure usually lists jobs in a container
                const items = document.querySelectorAll('li.post-id');

                if (items.length > 0) {
                    items.forEach(item => {
                        const linkEl = item.querySelector('a.titreJob');
                        if (linkEl && linkEl.href) {
                            links.push(linkEl.href);
                        }
                    });
                } else {
                    // Fallback to searching for specific link patterns if specific class not found
                    const anchors = document.querySelectorAll('a[href*="/offres-emploi-"]');
                    anchors.forEach(a => {
                        if (a.href && !links.includes(a.href)) links.push(a.href);
                    });
                }
                return links.slice(0, 10);
            });

            console.log(`[${this.sourceName}] Found ${jobLinks.length} potential jobs.`);

            for (const link of jobLinks) {
                try {
                    await this.page.goto(link, { waitUntil: 'domcontentloaded' });
                    await this.sleep(1500);

                    const jobData = await this.page.evaluate(() => {
                        const h1 = document.querySelector('h1');
                        const title = h1 ? h1.innerText.trim() : 'Unknown Title';

                        // Rekrute often splits description into multiple blocks with class 'blc'
                        const blcElements = document.querySelectorAll('.blc');
                        let description = '';
                        if (blcElements.length > 0) {
                            blcElements.forEach(el => description += el.innerText + '\n\n');
                        } else {
                            // Fallback
                            const descDiv = document.querySelector('#jobDescription') || document.querySelector('.content') || document.querySelector('.contenu-offre');
                            description = descDiv ? descDiv.innerText : 'No Description';
                        }

                        description = description.trim().substring(0, 4900); // Trim to fit schema

                        // Meta info
                        // Try schema first, then UI elements
                        let location = 'Casablanca';
                        const locationSchema = document.querySelector('span[itemprop="addressLocality"]');
                        if (locationSchema) {
                            location = locationSchema.innerText;
                        } else {
                            const regionEl = document.querySelector('li[title="Région"]'); // explicit region tag
                            if (regionEl) {
                                // Extract text, removing label if needed. usually "Région : Casablanca" or just "Casablanca" inside?
                                // innerText might be "Région : Casablanca"
                                location = regionEl.innerText.replace('Région :', '').trim();
                            } else {
                                // Fallback to icon
                                const iconMarker = document.querySelector('i.fa-map-marker');
                                if (iconMarker && iconMarker.parentElement) {
                                    location = iconMarker.parentElement.innerText.trim();
                                }
                            }
                        }

                        // Extract company name  
                        let companyName = 'Unknown Company';
                        const companyEl = document.querySelector('span[itemprop="hiringOrganization"]') ||
                            document.querySelector('.company-name') ||
                            document.querySelector('a[href*="/societe/"]');
                        if (companyEl) {
                            companyName = companyEl.innerText.trim();
                        }

                        return {
                            title,
                            description,
                            location,
                            companyName,
                            type: 'full-time',
                            category: 'Scraped',
                            experienceLevel: 'mid',
                            salary: { min: 0, max: 0, currency: 'MAD' }
                        };
                    });

                    jobData.originalLink = link;

                    // Need an existing user ID for 'postedBy'. For now, we'll try to find one or use a placeholder
                    // Ideally the system should have a 'Bot' user seeded.
                    // For this implementation, we assume the controller dealing with this might patch it, or we rely on a known ID.
                    // Since we can't fetch DB here easily, we'll dummy it.
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

                    await this.saveJob(jobData);

                } catch (innerError) {
                    await this.logError(`Error processing ${link}: ${innerError.message}`);
                }
                await this.sleep(2000);
            }

        } catch (error) {
            await this.logError('Scraping main loop failed: ' + error.message);
        } finally {
            await this.close();
        }
    }
}

module.exports = RekruteScraper;
