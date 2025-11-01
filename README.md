# Butlinn - Your Personal AI Butler  butler

> A privacy-first Chrome extension that acts as a personal AI assistant, learning about you to provide context-aware, tailored writing suggestions directly in your browser.



## ✨ Key Features

Butlinn is more than just a grammar checker; it's a secure AI companion that understands your world.

*   **✍️ Context-Aware Writing Suggestions**: Select any text you're writing, and Butlinn will offer professional rewrites and improvements.
*   **🎯 "Tailor" Suggestions with Vision AI**: The flagship feature. Butlinn captures a screenshot of your active window, uses **on-device vision AI** to identify who you're writing to (e.g., from an email "To:" field), and tailors the suggestion to match the tone and closeness you've defined for that relationship.
*   **🔒 Privacy-First Architecture**: All AI processing happens **on your device** using Chrome's built-in Language Model. Your browsing history, personal documents, and conversations never leave your computer.
*   **🤝 Relationship Management**: A dedicated dashboard allows you to categorize your contacts (from close friends to formal colleagues), defining the preferred tone for each. This data directly informs the "Tailor" feature.
*   **🧠 Personal Knowledge Vault**: Upload text and PDF files to your secure, local "Vault." Butlinn uses this information to build a comprehensive understanding of your projects, work, and interests.
*   **🤖 Automated User Profile**: Butlinn analyzes your (optional) browsing history and uploaded files to create and maintain an AI-generated summary of you, enabling hyper-personalized assistance.

## 🛠️ Tech Stack

This project was built with a focus on privacy, performance, and modern web technologies within the Chrome Extension ecosystem.

*   **Manifest V3**: The latest standard for Chrome Extensions.
*   **On-Device AI**: Powered by `chrome.ai` (Language Model API) for both text and vision tasks.
*   **JavaScript (ES Modules)**: Clean, modular, and modern JavaScript across the entire extension.
*   **Offscreen Documents**: Used to run long-running AI tasks without the service worker being terminated.
*   **IndexedDB**: Provides a robust, client-side database for storing vault files and relationship data securely.
*   **HTML5 & CSS3**: For the popup, dashboard, and in-page UI components.

## 🚀 Getting Started

To run and test the extension locally:

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/JaishnavKapadia/butlinn.git
    ```
2.  **Open Chrome and navigate to `chrome://extensions`**.
3.  **Enable "Developer mode"** using the toggle in the top-right corner.
4.  Click the **"Load unpacked"** button.
5.  Select the cloned Sub-project directory. The "Butlinn" extension icon should now appear in your browser's toolbar.

> **Note**: After making changes to the code, you will need to click the "Reload" button for the extension in the `chrome://extensions` page and then **reload any web page** where you are testing the content script.

## 🏛️ Project Architecture

*   `background.js`: The central service worker that acts as a message broker and orchestrates all tasks.
*   `content_script.js`: Injected into web pages to handle text selection, UI rendering (trigger button, toolbars), and communication with the background.
*   `offscreen.html` / `offscreen.js`: The "engine room" where all heavy AI processing (text generation, vision analysis) takes place.
*   `dashboard.html` / `dashboard.js`: The main user interface for managing relationships, the file vault, and settings.
*   `/features/`: Contains the core AI logic modules (`vision_analyzer.js`, `writing_suggester.js`, etc.).
*   `/core/`: Contains foundational services for storage (`storage.js`), AI model creation (`llm.js`), and context gathering (`context_compiler.js`).

## 📄 License

This project is licensed under the MIT License. See the `LICENSE` file for details.
