// ui/dashboard/dashboard.js

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM ELEMENTS ---
  const logoScreen = document.getElementById('logo-screen');
  const downloadScreen = document.getElementById('download-screen');
  const viewContainer = document.getElementById('view-container');
  const mainScreen = document.getElementById('main-content-screen');
  const downloadBtn = document.getElementById('downloadBtn');
  const progressBar = document.getElementById('progressBar');
  const progressBarFill = document.getElementById('progressBarFill');
  const downloadError = document.getElementById('download-error');
  const tabs = document.querySelectorAll('.tab');
  const featureToggles = document.querySelectorAll('.feature-toggle-area input[type="checkbox"]');
  const descriptionSlider = document.querySelector('.description-slider');
  const visualSlider = document.querySelector('.visual-slider');
  const dashboardBtn = document.getElementById('dashboard-btn');
  const backToFeaturesBtn = document.getElementById('back-to-features-btn');

  // --- SETTINGS & CONSTANTS ---
  const MODEL_OPTIONS = { expectedOutputs: [{ type: 'text', languages: ['en'] }] };

  // --- CORE FUNCTIONS ---
  const showView = (viewName) => {
    logoScreen.style.display = 'none';
    downloadScreen.style.display = 'none';
    
    // Show the main view container
    viewContainer.style.display = 'flex';
    
    if (viewName === 'features') {
      viewContainer.style.transform = 'translateX(0%)';
      setTimeout(() => mainScreen.classList.add('visible'), 50);
      mainScreen.style.opacity = '1';
    } else if (viewName === 'dashboard') {
      viewContainer.style.transform = 'translateX(-100%)';
    }
  };

  const showFeature = (featureId) => {
    const featureIndex = Array.from(tabs).findIndex(tab => tab.dataset.feature === featureId);
    if (featureIndex === -1) return;
    const offset = featureIndex * -100;
    descriptionSlider.style.transform = `translateX(${offset}%)`;
    visualSlider.style.transform = `translateX(${offset}%)`;
    tabs.forEach(t => t.classList.toggle('active', t.dataset.feature === featureId));
  };
  
  const updateTabState = (featureId, isEnabled) => {
    const tab = document.querySelector(`.tab[data-feature="${featureId}"]`);
    if (tab) {
      tab.classList.toggle('disabled', !isEnabled);
      if (!isEnabled && tab.classList.contains('active')) {
          showFeature('writing');
      }
    }
  };


  const saveSettings = () => {
    // Get current states
    const isWritingEnabled = document.querySelector('input[data-feature="writing"]').checked;
    const isTailorEnabled = document.querySelector('input[data-feature="tailor"]').checked;
    
    // Update the tab states immediately
    updateTabState('writing', isWritingEnabled);
    updateTabState('tailor', isTailorEnabled);

    const settings = {
      isWritingSuggestionsEnabled: isWritingEnabled,
      isTailorEnabled: isTailorEnabled,
    };
    chrome.storage.local.set(settings);
  };

  const loadSettings = () => {
    const keys = ['isWritingSuggestionsEnabled', 'isTailorEnabled'];
    chrome.storage.local.get(keys, (result) => {
      const isWritingEnabled = !!result.isWritingSuggestionsEnabled;
      const isTailorEnabled = !!result.isTailorEnabled;

      document.querySelector('input[data-feature="writing"]').checked = isWritingEnabled;
      document.querySelector('input[data-feature="tailor"]').checked = isTailorEnabled;

      // Update tab states on load
      updateTabState('writing', isWritingEnabled);
      updateTabState('tailor', isTailorEnabled);
    });
  };

  const handleDownload = async () => {
    downloadBtn.disabled = true;
    downloadBtn.textContent = 'Downloading...';
    progressBar.style.display = 'block';
    downloadError.style.display = 'none';
    try {
      const availability = await LanguageModel.availability(MODEL_OPTIONS);
      if (availability === 'available') {
        progressBarFill.style.width = '100%';
        setTimeout(() => { showView('features'); showFeature('writing'); loadSettings(); }, 500);
        return;
      }
      if (availability === 'unavailable') throw new Error('AI Model is not supported on this device.');
      await LanguageModel.create({
        ...MODEL_OPTIONS,
        monitor: (m) => m.addEventListener('downloadprogress', (e) => {
          progressBarFill.style.width = `${(e.loaded / e.total) * 100}%`;
        }),
      });
      setTimeout(() => { showView('features'); showFeature('writing'); loadSettings(); }, 500);
    } catch (err) {
      console.error("Model download error:", err);
      downloadError.textContent = `Error: ${err.message}. Please try again later.`;
      downloadError.style.display = 'block';
      downloadBtn.disabled = false;
      downloadBtn.textContent = 'Initialize AI Model';
    }
  };

  // --- INITIALIZATION ---
  const initialize = () => {
    const isNewInstall = new URLSearchParams(window.location.search).get('newinstall') === 'true';
    if (isNewInstall) {
      logoScreen.style.display = 'flex';
      downloadScreen.style.display = 'none';
      setTimeout(() => {
        logoScreen.style.display = 'none';
        downloadScreen.style.display = 'flex';
      }, 1500);
    } else {
      showView('features');
      showFeature('writing');
      loadSettings();
    }

    // Event Listeners
    downloadBtn.addEventListener('click', handleDownload);
    
    // MODIFIED: Removed the check to allow navigation to disabled tabs.
    tabs.forEach(tab => tab.addEventListener('click', (event) => {
      showFeature(tab.dataset.feature);
    }));

    featureToggles.forEach(toggle => toggle.addEventListener('change', saveSettings));
    dashboardBtn.addEventListener('click', () => showView('dashboard'));
    backToFeaturesBtn.addEventListener('click', () => showView('features'));
  };

  initialize();
});