// features/query_handler.js
// --- Handles answering user queries using the compiled context. ---

import * as llm from '../core/llm.js';

export async function answerQuery(data) {
    const { userQuery, context } = data;
    
    if (!context) {
        chrome.runtime.sendMessage({ type: 'dashboard/stream_error', message: 'Error: Missing user context.' });
        return;
    }

    const session = await llm.createSession();
    if (!session) {
        // Also send an error if the session fails to create
        chrome.runtime.sendMessage({ type: 'dashboard/stream_error', message: 'AI model is unavailable.' });
        return;
    }

    const prompt = `
      You are Butlinn, a private and elite AI butler. Your knowledge is based *exclusively* on the comprehensive user profile and file contents provided below.
      Respond in a brief, concise, and helpful butler-like manner.

      === KNOWLEDGE BASE ===
      USER PROFILE:
      ${context.userInfo}
      ---
      OTHER FILES:
      ${context.userFilesContent}
      ---
      RECENT HISTORY:
      ${context.history}
      ---
      BOOKMARKS:
      ${context.bookmarks}
      === END KNOWLEDGE BASE ===

      USER QUERY: "${userQuery}"
    `;

    try {
        const stream = session.promptStreaming(prompt);
        
        for await (const chunk of stream) {
            chrome.runtime.sendMessage({ type: 'dashboard/query_stream_chunk', chunk: chunk });
        }
        
        chrome.runtime.sendMessage({ type: 'dashboard/query_stream_end' });

    } catch (error) {
        console.error("Error during query processing:", error);
        chrome.runtime.sendMessage({ type: 'dashboard/stream_error', message: `Failed to get answer: ${error.message}` });
    } finally {
        session.destroy();
    }
}
