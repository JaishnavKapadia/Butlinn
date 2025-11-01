// popup.js

document.addEventListener('DOMContentLoaded', () => {
    const dashboardButton = document.getElementById('dashboardButton');
    const vaultButton = document.getElementById('vaultButton');

    // Define all toggle elements
    const writingSuggestionsToggle = document.getElementById('writingSuggestionsToggle');
    const tailorToggle = document.getElementById('tailorToggle');
    const autoProfileUpdateToggle = document.getElementById('autoProfileUpdateToggle');
    const historyContextToggle = document.getElementById('historyContextToggle');

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

    const openApp = () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
        window.close();
    };

    dashboardButton.addEventListener('click', (e) => {
        e.preventDefault();
        openApp();
    });

    vaultButton.addEventListener('click', (e) => {
        e.preventDefault();
        openApp();
    });

    // Load the settings when the popup is opened
    loadSettings();
});