// core/context_compiler.js
// --- Gathers data from browser APIs and storage to build a context for the AI. ---

import * as storage from './storage.js';

/**
 * Gathers titles from the user's bookmarks.
 * @returns {Promise<string>} A newline-separated string of bookmark titles.
 */
async function getBookmarkContext() {
    const bookmarkTree = await chrome.bookmarks.getTree();
    const bookmarkTitles = [];
    
    function processNode(node) {
        if (node.url && node.title) {
            bookmarkTitles.push(node.title);
        }
        if (node.children) {
            node.children.forEach(processNode);
        }
    }

    if (bookmarkTree.length > 0) {
        processNode(bookmarkTree[0]);
    }
    return bookmarkTitles.join('\n');
}

/**
 * Gathers titles from the user's recent browsing history, respecting user settings.
 * @returns {Promise<string>} A newline-separated string of history item titles.
 */
async function getHistoryContext() {
    const { isHistoryContextEnabled } = await chrome.storage.local.get('isHistoryContextEnabled');
    if (!isHistoryContextEnabled) {
        return "History context is disabled by the user.";
    }

    // We get more results than needed to filter out items without titles.
    const historyItems = await chrome.history.search({ text: '', maxResults: 100 });
    return historyItems
        .map(item => item.title)
        .filter(Boolean) // Remove any null or empty titles
        .slice(0, 50)     // Limit to the 50 most recent valid titles
        .join('\n');
}

/**
 * Compiles all user data into a single object for AI processing.
 * @param {boolean} includeFileContent - If true, includes the full text content of files.
 * @returns {Promise<object>} A promise that resolves with the compiled context object.
 */
export async function compileContext(includeFileContent = false) {
    const [history, bookmarks, userInfoFile, allFiles] = await Promise.all([
        getHistoryContext(),
        getBookmarkContext(),
        storage.getFile('user_info.txt'),
        storage.getAllFiles()
    ]);

    const context = {
        history: history || "No history found.",
        bookmarks: bookmarks || "No bookmarks found.",
        userInfo: userInfoFile ? userInfoFile.content : "No user profile created yet.",
        userFiles: "No files in vault.",
        userFilesContent: "No files in vault."
    };

    if (allFiles && allFiles.length > 0) {
        const filesToProcess = allFiles;
        
        if (filesToProcess.length > 0) {
            context.userFiles = filesToProcess.map(f => f.name).join(', ');
            
            if (includeFileContent) {
                context.userFilesContent = filesToProcess
                    .map(f => `File Name: ${f.name}\nContent:\n${f.content || 'Content is not text or has not been processed.'}`)
                    .join('\n---\n');
            }
        }
    }

    return context;
}