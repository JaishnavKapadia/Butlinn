// ui/content/content_script.js

let savedRange = null;
let activeToolbar = null;
let triggerButton = null;
let originalText = '';
let currentSuggestion = '';
let fullContext = '';
let iconDataURL = null;
let selectionDebounceTimer = null;
let isButlinnActive = false;
let activeEditorElement = null;

let isDragging = false;
let initialMouseX, initialMouseY;
let initialToolbarX, initialToolbarY;

let isDropdownDragging = false;
let initialDropdownMouseX, initialDropdownMouseY;
let initialDropdownX, initialDropdownY;

let dropdownPanel = null;
let isDropdownOpen = false;
let suggestionVariants = [];
let receivedVariantsCount = 0;
let currentVariantIndex = 2;
const sliderSteps = [0, 25, 50, 75, 100];
let isVariantLoading = false;
let streamedVariantText = '';


/**
 * Converts newline characters (\n) in a string to HTML line break tags (<br>).
 * @param {string} str The input string.
 * @returns {string} The string with newlines converted to <br> tags.
 */
function nl2br(str) {
    if (typeof str !== 'string') {
        return '';
    }
    return str.replace(/(?:\r\n|\r|\n)/g, '<br>');
}

function _cleanAIResponse(text) {
    let cleanedText = text.trim();
    if ((cleanedText.startsWith('"') && cleanedText.endsWith('"')) ||
        (cleanedText.startsWith("'") && cleanedText.endsWith("'"))) {
        cleanedText = cleanedText.substring(1, cleanedText.length - 1);
    }
    return cleanedText;
}

document.addEventListener('selectionchange', handleSelectionChange);
document.addEventListener('mousedown', handleMouseDown);
document.addEventListener('keydown', handleKeyDown);
chrome.runtime.onMessage.addListener(handleBackgroundMessages);

async function handleSelectionChange() {
    clearTimeout(selectionDebounceTimer);
    selectionDebounceTimer = setTimeout(async () => {
        const { isWritingSuggestionsEnabled } = await chrome.storage.local.get('isWritingSuggestionsEnabled');
        if (!isWritingSuggestionsEnabled || isButlinnActive) {
            hideTriggerButton();
            return;
        }

        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
            hideTriggerButton();
            return;
        }
        const parentEditable = selection.getRangeAt(0).startContainer.parentElement.closest('textarea, input, [contenteditable="true"]');
        if (!parentEditable || selection.toString().trim().length < 5) {
            hideTriggerButton();
            return;
        }
        savedRange = selection.getRangeAt(0).cloneRange();
        activeEditorElement = parentEditable;
        showTriggerButton(savedRange);
    }, 200);
}

function handleKeyDown(event) {
    if (event.key === 'Tab' && isButlinnActive) {
        handleTabKey(event);
        return;
    }
    if (event.ctrlKey && event.key.toLowerCase() === 'z') {
        cleanup();
        return;
    }
    if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key && event.key.length === 1) {
        hideTriggerButton();
    }
}

function handleMouseDown(event) {
    if (triggerButton && !triggerButton.contains(event.target)) {
        hideTriggerButton();
    }
    if (isButlinnActive && activeToolbar && !activeToolbar.contains(event.target) &&
        (!dropdownPanel || !dropdownPanel.contains(event.target))) {
        cleanup();
    }
}

async function getIconDataURL() {
    if (iconDataURL) return iconDataURL;
    try {
        const response = await chrome.runtime.sendMessage({ type: 'get_icon_data_url' });
        iconDataURL = response.dataUrl;
        return iconDataURL;
    } catch (error) {
        if (error.message.includes('Extension context invalidated') || error.message.includes('Receiving end does not exist')) {
            console.log("Butlinn: Context invalidated. Please reload the page to fix.");
        } else {
            console.error("Butlinn: Could not get icon from background.", error);
        }
        return null;
    }
}

async function showTriggerButton(range) {
    if (!triggerButton) {
        const imageData = await getIconDataURL();
        if (!imageData) return; 
        
        triggerButton = document.createElement('button');
        triggerButton.id = 'butlinn-trigger-btn';
        triggerButton.innerHTML = `<img src="${imageData}" alt="Butlinn">`;
        triggerButton.addEventListener('click', handleTriggerClick);
    }
    if (!triggerButton.isConnected) {
        document.body.appendChild(triggerButton);
    }
    triggerButton.style.visibility = 'hidden';
    const rects = range.getClientRects();
    if (rects.length === 0) return;
    const firstRect = rects[0];
    const buttonHeight = triggerButton.offsetHeight;
    const top = window.scrollY + firstRect.top - buttonHeight;
    const left = window.scrollX + firstRect.left - buttonHeight;
    triggerButton.style.top = `${top}px`;
    triggerButton.style.left = `${left}px`;
    triggerButton.style.visibility = 'visible';
}

function hideTriggerButton() {
    if (triggerButton) {
        triggerButton.remove();
        triggerButton = null;
    }
}

async function handleTriggerClick(event) {
    event.stopPropagation();
    console.log('Butlinn CS: Trigger clicked.');

    const { isTailorEnabled } = await chrome.storage.local.get('isTailorEnabled');

    if (!savedRange) {
        console.error('Butlinn CS: handleTriggerClick called but savedRange is null.');
        return;
    }

    hideTriggerButton();

    if (isTailorEnabled) {
        relationshipManager.startWorkflow(savedRange.cloneRange(), activeEditorElement);
    } else {
        activateButlinn(savedRange.cloneRange(), { useRelationship: false });
    }
}

async function activateButlinn(range, options = {}) {
    isButlinnActive = true;
    currentVariantIndex = 2;
    receivedVariantsCount = 0;
    isVariantLoading = false;
    originalText = range.toString();
    const editor = range.startContainer.parentElement.closest('textarea, input, [contenteditable="true"]');
    fullContext = editor ? (editor.value || editor.innerText) : originalText;
    createToolbar(true);
    chrome.runtime.sendMessage({
        type: 'writing/get_suggestion',
        data: {
            selectedText: originalText,
            fullContext: fullContext,
            rewriteStyle: 'initial',
            variantIndex: 2,
            options: options
        }
    });
}

function handleBackgroundMessages(request, sender, sendResponse) {
    if (!isButlinnActive) return;
    const preview = activeToolbar?.querySelector('.butlinn-suggestion-preview');
    switch (request.type) {
        case 'writing_suggestion_result':
            currentSuggestion = _cleanAIResponse(request.result);
            suggestionVariants = new Array(5).fill(null);
            suggestionVariants[2] = currentSuggestion;
            receivedVariantsCount = 1;
            displaySuggestion(currentSuggestion);
            const dropdownBtn = activeToolbar?.querySelector('.butlinn-dropdown-btn');
            if (dropdownBtn) {
                dropdownBtn.classList.remove('loading-variants');
                dropdownBtn.title = 'Options';
            }
            break;
        case 'writing_suggestion_chunk':
            if (preview && request.variantIndex === currentVariantIndex) {
                streamedVariantText += request.chunk;
                preview.textContent = streamedVariantText;
            }
            break;
        case 'writing_suggestion_stream_end':
            if (request.variantIndex === currentVariantIndex) {
                const cleanedStream = _cleanAIResponse(streamedVariantText);
                suggestionVariants[request.variantIndex] = cleanedStream;
                currentSuggestion = cleanedStream;
                if(preview) preview.textContent = cleanedStream;
                isVariantLoading = false;
                toggleAcceptButton(true);
            }
            break;
        case 'writing_suggestion_error':
            console.error("Butlinn Error:", request.message);
            if (request.data && request.data.variantIndex === 2) {
                cleanup();
            } else if (preview && request.data.variantIndex === currentVariantIndex) {
                preview.textContent = "Error generating this version.";
                isVariantLoading = false;
                toggleAcceptButton(true);
            }
            break;
    }
}

function displaySuggestion(suggestionText) {
    if (!isButlinnActive) return;
    createToolbar(false, suggestionText);
}

async function handleTabKey(event) {
    event.preventDefault();
    if (!isButlinnActive) return;
    createToolbar(true);
    await activateButlinn(savedRange);
}

function toggleDropdown(event, dropdownBtn) {
    event.stopPropagation();
    if (dropdownBtn.classList.contains('loading-variants')) return;
    isDropdownOpen ? closeDropdown() : openDropdown(dropdownBtn);
}

function openDropdown(dropdownBtn) {
    if (!dropdownPanel) {
        createDropdownPanel();
        document.body.appendChild(dropdownPanel);
    }
    dropdownPanel.style.visibility = 'hidden';
    dropdownPanel.style.display = 'block';
    const panelWidth = dropdownPanel.offsetWidth;
    dropdownPanel.style.visibility = '';
    dropdownPanel.style.display = 'none';
    const btnRect = dropdownBtn.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    let leftInViewport = btnRect.right - panelWidth;
    if (leftInViewport < 0) {
        leftInViewport = btnRect.left;
    }
    if (leftInViewport + panelWidth > viewportWidth) {
        leftInViewport = viewportWidth - panelWidth - 5;
    }
    dropdownPanel.style.top = `${window.scrollY + btnRect.bottom + 5}px`;
    dropdownPanel.style.left = `${window.scrollX + leftInViewport}px`;
    dropdownPanel.classList.add('visible');
    dropdownPanel.style.display = 'block';
    dropdownBtn.classList.add('active');
    isDropdownOpen = true;
}

function closeDropdown() {
    if (dropdownPanel) {
        dropdownPanel.remove();
        dropdownPanel = null;
    }
    activeToolbar?.querySelector('.butlinn-dropdown-btn')?.classList.remove('active');
    isDropdownOpen = false;
}

function createDropdownPanel() {
    dropdownPanel = document.createElement('div');
    dropdownPanel.className = 'butlinn-dropdown-panel';
    dropdownPanel.style.cursor = 'move';
    dropdownPanel.addEventListener('mousedown', onDropdownDragStart);
    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'butlinn-slider-container';
    const label = document.createElement('div');
    label.className = 'butlinn-slider-label';
    label.textContent = 'Length';
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.step = '25';
    slider.value = sliderSteps[currentVariantIndex].toString();
    slider.className = 'butlinn-slider';
    const valueDisplay = document.createElement('div');
    valueDisplay.className = 'butlinn-slider-value';
    valueDisplay.textContent = `${slider.value}%`;
    const handleSliderChange = (event) => {
        const rawValue = parseInt(event.target.value);
        const newIndex = sliderSteps.indexOf(rawValue);
        currentVariantIndex = newIndex;
        const preview = activeToolbar?.querySelector('.butlinn-suggestion-preview');
        if (suggestionVariants[newIndex]) {
            currentSuggestion = suggestionVariants[newIndex];
            if (preview) preview.textContent = currentSuggestion;
            isVariantLoading = false;
            toggleAcceptButton(true);
        } else {
            isVariantLoading = true;
            streamedVariantText = '';
            if (preview) preview.textContent = '';
            toggleAcceptButton(false);
            const styleMap = ['concise', 'detailed', null, 'descriptive', 'verbose'];
            chrome.runtime.sendMessage({
                type: 'writing/get_suggestion',
                data: { rewriteStyle: styleMap[newIndex], variantIndex: newIndex, baseText: suggestionVariants[2] }
            });
        }
    };
    slider.addEventListener('input', (e) => valueDisplay.textContent = `${e.target.value}%`);
    slider.addEventListener('change', handleSliderChange);
    sliderContainer.append(label, slider, valueDisplay);
    dropdownPanel.appendChild(sliderContainer);
}

function createToolbar(isLoading = false, suggestionText = '') {
    if (activeToolbar) activeToolbar.remove();
    if (!savedRange) return;
    closeDropdown();
    activeToolbar = document.createElement('div');
    activeToolbar.className = 'butlinn-toolbar';
    if (isLoading) {
        const loadingSpan = document.createElement('span');
        loadingSpan.className = 'butlinn-loading-text';
        loadingSpan.textContent = 'Butlinn is thinking...';
        activeToolbar.appendChild(loadingSpan);
    } else {
        const preview = document.createElement('span');
        preview.className = 'butlinn-suggestion-preview';
        preview.textContent = suggestionText;
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'butlinn-actions';
        const rejectBtn = document.createElement('button');
        rejectBtn.className = 'butlinn-reject-btn';
        rejectBtn.innerHTML = '&#x2715;';
        rejectBtn.title = 'Reject';
        rejectBtn.onclick = (e) => { e.stopPropagation(); cleanup(); };
        const acceptBtn = document.createElement('button');
        acceptBtn.className = 'butlinn-accept-btn';
        acceptBtn.innerHTML = '&#10003;';
        acceptBtn.title = 'Accept';
        acceptBtn.onclick = (e) => { e.stopPropagation(); acceptSuggestion(); };
        const dropdownBtn = document.createElement('button');
        dropdownBtn.className = 'butlinn-dropdown-btn loading-variants';
        dropdownBtn.innerHTML = '&#9662;';
        dropdownBtn.title = 'Loading...';
        dropdownBtn.onclick = (e) => toggleDropdown(e, dropdownBtn);
        actionsContainer.append(rejectBtn, acceptBtn, dropdownBtn);
        activeToolbar.append(preview, actionsContainer);
    }
    activeToolbar.addEventListener('mousedown', onDragStart);
    document.body.appendChild(activeToolbar);
    positionToolbar();
}

function toggleAcceptButton(enable) {
    const acceptBtn = activeToolbar?.querySelector('.butlinn-accept-btn');
    if (acceptBtn) acceptBtn.disabled = !enable;
}

function positionToolbar() {
    if (!activeToolbar || !savedRange) return;
    const rects = savedRange.getClientRects();
    if (rects.length === 0) return;
    const firstRect = rects[0];
    const top = window.scrollY + firstRect.top - activeToolbar.offsetHeight - 5;
    const left = window.scrollX + firstRect.left;
    activeToolbar.style.top = `${top}px`;
    activeToolbar.style.left = `${left}px`;
}

function onDragStart(event) {
    if (event.target.tagName === 'BUTTON' || event.target.tagName === 'INPUT' || (dropdownPanel && dropdownPanel.contains(event.target))) return;
    isDragging = true;
    activeToolbar.classList.add('dragging');
    initialMouseX = event.clientX;
    initialMouseY = event.clientY;
    initialToolbarX = activeToolbar.offsetLeft;
    initialToolbarY = activeToolbar.offsetTop;
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
}

function onDragMove(event) {
    if (!isDragging) return;
    event.preventDefault();
    const dx = event.clientX - initialMouseX;
    const dy = event.clientY - initialMouseY;
    activeToolbar.style.left = `${initialToolbarX + dx}px`;
    activeToolbar.style.top = `${initialToolbarY + dy}px`;
}

function onDragEnd() {
    isDragging = false;
    if (activeToolbar) activeToolbar.classList.remove('dragging');
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
}

function onDropdownDragStart(event) {
    if (event.target.tagName === 'INPUT') return;
    event.stopPropagation();
    isDropdownDragging = true;
    initialDropdownMouseX = event.clientX;
    initialDropdownMouseY = event.clientY;
    initialDropdownX = dropdownPanel.offsetLeft;
    initialDropdownY = dropdownPanel.offsetTop;
    document.addEventListener('mousemove', onDropdownDragMove);
    document.addEventListener('mouseup', onDropdownDragEnd);
}

function onDropdownDragMove(event) {
    if (!isDropdownDragging) return;
    event.preventDefault();
    const dx = event.clientX - initialDropdownMouseX;
    const dy = event.clientY - initialDropdownMouseY;
    dropdownPanel.style.left = `${initialDropdownX + dx}px`;
    dropdownPanel.style.top = `${initialDropdownY + dy}px`;
}

function onDropdownDragEnd() {
    isDropdownDragging = false;
    document.removeEventListener('mousemove', onDropdownDragMove);
    document.removeEventListener('mouseup', onDropdownDragEnd);
}


function acceptSuggestion() {
    if (!savedRange || isVariantLoading) return;
    
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(savedRange);

    
    const suggestionAsHTML = nl2br(currentSuggestion);
    document.execCommand('insertHTML', false, suggestionAsHTML);
    
    cleanup();
}

function cleanup() {
    hideTriggerButton();
    closeDropdown();
    if (activeToolbar) {
        activeToolbar.remove();
        activeToolbar = null;
    }
    savedRange = null;
    isButlinnActive = false;
    isDragging = false;
    isDropdownDragging = false;
    suggestionVariants = [];
    activeEditorElement = null;
}