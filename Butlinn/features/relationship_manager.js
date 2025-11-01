// features/relationship_manager.js

const relationshipManager = {
    _currentRange: null,
    _panelHost: null,
    _shadowRoot: null,
    _cssText: null,
    _isDragging: false,
    _initialMouseX: 0,
    _initialMouseY: 0,
    _initialPanelX: 0,
    _initialPanelY: 0,
    _loadingInterval: null,

    async _loadCSS() {
        if (this._cssText) return;
        try {
            this._cssText = await chrome.runtime.sendMessage({ type: 'get_css', path: 'features/relationship_manager.css' });
        } catch (e) {
            console.error("Butlinn: Could not load component CSS.", e);
            this._cssText = '';
        }
    },

    async startWorkflow(range, selectionBounds) {
        this._currentRange = range;
        await this._createPanel();
        
        try {
               console.log('Sending analysis request with bounds:', selectionBounds);
               if (!selectionBounds || typeof selectionBounds.x !== 'number' || 
                   typeof selectionBounds.y !== 'number' || 
                   typeof selectionBounds.width !== 'number' || 
                   typeof selectionBounds.height !== 'number') {
                   throw new Error('Invalid selection bounds for screenshot');
               }

            chrome.runtime.sendMessage({
                type: 'relationships/analyze_screen',
                    data: { 
                        selectionBounds: selectionBounds,
                        timestamp: new Date().toISOString()
                    }
            });

            const loader = this._shadowRoot.querySelector('.butlinn-panel-loader');
            if (loader) {
                let dots = '';
                this._loadingInterval = setInterval(() => {
                    dots = dots.length >= 3 ? '' : dots + '.';
                    loader.textContent = 'Analyzing' + dots;
                }, 500);
            }
        } catch (error) {
                console.error('Failed to start analysis:', {
                    error: error.message,
                    stack: error.stack,
                    bounds: selectionBounds
                });
                this._showError(`Analysis failed: ${error.message}`);
        }
    },

    _showError(message) {
        if (this._shadowRoot) {
            if (this._loadingInterval) {
                clearInterval(this._loadingInterval);
                this._loadingInterval = null;
            }

            const loader = this._shadowRoot.querySelector('.butlinn-panel-loader');
            const options = this._shadowRoot.querySelector('.butlinn-panel-options');
            
            if (loader) {
                loader.textContent = message;
                loader.style.color = '#ff9a9a';
                loader.style.fontStyle = 'normal';
                
                if (options) options.style.display = 'none';
                
                setTimeout(() => this._cleanup(), 3500);
            }
        }
    },

    async _createPanel() {
        if (this._panelHost) this._panelHost.remove();

        this._panelHost = document.createElement('div');
        this._panelHost.id = 'butlinn-relationship-host';
        this._shadowRoot = this._panelHost.attachShadow({ mode: 'open' });
        await this._loadCSS();

        this._shadowRoot.innerHTML = `
            <style>
                ${this._cssText} 
            </style>
            <div class="butlinn-relationship-panel">
                <div class="butlinn-panel-header">
                    <span>Who are you writing to?</span>
                    <div class="butlinn-panel-controls">
                        <div class="butlinn-panel-toggle-container">
                            <label for="butlinn-tailor-toggle">Tailor</label>
                            <label class="butlinn-toggle-switch">
                                <input type="checkbox" id="butlinn-tailor-toggle" checked>
                                <span class="butlinn-slider"></span>
                            </label>
                        </div>
                    </div>
                </div>
                <div class="butlinn-debug-image-container" style="display: none;">
                    <img class="butlinn-debug-image" />
                </div>
                <div class="butlinn-panel-loader">Analyzing...</div>
                <div class="butlinn-panel-options"></div>
            </div>
        `;

        // --- THIS IS THE FIX (Part 3): Updated width for positioning ---
        const panelWidth = 340;
        const padding = 30;
        this._panelHost.style.position = 'fixed';
        this._panelHost.style.zIndex = '2147483647';
        this._panelHost.style.top = `${padding}px`;
        this._panelHost.style.left = `${window.innerWidth - panelWidth - padding}px`;
        document.body.appendChild(this._panelHost);
        
        const header = this._shadowRoot.querySelector('.butlinn-panel-header');
        header.addEventListener('mousedown', this._onDragStart.bind(this));

        this._onDocumentClick = this._onDocumentClick.bind(this);
        setTimeout(() => {
            document.addEventListener('mousedown', this._onDocumentClick);
        }, 0);
    },
    
    _onDocumentClick(event) {
        if (this._panelHost && !this._panelHost.contains(event.target)) {
            this._cleanup();
        }
    },
    
    _populatePanel(recipients, debugImageUrl) {
        if (this._loadingInterval) {
            clearInterval(this._loadingInterval);
            this._loadingInterval = null;
        }

        const loader = this._shadowRoot.querySelector('.butlinn-panel-loader');
        if (loader) loader.remove();
        
        if (debugImageUrl) {
            const imageContainer = this._shadowRoot.querySelector('.butlinn-debug-image-container');
            const debugImage = this._shadowRoot.querySelector('.butlinn-debug-image');
            debugImage.src = debugImageUrl;
            imageContainer.style.display = 'block';
        }
        
        const optionsContainer = this._shadowRoot.querySelector('.butlinn-panel-options');
        optionsContainer.innerHTML = '';
        const allOptions = ["General Audience", ...recipients];
        allOptions.forEach(name => {
            const button = document.createElement('button');
            button.textContent = name;
            button.onclick = () => this._handleSelection(name);
            optionsContainer.appendChild(button);
        });
    },

    _handleSelection(recipientName) {
        const tailorToggle = this._shadowRoot.querySelector('#butlinn-tailor-toggle');
        const useRelationship = tailorToggle.checked;
        const options = {
            useRelationship: useRelationship,
            recipientAlias: recipientName === "General Audience" ? null : recipientName
        };
        activateButlinn(this._currentRange, options);
        this._cleanup();
    },
    
    _cleanup() {
        if (this._loadingInterval) {
            clearInterval(this._loadingInterval);
            this._loadingInterval = null;
        }
        if (this._panelHost) {
            document.removeEventListener('mousedown', this._onDocumentClick);
            document.removeEventListener('mousemove', this._onDragMove);
            document.removeEventListener('mouseup', this._onDragEnd);
            this._panelHost.remove();
            this._panelHost = null;
            this._shadowRoot = null;
        }
        this._currentRange = null;
    },

    _onDragStart(event) {
        if (event.button !== 0 || event.target.closest('.butlinn-panel-toggle-container')) return;
        this._isDragging = true;
        this._initialMouseX = event.clientX;
        this._initialMouseY = event.clientY;
        const rect = this._panelHost.getBoundingClientRect();
        this._initialPanelX = rect.left;
        this._initialPanelY = rect.top;
        this._onDragMove = this._onDragMove.bind(this);
        this._onDragEnd = this._onDragEnd.bind(this);
        document.addEventListener('mousemove', this._onDragMove);
        document.addEventListener('mouseup', this._onDragEnd);
    },

    _onDragMove(event) {
        if (!this._isDragging) return;
        event.preventDefault();
        const dx = event.clientX - this._initialMouseX;
        const dy = event.clientY - this._initialMouseY;
        this._panelHost.style.left = `${this._initialPanelX + dx}px`;
        this._panelHost.style.top = `${this._initialPanelY + dy}px`;
        this._panelHost.style.right = 'auto';
    },

    _onDragEnd() {
        this._isDragging = false;
        document.removeEventListener('mousemove', this._onDragMove);
        document.removeEventListener('mouseup', this._onDragEnd);
    }
};