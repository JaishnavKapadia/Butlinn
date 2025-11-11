// ui/dashboard/views/dashboard_relationships.js

// --- CONSTANTS ---
const CLOSENESS_LEVELS = {
    5: 'Close Friends & Family',
    4: 'Friends',
    3: 'Colleagues & Acquaintances',
    2: 'Formal Contacts',
    1: 'Distant Contacts'
};

const TONE_DEFAULTS = {
    5: 'Casual & Personal',
    4: 'Friendly & Casual',
    3: 'Professional & Friendly',
    2: 'Formal & Respectful',
    1: 'Neutral & Polite'
};

export const dashboardRelationships = {
    // --- State ---
    _allPeople: [],
    _draggedPersonId: null,
    _modal: document.getElementById('edit-modal'),
    
    // --- Initialization ---
    init() {
        this._addEventListeners();
        // This message is sent to the parent window's service worker
        chrome.runtime.sendMessage({ type: 'relationships/get_all' });
    },

    handleData(people) {
        this._allPeople = people;
        this._render();
    },

    // --- Main Render Function ---
    _render() {
        const categoriesContainer = document.getElementById('categories-container');
        const uncategorizedList = document.getElementById('uncategorized-list');
        categoriesContainer.innerHTML = '';
        uncategorizedList.innerHTML = '';

        const categorizedPeople = this._allPeople.filter(p => p.closeness > 0);
        const uncategorizedPeople = this._allPeople.filter(p => !p.closeness || p.closeness === 0);

        Object.entries(CLOSENESS_LEVELS).sort((a,b) => b[0] - a[0]).forEach(([level, name]) => {
            const categoryContainer = this._createCategoryContainer(name, level);
            const dropZone = categoryContainer.querySelector('.person-drop-zone');
            
            categorizedPeople.filter(p => p.closeness == level).forEach(person => {
                dropZone.appendChild(this._createPersonCard(person));
            });
            categoriesContainer.appendChild(categoryContainer);
        });

        uncategorizedPeople.forEach(person => {
            uncategorizedList.appendChild(this._createUncategorizedItem(person));
        });
    },

    // --- Element Creation ---
    _createCategoryContainer(name, level) {
        const container = document.createElement('div');
        container.className = 'category-container';
        container.innerHTML = `<h6>${name}</h6><div class="person-drop-zone" data-closeness-level="${level}"></div>`;
        const dropZone = container.querySelector('.person-drop-zone');
        this._addDropZoneListeners(dropZone);
        return container;
    },

    _createPersonCard(person) {
        const card = document.createElement('div');
        card.className = 'person-card compact-card';
        card.dataset.personId = person.id;
        card.draggable = true;
        this._addDragListeners(card);
        this._addDropZoneListeners(card);
        this._setCardContent(card, person, true);
        return card;
    },

    _createUncategorizedItem(person) {
        const item = document.createElement('div');
        item.className = 'alias-item';
        item.textContent = person.primaryName;
        item.dataset.personId = person.id;
        item.draggable = true;
        this._addDragListeners(item);
        return item;
    },

    _toggleCard(clickedCard) {
        const personId = clickedCard.dataset.personId;
        const person = this._allPeople.find(p => p.id === personId);
        if (!person) return;

        const isNowCompact = clickedCard.classList.contains('compact-card');

        document.querySelectorAll('.person-card:not(.compact-card)').forEach(openCard => {
            if (openCard !== clickedCard) {
                const openPersonId = openCard.dataset.personId;
                const openPerson = this._allPeople.find(p => p.id === openPersonId);
                if (openPerson) {
                    openCard.classList.add('compact-card');
                    this._setCardContent(openCard, openPerson, true);
                }
            }
        });

        if (isNowCompact) {
            clickedCard.classList.remove('compact-card');
            this._setCardContent(clickedCard, person, false);
        } else {
            clickedCard.classList.add('compact-card');
            this._setCardContent(clickedCard, person, true);
        }
    },
    
    _setCardContent(cardElement, person, isCompact) {
        if (isCompact) {
            cardElement.innerHTML = `
                <div class="card-header">
                    <span>${person.primaryName}</span>
                    <div class="closeness-indicator">${'★'.repeat(person.closeness)}</div>
                </div>
            `;
        } else {
            const aliasesHTML = person.aliases.map(alias => `<li>${alias}</li>`).join('');
            cardElement.innerHTML = `
                <div class="card-header">
                    <span>${person.primaryName}</span>
                    <button class="edit-btn">Edit</button>
                </div>
                <div class="card-details-grid">
                    <label>Closeness:</label>
                    <span>${'★'.repeat(person.closeness)}${'☆'.repeat(5 - person.closeness)}</span>
                    <label>Tone:</label>
                    <span>${person.preferredTone || 'Not set'}</span>
                    <label>Aliases:</label>
                    <ul class="aliases-list">${aliasesHTML}</ul>
                </div>
                <div class="notes-section">
                     <p>${person.notes || 'No notes added.'}</p>
                </div>
            `;
        }
    },

    // --- Drag and Drop Logic ---
    _addDragListeners(element) {
        element.addEventListener('dragstart', this._onDragStart.bind(this));
        element.addEventListener('dragend', this._onDragEnd.bind(this));
    },

    _addDropZoneListeners(element) {
        element.addEventListener('dragover', this._onDragOver.bind(this));
        element.addEventListener('dragleave', this._onDragLeave.bind(this));
        element.addEventListener('drop', this._onDrop.bind(this));
    },

    _onDragStart(event) {
        this._draggedPersonId = event.target.dataset.personId;
        event.target.classList.add('dragging');
    },
    _onDragEnd(event) { event.target.classList.remove('dragging'); },
    _onDragOver(event) {
        event.preventDefault();
        const dropTarget = event.target.closest('.person-drop-zone, .person-card');
        if (dropTarget) dropTarget.classList.add('drag-over');
    },
    _onDragLeave(event) {
        const dropTarget = event.target.closest('.person-drop-zone, .person-card');
        if (dropTarget) dropTarget.classList.remove('drag-over');
    },

    _onDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        const draggedId = this._draggedPersonId;
        const targetCard = event.target.closest('.person-card');
        const targetCategoryZone = event.target.closest('.person-drop-zone');

        if (targetCard) {
            targetCard.classList.remove('drag-over');
            const targetId = targetCard.dataset.personId;
            if (draggedId && targetId && draggedId !== targetId) this._mergePeople(draggedId, targetId);
        } else if (targetCategoryZone) {
            targetCategoryZone.classList.remove('drag-over');
            
            if (targetCategoryZone.id === 'uncategorized-list') {
                this._dissolvePerson(draggedId);
            } 
            else {
                const newCloseness = targetCategoryZone.dataset.closenessLevel;
                this._updateCloseness(draggedId, newCloseness);
            }
        }
    },
    
    // --- Core Actions ---
    _updateCloseness(personId, newCloseness) {
        const person = this._allPeople.find(p => p.id === personId);
        if (person) {
            person.closeness = parseInt(newCloseness);
            person.preferredTone = TONE_DEFAULTS[newCloseness];
            this._render();
            chrome.runtime.sendMessage({ type: 'relationships/update', data: person });
        }
    },

    _mergePeople(draggedId, targetId) {
        const draggedPerson = this._allPeople.find(p => p.id === draggedId);
        const targetPerson = this._allPeople.find(p => p.id === targetId);
        if (!draggedPerson || !targetPerson) return;

        targetPerson.aliases = [...new Set([...targetPerson.aliases, draggedPerson.primaryName, ...draggedPerson.aliases])];
        this._allPeople = this._allPeople.filter(p => p.id !== draggedId);
        
        this._render();
        chrome.runtime.sendMessage({ type: 'relationships/update_batch', data: { update: targetPerson, deleteId: draggedId } });
    },

    _dissolvePerson(personId) {
        const personToDissolve = this._allPeople.find(p => p.id === personId);
        if (!personToDissolve || personToDissolve.aliases.length <= 1) {
            this._updateCloseness(personId, 0);
            return;
        }

        const allNames = [...new Set([personToDissolve.primaryName, ...personToDissolve.aliases])];
        const newPeople = allNames.map(name => ({
            id: crypto.randomUUID(),
            primaryName: name,
            aliases: [name],
            closeness: 0,
            preferredTone: 'Professional',
            notes: ''
        }));

        this._allPeople = this._allPeople.filter(p => p.id !== personId);
        this._allPeople.push(...newPeople);
        this._render();

        chrome.runtime.sendMessage({
            type: 'relationships/dissolve',
            data: {
                deleteId: personId,
                newPeople: newPeople
            }
        });
    },

    _clearUncategorized() {
        if (!confirm("Are you sure you want to permanently delete all uncategorized contacts?")) return;
        const idsToDelete = this._allPeople.filter(p => !p.closeness || p.closeness === 0).map(p => p.id);
        if (idsToDelete.length === 0) return;
        this._allPeople = this._allPeople.filter(p => p.closeness > 0);
        this._render();
        chrome.runtime.sendMessage({ type: 'relationships/delete_batch', data: { ids: idsToDelete }});
    },

    // --- Modal Logic ---
    _openEditModal(personId) {
        const person = this._allPeople.find(p => p.id === personId);
        if (!person) return;
        this._modal.dataset.editingId = personId;
        this._modal.querySelector('#edit-primaryName').value = person.primaryName;
        this._modal.querySelector('#edit-closeness').value = person.closeness;
        this._modal.querySelector('#edit-tone').value = person.preferredTone || '';
        this._modal.querySelector('#edit-notes').value = person.notes || '';
        this._modal.classList.remove('hidden');
    },

    _closeEditModal() { this._modal.classList.add('hidden'); },

    _saveModalChanges() {
        const personId = this._modal.dataset.editingId;
        const person = this._allPeople.find(p => p.id === personId);
        if (!person) return;
        person.primaryName = this._modal.querySelector('#edit-primaryName').value;
        person.closeness = parseInt(this._modal.querySelector('#edit-closeness').value);
        person.preferredTone = this._modal.querySelector('#edit-tone').value;
        person.notes = this._modal.querySelector('#edit-notes').value;
        this._render();
        chrome.runtime.sendMessage({ type: 'relationships/update', data: person });
        this._closeEditModal();
    },

    // --- Event Listeners ---
    _addEventListeners() {
        document.getElementById('clear-uncategorized-btn').addEventListener('click', this._clearUncategorized.bind(this));
        document.getElementById('modal-save-btn').addEventListener('click', this._saveModalChanges.bind(this));
        document.getElementById('modal-cancel-btn').addEventListener('click', this._closeEditModal.bind(this));

        // Listen for messages from the background script
        chrome.runtime.onMessage.addListener((request) => {
            if (request.type === 'dashboard/relationships_list') {
                this.handleData(request.data);
            }
        });
        
        document.getElementById('categories-container').addEventListener('click', (event) => {
            const card = event.target.closest('.person-card');
            const editButton = event.target.closest('.edit-btn');
            if (editButton) {
                const personId = card.dataset.personId;
                this._openEditModal(personId);
            } else if (card) {
                this._toggleCard(card);
            }
        });
        
        const uncategorizedList = document.getElementById('uncategorized-list');
        this._addDropZoneListeners(uncategorizedList);
    }
};

// Initialize the script
dashboardRelationships.init();