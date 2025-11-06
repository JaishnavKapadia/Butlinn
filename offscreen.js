// offscreen.js
// --- Receives messages from the background script and routes them to the correct module. ---

import * as userDataManager from './features/user_data_manager.js';
import * as queryHandler from './features/query_handler.js';
import * as writingSuggester from './features/writing_suggester.js';
import { findRecipientsInImage } from './features/vision_analyzer.js';
import * as storage from './core/storage.js';

chrome.runtime.onMessage.addListener((request) => {
    // Only process messages specifically targeted at the offscreen document.
    if (request.target !== 'offscreen') return;

    const type = request.type.replace('offscreen/', '');

    switch (type) {
        // --- User Profile and Setup ---
        case 'setup/start':
            userDataManager.runSetup(request.contextData);
            break;

        case 'profile/update':
             userDataManager.runProfileUpdate(request.contextData);
             break;

        // --- Vault File Management ---
        case 'vault/add_file':
            userDataManager.processAndAddFile(request.data);
            break;

        case 'vault/get_list':
            userDataManager.getVaultFilesList();
            break;

        case 'vault/delete_file':
            userDataManager.deleteVaultFile(request.data);
            break;

        // --- AI Features ---
        case 'query/ask':
            queryHandler.answerQuery({
                userQuery: request.data.userQuery,
                context: request.contextData
            });
            break;

        case 'writing/get_suggestion':
            writingSuggester.getSuggestion(request.data);
            break;
        
        // --- THIS IS THE FIX (Part 2): Centralized message sending ---
        case 'vision/analyze_image':
            (async () => {
                const { imageDataUrl } = request.data;
                try {
                    const response = await fetch(imageDataUrl);
                    const imageBlob = await response.blob();
                    
                    // The result is now returned directly from the function.
                    const analysisResult = await findRecipientsInImage(imageBlob);
                    
                    chrome.runtime.sendMessage({
                        type: 'content/vision_analysis_result',
                        data: { 
                            success: true, 
                            recipients: analysisResult.recipients || [],
                            debugImageUrl: imageDataUrl
                        }
                    });

                } catch (error) {
                    console.error("Error during vision analysis orchestration:", error);
                    chrome.runtime.sendMessage({
                        type: 'content/vision_analysis_result',
                        data: { success: false, error: error.message }
                    });
                }
            })();
            break;

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