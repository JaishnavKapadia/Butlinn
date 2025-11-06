// background.js
// --- Listens for events, GATHERS DATA, and delegates AI tasks to offscreen. ---

import { compileContext } from './core/context_compiler.js';

// --- THIS IS NEW: Set default settings on installation ---
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({
        isWritingSuggestionsEnabled: true,
        isAutoProfileUpdateEnabled: false,
        isHistoryContextEnabled: false, // Default to OFF for privacy
        isTailorEnabled: true
    });
});


let creatingOffscreenDocument; 

async function setupOffscreenDocument(path) {
    const offscreenUrl = chrome.runtime.getURL(path);
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [offscreenUrl],
    });

    if (existingContexts.length > 0) return;
    if (creatingOffscreenDocument) {
        await creatingOffscreenDocument;
        return;
    }

    creatingOffscreenDocument = chrome.offscreen.createDocument({
        url: path,
        reasons: ['USER_MEDIA'],
        justification: 'To run the on-device LanguageModel AI and process files.',
    });

    try {
        await creatingOffscreenDocument;
    } finally {
        creatingOffscreenDocument = null;
    }
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Butlinn BG: Received message:', request);

    if (request.type === 'request_profile_update') {
        (async () => {
            // --- FIX: Check if auto-updates are enabled ---
            const { isAutoProfileUpdateEnabled } = await chrome.storage.local.get('isAutoProfileUpdateEnabled');
            if (isAutoProfileUpdateEnabled) {
                console.log("Butlinn BG: Auto-Profile update triggered.");
                const context = await compileContext(true);
                await setupOffscreenDocument('offscreen.html');
                chrome.runtime.sendMessage({
                    target: 'offscreen',
                    type: 'offscreen/profile/update', 
                    contextData: context
                });
            } else {
                console.log("Butlinn BG: Auto-Profile update is disabled. Skipping.");
            }
        })();
        return; 
    }

    if (sender.url && sender.url.includes('offscreen.html')) {
        (async () => {
            try {
                const isDashboardMsg = request.type.startsWith('dashboard/');
                const query = isDashboardMsg
                    ? { url: chrome.runtime.getURL('dashboard.html') }
                    : { active: true, lastFocusedWindow: true };
                
                const [targetTab] = await chrome.tabs.query(query);
                if (targetTab && targetTab.id) {
                    chrome.tabs.sendMessage(targetTab.id, request, () => {
                        if (chrome.runtime.lastError && chrome.runtime.lastError.message.includes('Receiving end does not exist')) {
                            return; 
                        }
                    });
                }
            } catch (error) {
                if (!error.message.includes('Receiving end does not exist')) {
                     console.error("Butlinn background forward error:", error);
                }
            }
        })();
        return; 
    }

    const ASYNC_ACTIONS = ['get_css', 'get_icon_data_url', 'relationships/analyze_screen'];
    if (ASYNC_ACTIONS.includes(request.type)) {
        (async () => {
            try {
                if (request.type === 'get_css') {
                    const url = chrome.runtime.getURL(request.path);
                    const response = await fetch(url);
                    sendResponse(await response.text());
                } 
                else if (request.type === 'get_icon_data_url') {
                    const imageUrl = chrome.runtime.getURL('assets/icons/Bimage.png');
                    const response = await fetch(imageUrl);
                    const blob = await response.blob();
                    sendResponse({ dataUrl: await blobToDataURL(blob) });
                }
                else if (request.type === 'relationships/analyze_screen') {
                    const { selectionBounds } = request.data;
                    const screenshotUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
                    const imageBitmap = await createImageBitmap(await (await fetch(screenshotUrl)).blob());
                    
                    // --- THIS IS THE FIX: Restored your desired cropping logic with padding ---
                    const ratio = selectionBounds.devicePixelRatio || 1;
                    const HORIZONTAL_PADDING = 150;
                    
                    // Calculate the starting X, applying padding but ensuring it's not less than 0
                    const cropXWithPadding = Math.max(0, selectionBounds.x - HORIZONTAL_PADDING);
                    
                    // Apply device pixel ratio to all coordinates for accuracy
                    const cropX = cropXWithPadding * ratio;
                    const cropY = 0; // Start from the very top of the screen
                    const cropWidth = imageBitmap.width - cropX; // Go from the new X to the right edge
                    const cropHeight = (selectionBounds.y + selectionBounds.height) * ratio; // Go from the top to the bottom of the selection
                    
                    const canvas = new OffscreenCanvas(cropWidth, cropHeight);
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(imageBitmap, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
                    
                    const imageDataUrl = await blobToDataURL(await canvas.convertToBlob());
                    
                    await setupOffscreenDocument('offscreen.html');
                    chrome.runtime.sendMessage({ target: 'offscreen', type: 'offscreen/vision/analyze_image', data: { imageDataUrl } });
                    
                    const responseHandler = (message) => {
                        if (message.type === 'content/vision_analysis_result') {
                            sendResponse(message.data);
                            chrome.runtime.onMessage.removeListener(responseHandler);
                        }
                    };
                    chrome.runtime.onMessage.addListener(responseHandler);
                }
            } catch (err) {
                console.error(`Error in async handler for ${request.type}:`, err);
                sendResponse({ success: false, error: err.message });
            }
        })();
        return true;
    }
    
    (async () => {
        await setupOffscreenDocument('offscreen.html');
        const offscreenRequest = { ...request, type: `offscreen/${request.type}`};
        
        if (['offscreen/setup/start', 'offscreen/query/ask'].includes(offscreenRequest.type)) {
             const context = await compileContext(true);
             offscreenRequest.contextData = context;
        }
        
        chrome.runtime.sendMessage({ ...offscreenRequest, target: 'offscreen' });
    })();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === "daily-profile-update") {
        const { isAutoProfileUpdateEnabled } = await chrome.storage.local.get('isAutoProfileUpdateEnabled');
        if (isAutoProfileUpdateEnabled) {
            console.log("Performing daily profile refresh.");
            const context = await compileContext(true);
            await setupOffscreenDocument('offscreen.html');
            chrome.runtime.sendMessage({ target: 'offscreen', type: 'offscreen/profile/update', contextData: context });
        } else {
            console.log("Daily profile refresh is disabled. Skipping.");
        }
    }
});

chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.create({
        url: chrome.runtime.getURL('dashboard.html')
    });
});