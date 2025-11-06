// offscreen.js
// --- Receives messages from the background script and routes them to the correct module. ---

import * as writingSuggester from '../features/writing_suggester.js';
import * as storage from '../core/storage.js';

chrome.runtime.onMessage.addListener((request) => {
    // Only process messages specifically targeted at the offscreen document.
    if (request.target !== 'offscreen') return;

    const type = request.type.replace('offscreen/', '');

    switch (type) {
        // --- AI Features ---
        case 'writing/get_suggestion':
            writingSuggester.getSuggestion(request.data);
            break;
        
        // --- Relationship Data Management ---
        case 'relationships/get_all':
            (async () => {
                const people = await storage.getAllRelationships();
                chrome.runtime.sendMessage({ type: 'dashboard/relationships_list', data: people });
            })();
            break;
        
        case 'relationships/update':
             storage.addOrUpdateRelationship(request.data);
             break;

        case 'relationships/update_batch':
            (async () => {
                await storage.addOrUpdateRelationship(request.data.update);
                await storage.deleteRelationshipById(request.data.deleteId);
            })();
            break;
        
        case 'relationships/dissolve':
            (async () => {
                await storage.deleteRelationshipById(request.data.deleteId);
                for (const person of request.data.newPeople) {
                    await storage.addOrUpdateRelationship(person);
                }
            })();
            break;
        
        case 'relationships/delete_batch':
            storage.deleteMultipleRelationships(request.data.ids);
            break;
    }
});