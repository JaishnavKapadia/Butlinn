// service/background.js
// --- Listens for events and delegates AI tasks to offscreen. ---
// --- Set default settings on installation ---
chrome.runtime.onInstalled.addListener(() => {
chrome.storage.local.set({
isWritingSuggestionsEnabled: true,
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
    justification: 'To run the on-device LanguageModel AI.',
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

// Forward messages from offscreen document to the correct tab (dashboard or active tab)
if (sender.url && sender.url.includes('offscreen.html')) {
    (async () => {
        try {
            const isDashboardMsg = request.type.startsWith('dashboard/');
            const query = isDashboardMsg
                ? { url: chrome.runtime.getURL('ui/dashboard/dashboard.html') }
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

const ASYNC_ACTIONS = ['get_css', 'get_icon_data_url'];
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
        } catch (err) {
            console.error(`Error in async handler for ${request.type}:`, err);
            sendResponse({ success: false, error: err.message });
        }
    })();
    return true;
}

// For all other messages, assume they are AI tasks and forward to offscreen
(async () => {
    await setupOffscreenDocument('service/offscreen.html');
    const offscreenRequest = { ...request, type: `offscreen/${request.type}`};
    chrome.runtime.sendMessage({ ...offscreenRequest, target: 'offscreen' });
})();
});
chrome.action.onClicked.addListener((tab) => {
chrome.tabs.create({
url: chrome.runtime.getURL('ui/dashboard/dashboard.html')
});
});