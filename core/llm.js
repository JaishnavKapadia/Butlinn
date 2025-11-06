// core/llm.js
// --- Manages the creation and monitoring of the Language Model (LLM) session. ---

// --- THIS IS THE FIX (Part 1): The default options are now for text-only ---
const DEFAULT_MODEL_OPTIONS = { 
    expectedOutputs: [{ type: 'text', languages: ['en'] }] 
};

/**
 * Creates and monitors a Language Model session.
 * Handles availability checks, download progress, and error reporting.
 * @param {object} options - (Optional) The specific model configuration to use.
 * @returns {Promise<LanguageModelSession|null>} A session object or null if creation fails.
 */
export async function createSession(options) {
    // --- THIS IS THE FIX (Part 2): It correctly uses the passed 'options' or falls back to the text-only default. ---
    const modelConfig = options || DEFAULT_MODEL_OPTIONS;

    try {
        const availability = await LanguageModel.availability(modelConfig);
        
        if (availability === 'unavailable') {
            console.error("LLM Error: Model is unavailable for the requested configuration.");
            chrome.runtime.sendMessage({ 
                type: 'stream_error', 
                message: 'AI model is unavailable. It may be unsupported on this device or for the requested task.' 
            });
            return null;
        }

        return await LanguageModel.create({
            ...modelConfig,
            monitor(monitor) {
                monitor.addEventListener('downloadprogress', (event) => {
                    if (event.total > 0) {
                        const progress = Math.round((event.loaded / event.total) * 100);
                        chrome.runtime.sendMessage({ 
                            type: 'setup_progress', 
                            message: `Downloading AI Model: ${progress}%...` 
                        });
                    }
                });
            },
        });

    } catch (err) {
        console.error("LLM Initialization Error:", err);
        chrome.runtime.sendMessage({ 
            type: 'stream_error', 
            message: `AI Error: ${err.message}` 
        });
        return null;
    }
}