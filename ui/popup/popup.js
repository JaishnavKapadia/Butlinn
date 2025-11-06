// ui/popup/popup.js

document.addEventListener('DOMContentLoaded', () => {
    const dashboardButton = document.getElementById('dashboardButton');

    // Define all toggle elements
    const writingSuggestionsToggle = document.getElementById('writingSuggestionsToggle');
    const tailorToggle = document.getElementById('tailorToggle');

    // Function to load settings from storage and update the UI
    function loadSettings() {
        const keys = [
            'isWritingSuggestionsEnabled',
            'isTailorEnabled'
        ];
        chrome.storage.local.get(keys, (result) => {
            writingSuggestionsToggle.checked = !!result.isWritingSuggestionsEnabled;
            tailorToggle.checked = !!result.isTailorEnabled;
        });
    }

    // Function to save a setting to storage
    function saveSetting(key, value) {
        chrome.storage.local.set({ [key]: value });
    }
    
    // Add event listeners to save changes for all toggles
    writingSuggestionsToggle.addEventListener('change', (e) => saveSetting('isWritingSuggestionsEnabled', e.target.checked));
    tailorToggle.addEventListener('change', (e) => saveSetting('isTailorEnabled', e.target.checked));

    const openApp = () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('ui/dashboard/dashboard.html') });
        window.close();
    };

    dashboardButton.addEventListener('click', (e) => {
        e.preventDefault();
        openApp();
    });

    // Load the settings when the popup is opened
    loadSettings();
});