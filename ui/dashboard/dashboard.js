// ui/dashboard/dashboard.js

import { dashboardRelationships } from './dashboard_relationships.js';

document.addEventListener('DOMContentLoaded', () => {
    dashboardRelationships.init();
    
    // Define all toggle elements
    const writingSuggestionsToggle = document.getElementById('writingSuggestionsToggle');
    const tailorToggle = document.getElementById('tailorToggle');

    // Function to load settings from storage and update the UI
    function loadSettings() {
        const keys = [
            'isWritingSuggestionsEnabled',
            'isTailorEnabled',
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


    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

        const type = request.type.replace('dashboard/', '');
        
        switch (type) {
            case 'relationships_list':
                dashboardRelationships.handleData(request.data);
                break;
        }
    });

    loadSettings();
});