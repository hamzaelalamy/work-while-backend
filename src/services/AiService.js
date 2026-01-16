const { pipeline } = require('@xenova/transformers');


class AiService {
    constructor() {
        this.extractor = null;
        this.modelName = 'Xenova/all-MiniLM-L6-v2';
        // Initialize lazily or on startup
        this.init();
    }

    async init() {
        if (!this.extractor) {
            console.log('AI Service: Loading Model...');
            try {
                // Create the feature extraction pipeline
                this.extractor = await pipeline('feature-extraction', this.modelName);
                console.log('AI Service: Model Loaded Successfully');
            } catch (error) {
                console.error('AI Service: Failed to load model', error);
            }
        }
    }

    // Generate embedding for a given text
    async generateEmbedding(text) {
        if (!this.extractor) await this.init();
        if (!text) return null;

        // Run the pipeline
        const output = await this.extractor(text, { pooling: 'mean', normalize: true });

        // Convert generic Tensor to simple array
        return Array.from(output.data);
    }

    // Helper to construct searchable text from Job
    getJobText(job) {
        return `${job.title} ${job.description} ${job.skills ? job.skills.join(' ') : ''}`;
    }
}

// Export singleton
module.exports = new AiService();
