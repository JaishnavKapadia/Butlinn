// features/vision_analyzer.js
// --- Handles analyzing images to find recipients using the on-device AI. ---

import * as llm from '../core/llm.js';

const VISION_MODEL_OPTIONS = {
    expectedOutputs: [{ type: 'text', languages: ['en'] }],
    expectedInputs: [ { type: 'text', languages: ['en'] }, { type: 'image' } ]
};

export async function findRecipientsInImage(imageBlob) { 
    if (!imageBlob || imageBlob.size === 0) {
        throw new Error('Image blob is invalid or empty');
    }

    // --- STRATEGY: A single, direct, and highly restrictive prompt ---
    const prompt = `Analyze this cropped screenshot. Your task is to identify all potential recipients.
    
    CRITICAL RULES:
    1. Extract FULL names, Usernames, emails, or group names.
    2. Format your response as a valid JSON array of strings. For example: ["John Doe", "support@example.com"].
    3. If no clear recipients are found, return an empty array: [].`;

    let session;
    try {
        session = await llm.createSession(VISION_MODEL_OPTIONS);
        if (!session) {
            throw new Error('AI model is unavailable for vision analysis.');
        }

        const promptMessages = [ { role: 'user', content: [{ type: 'text', value: prompt }, { type: 'image', value: imageBlob }] } ];
        
        const stream = session.promptStreaming(promptMessages);
        let fullResponse = "";

        // --- RETAINED FEATURE: A strict 10-second timeout to prevent long delays and hallucination ---
        const streamProcessor = async () => {
            for await (const chunk of stream) {
                fullResponse += chunk;
            }
        };

        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error('Vision analysis timed out after 10 seconds.'));
            }, 10000); // 10,000 milliseconds = 10 seconds
        });

        // Race the stream processing against the timeout
        await Promise.race([streamProcessor(), timeoutPromise]);
        
        let recipients = [];
        const jsonMatch = fullResponse.match(/\[.*\]/s);

        if (jsonMatch) {
            try {
                recipients = JSON.parse(jsonMatch[0]);
            } catch (e) {
                console.error("AI returned text that was not valid JSON:", e, "Response was:", fullResponse);
                recipients = []; 
            }
        } else {
             console.warn("AI response did not contain a JSON array. Response:", fullResponse);
             recipients = [];
        }

        const uniqueNames = [...new Set(recipients.filter(r => r && typeof r === 'string'))];
        const cleanedRecipients = uniqueNames.filter(name => !uniqueNames.some(otherName => otherName !== name && otherName.includes(name)));
        const finalRecipients = cleanedRecipients.slice(0, 3); // Still take the top 3 results

        return { 
            recipients: finalRecipients
        };

    } catch (error) {
        console.error("Error during vision analysis:", error);
        throw error;

    } finally {
        if (session) {
            try {
                await session.destroy();
            } catch (e) {
                console.error("Error destroying session:", e);
            }
        }
    }
}