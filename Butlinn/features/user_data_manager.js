// features/user_data_manager.js
// --- Manages all user data: vault files, setup, and AI profile generation/updates. ---

import * as llm from '../core/llm.js';
import * as storage from '../core/storage.js';
import * as pdfjsLib from '../vendor/pdf.mjs';

// --- Constants and Setup ---
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('vendor/pdf.worker.mjs');

// --- Private Helper Functions ---

async function _generateProfile(session, contextData, isInitialSetup = false) {
    const prompt = isInitialSetup
        ? `
          Analyze the following user data: bookmarks and recent history.
          Create a comprehensive but concise summary of the user's likely interests, profession, and key personal details.
          Structure the output as a "User Profile" document. This will be your primary memory file about the user. Be personable and insightful.
        `
        : `
          Analyze the provided data, paying special attention to the most recent history, new files, and the existing user profile.
          Update the user profile to reflect any new interests, knowledge, or changes. Integrate new information smoothly into the existing profile.
          Output the complete, rewritten user profile document.

          EXISTING USER PROFILE:
          ${contextData.userInfo}
        `;

    const fullPrompt = `
      ${prompt}

      ---
      BOOKMARKS:
      ${contextData.bookmarks}
      ---
      RECENT HISTORY:
      ${contextData.history}
      ---
      FILE CONTENTS:
      ${contextData.userFilesContent}
    `;
    return await session.prompt(fullPrompt);
}

async function _extractFileContent(file) {
    const base64 = file.contentDataUrl.split(',')[1];
    if (!base64) return `Error: Invalid file format for ${file.name}.`;

    try {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        if (file.type === 'application/pdf') {
            const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
            let textContent = '';
            for (let i = 1; i <= doc.numPages; i++) {
                const page = await doc.getPage(i);
                textContent += (await page.getTextContent()).items.map(item => item.str).join(' ') + '\n';
            }
            return textContent;
        } else if (file.type.startsWith('text/')) {
            return new TextDecoder().decode(bytes);
        } else {
            return `File type (${file.type}) is not readable. Only text and PDF files are supported.`;
        }
    } catch (error) {
        console.error(`Error parsing ${file.name}:`, error);
        return `Error: Could not read the content of this file. Reason: ${error.message}`;
    }
}


// --- Public (Exported) Functions ---

export async function runSetup(contextData) {
    try {
        chrome.runtime.sendMessage({ type: 'dashboard/setup_progress', message: 'Preparing AI model...' });
        const session = await llm.createSession();
        if (!session) return;

        chrome.runtime.sendMessage({ type: 'dashboard/setup_progress', message: 'Creating initial user profile...' });
        const profileText = await _generateProfile(session, contextData, true);
        await storage.addFile({ name: 'user_info.txt', type: 'text/plain', content: profileText });

        chrome.runtime.sendMessage({ type: 'dashboard/setup_complete' });
        
        session.destroy();
    } catch (error) {
        console.error("Error during setup:", error);
        chrome.runtime.sendMessage({ type: 'dashboard/stream_error', message: `Setup failed: ${error.message}` });
    }
}

export async function runProfileUpdate(contextData) {
    try {
        const session = await llm.createSession();
        if (!session) {
            chrome.runtime.sendMessage({ type: 'dashboard/user_profile_update_complete', message: 'Update failed. AI unavailable.' });
            return;
        }

        const newProfile = await _generateProfile(session, contextData, false);
        await storage.addFile({ name: 'user_info.txt', type: 'text/plain', content: newProfile });

        // --- THIS IS THE NEW LINE ---
        // It sends a message back to the dashboard so the button can be re-enabled.
        chrome.runtime.sendMessage({ type: 'dashboard/user_profile_update_complete', message: 'User profile updated.' });
        session.destroy();
    } catch (error) {
        console.error("Error during profile update:", error);
        chrome.runtime.sendMessage({ type: 'dashboard/user_profile_update_complete', message: `Update failed: ${error.message}` });
    }
}

export async function processAndAddFile(fileData) {
    const content = await _extractFileContent(fileData);
    await storage.addFile({ name: fileData.name, type: fileData.type, content: content });
    chrome.runtime.sendMessage({ type: 'dashboard/file_operation_complete', message: `File "${fileData.name}" added.` });

    chrome.runtime.sendMessage({ type: 'request_profile_update' });
}

export async function deleteVaultFile(data) {
    await storage.deleteFile(data.filename);
    chrome.runtime.sendMessage({ type: 'dashboard/file_operation_complete', message: `File "${data.filename}" deleted.` });

    chrome.runtime.sendMessage({ type: 'request_profile_update' });
}

export async function getVaultFilesList() {
    const files = await storage.getAllFiles();
    const fileList = files.map(f => ({ name: f.name }));
    chrome.runtime.sendMessage({ type: 'dashboard/vault_files_list', files: fileList });
}