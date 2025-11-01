// dashboard.js

import { dashboardRelationships } from './ui/dashboard_relationships.js';

document.addEventListener('DOMContentLoaded', () => {
    dashboardRelationships.init();

    const userInput = document.getElementById('userInput');
    const aiResponseDiv = document.getElementById('aiResponse');
    const fileInput = document.getElementById('fileInput');
    const addFileButton = document.getElementById('addFileButton');
    const fileList = document.getElementById('fileList');
    const remakeProfileButton = document.getElementById('remakeProfileButton');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    
    // Define all toggle elements
    const writingSuggestionsToggle = document.getElementById('writingSuggestionsToggle');
    const tailorToggle = document.getElementById('tailorToggle');
    const autoProfileUpdateToggle = document.getElementById('autoProfileUpdateToggle');
    const historyContextToggle = document.getElementById('historyContextToggle');

    let currentButlinnTextElement = null;

    // Function to load settings from storage and update the UI
    function loadSettings() {
        const keys = [
            'isWritingSuggestionsEnabled',
            'isTailorEnabled',
            'isAutoProfileUpdateEnabled',
            'isHistoryContextEnabled'
        ];
        chrome.storage.local.get(keys, (result) => {
            writingSuggestionsToggle.checked = !!result.isWritingSuggestionsEnabled;
            tailorToggle.checked = !!result.isTailorEnabled;
            autoProfileUpdateToggle.checked = !!result.isAutoProfileUpdateEnabled;
            historyContextToggle.checked = !!result.isHistoryContextEnabled;
        });
    }

    // Function to save a setting to storage
    function saveSetting(key, value) {
        chrome.storage.local.set({ [key]: value });
    }
    
    // Add event listeners to save changes for all toggles
    writingSuggestionsToggle.addEventListener('change', (e) => saveSetting('isWritingSuggestionsEnabled', e.target.checked));
    tailorToggle.addEventListener('change', (e) => saveSetting('isTailorEnabled', e.target.checked));
    autoProfileUpdateToggle.addEventListener('change', (e) => saveSetting('isAutoProfileUpdateEnabled', e.target.checked));
    historyContextToggle.addEventListener('change', (e) => saveSetting('isHistoryContextEnabled', e.target.checked));

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            fileNameDisplay.textContent = fileInput.files[0].name;
        } else {
            fileNameDisplay.textContent = 'No file chosen';
        }
    });

    addFileButton.addEventListener('click', () => {
        const file = fileInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            chrome.runtime.sendMessage({ type: 'vault/add_file', data: {
                name: file.name,
                type: file.type,
                contentDataUrl: event.target.result
            }});
            fileInput.value = '';
            fileNameDisplay.textContent = 'No file chosen';
        };
        reader.readAsDataURL(file);
    });

    remakeProfileButton.addEventListener('click', () => {
        remakeProfileButton.disabled = true;
        remakeProfileButton.textContent = 'Remaking...';
        chrome.runtime.sendMessage({ type: 'request_profile_update' });
    });

    userInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleQuery();
        }
    });

    function handleQuery() {
        const query = userInput.value.trim();
        if (!query) return;

        if (aiResponseDiv.classList.contains('hidden')) {
            aiResponseDiv.classList.remove('hidden');
        }

        appendMessage('You', query);
        
        const butlinnMessage = createMessageContainer('Butlinn');
        currentButlinnTextElement = butlinnMessage.querySelector('span');

        chrome.runtime.sendMessage({ type: 'query/ask', data: { userQuery: query } });
        
        userInput.value = '';
        userInput.disabled = true;
        userInput.placeholder = 'Butlinn is thinking...';
    }

    function createMessageContainer(sender) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message';
        const senderElement = document.createElement('strong');
        senderElement.textContent = `${sender}: `;
        const textElement = document.createElement('span');
        messageElement.appendChild(senderElement);
        messageElement.appendChild(textElement);
        aiResponseDiv.appendChild(messageElement);
        aiResponseDiv.scrollTop = aiResponseDiv.scrollHeight;
        return messageElement;
    }

    function appendMessage(sender, text) {
        const container = createMessageContainer(sender);
        container.querySelector('span').textContent = text;
    }

    function refreshFileList() {
        chrome.runtime.sendMessage({ type: 'vault/get_list' });
    }

    function displayFiles(files) {
        fileList.innerHTML = '';
        if (!files || files.length === 0) {
            fileList.innerHTML = '<li>No files in vault.</li>';
            return;
        }
        files.forEach(file => {
            const li = document.createElement('li');
            li.textContent = file.name;
            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Delete';
            deleteButton.onclick = () => {
                chrome.runtime.sendMessage({ type: 'vault/delete_file', data: { filename: file.name } });
            };
            li.appendChild(deleteButton);
            fileList.appendChild(li);
        });
    }

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

        const type = request.type.replace('dashboard/', '');
        
        switch (type) {
            case 'query_stream_chunk':
                if (currentButlinnTextElement) {
                    currentButlinnTextElement.textContent += request.chunk;
                    aiResponseDiv.scrollTop = aiResponseDiv.scrollHeight;
                }
                break;
            case 'query_stream_end':
                userInput.disabled = false;
                userInput.placeholder = 'Ask Butlinn... (Enter to send)';
                userInput.focus();
                currentButlinnTextElement = null;
                break;
            case 'stream_error':
                appendMessage('Error', request.message);
                userInput.disabled = false;
                userInput.placeholder = 'Ask Butlinn... (Enter to send)';
                currentButlinnTextElement = null;
                break;
            case 'vault_files_list':
                displayFiles(request.files);
                break;
            case 'file_operation_complete':
                refreshFileList();
                break;
            case 'setup_complete':
                refreshFileList();
                const setupNotice = document.getElementById('setup-notice');
                if (setupNotice) {
                    setupNotice.remove();
                }
                chrome.storage.local.set({ isSetupComplete: true });
                break;
            case 'user_profile_update__complete':
                remakeProfileButton.textContent = 'Profile Updated!';
                setTimeout(() => {
                    remakeProfileButton.disabled = false;
                    remakeProfileButton.textContent = 'Remake Profile';
                }, 2000);
                break;
            case 'relationships_list':
                dashboardRelationships.handleData(request.data);
                break;
        }
    });

    chrome.storage.local.get('isSetupComplete', (result) => {
        if (!result.isSetupComplete) {
            const setupNotice = document.createElement('div');
            setupNotice.id = 'setup-notice'; 
            setupNotice.textContent = 'Welcome! Butlinn is performing a one-time setup to create your profile. This may take a moment...';
            setupNotice.style.padding = '10px';
            aiResponseDiv.appendChild(setupNotice);
            aiResponseDiv.classList.remove('hidden');
            chrome.runtime.sendMessage({ type: 'setup/start' });
        }
    });

    loadSettings();
    refreshFileList();
});