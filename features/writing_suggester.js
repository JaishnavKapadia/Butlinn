// features/writing_suggester.js
// --- Generates writing suggestions for selected text on a webpage. ---

import * as llm from '../core/llm.js';
import * as storage from '../core/storage.js';

const PROMPT_INSTRUCTIONS = {
    concise: "make the following text much shorter and more concise (about half the length).",
    detailed: "make the following text slightly shorter and more direct.",
    descriptive: "make the following text slightly longer and more descriptive.",
    verbose: "make the following text significantly longer, more detailed, and more explanatory."
};

/**
 * Gets a single writing suggestion from the AI.
 * Can be a standard rewrite or a relationship-aware rewrite.
 */
export async function getSuggestion(data) {
    const { selectedText, fullContext, rewriteStyle, variantIndex, baseText, options } = data;
    const { useRelationship, recipientAlias } = options || {};

    const session = await llm.createSession();
    if (!session) {
        chrome.runtime.sendMessage({ type: 'writing_suggestion_error', message: 'AI is unavailable.', data });
        return;
    }

    let prompt;

    if (rewriteStyle === 'initial' && useRelationship && recipientAlias) {
        
        // --- THIS IS THE FIX ---
        // Instead of a direct, case-sensitive lookup, we now get all relationships
        // and perform a case-insensitive search against all of their aliases.
        const allRelationships = await storage.getAllRelationships();
        const normalizedRecipient = recipientAlias.trim().toLowerCase();
        const relationship = allRelationships.find(person =>
            person.aliases.some(alias => alias.trim().toLowerCase() === normalizedRecipient)
        );
        // -----------------------

        if (relationship) {
            // SCENARIO A: We know this person.
            prompt = `
              You are a writing assistant. The user is writing to "${relationship.primaryName}".
              Their relationship has a "closeness" of ${relationship.closeness} out of 5.
              The desired tone is: "${relationship.preferredTone}".
              Additional user notes for context: "${relationship.notes || 'None'}".
              
              Based on this, rephrase the "SELECTED TEXT" to fit the context perfectly.
              CRITICAL: Act as the user and write from their perspective. Preserve original formatting (e.g., newlines).
              Respond with ONLY the rephrased text.
              
              SELECTED TEXT: "${selectedText}"
            `;
        } else {
            // SCENARIO B: This is a new contact.
            prompt = `
              You are a writing assistant. The user is writing to a new contact named "${recipientAlias}".
              Rephrase the "SELECTED TEXT" in a standard, friendly-professional tone.
              CRITICAL: Act as the user and write from their perspective. Preserve original formatting (e.g., newlines).
              Respond with ONLY the rephrased text.
              
              SELECTED TEXT: "${selectedText}"
            `;
            // If the user proceeds, create a new uncategorized contact for them.
            if (useRelationship && recipientAlias) {
                const trimmedAlias = recipientAlias.trim();
                const newPerson = {
                    id: crypto.randomUUID(),
                    primaryName: trimmedAlias,
                    aliases: [trimmedAlias],
                    closeness: 0, // Default to uncategorized
                    preferredTone: 'Professional',
                    notes: ''
                };
                await storage.addOrUpdateRelationship(newPerson);
            }
        }

    } else if (rewriteStyle === 'initial') {
        // SCENARIO C: Default professional rewrite (toggle is off or "General Audience")
        prompt = `
          You are a professional writing assistant. Your task is to rephrase the "SELECTED TEXT" to make it sound more professional, clear, and 
          suitable for a general audience.
          
          CRITICAL INSTRUCTIONS:
          1. Act as the user and write the text from THEIR PERSPECTIVE.
          2. Do NOT describe what the user is doing or feeling (e.g., do not say "The user is amused").
          3. Preserve the original formatting and paragraph structure.
          4. Respond with ONLY the rephrased text.

          SELECTED TEXT: "${selectedText}"
        `;

    } else {
        // Length adjustment prompt
        const instruction = PROMPT_INSTRUCTIONS[rewriteStyle];
        prompt = `
          You are a text length editor. Your only task is to ${instruction}
          It is critical that you preserve the original professional tone and paragraph structure of the text.
          Respond with ONLY the rewritten text.
          TEXT TO EDIT: "${baseText}"
        `;
    }

    try {
        if (rewriteStyle === 'initial') {
             const response = await session.prompt(prompt);
             chrome.runtime.sendMessage({ type: 'writing_suggestion_result', result: response, variantIndex });
        } else {
            const stream = session.promptStreaming(prompt);
            for await (const chunk of stream) {
                chrome.runtime.sendMessage({ type: 'writing_suggestion_chunk', chunk: chunk, variantIndex });
            }
            chrome.runtime.sendMessage({ type: 'writing_suggestion_stream_end', variantIndex });
        }
    } catch (error) {
        console.error(`Error getting suggestion:`, error);
        chrome.runtime.sendMessage({ type: 'writing_suggestion_error', message: 'Could not get a valid suggestion.', data });
    } finally {
        session.destroy();
    }
}