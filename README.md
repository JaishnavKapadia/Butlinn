# Butlinn - Your Personal AI Butler

> A privacy-first Chrome extension that acts as a personal AI assistant, providing context-aware, tailored writing suggestions directly in your browser.

## ✨ Key Features

Butlinn is a secure AI companion that helps you write better by understanding your world and your relationships.

*   **✍️ Context-Aware Writing Suggestions**: Select any text you're writing, and Butlinn will offer professional rewrites and improvements directly on the page, complete with options to adjust the length and tone.

*   **🎯 "Tailor" Suggestions to Your Contacts**: The flagship feature. Butlinn intelligently analyzes the webpage to automatically identify who you're writing to. It then tailors the suggestion to match the specific tone and closeness you've defined for that relationship.

*   **🔒 Privacy-First Architecture**: All AI processing happens **on your device** using Chrome's built-in Language Model. Your conversations and relationship data never leave your computer.

*   **🤝 Unified Relationship Dashboard**: A polished, multi-screen dashboard serves as the central hub. It features an elegant onboarding flow for new users, a dynamic showcase of the extension's features with animated GIFs, and a powerful interface for managing your contacts and their preferred communication styles.

## 🛠️ Tech Stack

This project was built with a focus on privacy, performance, and a modern user experience within the Chrome Extension ecosystem.

*   **Manifest V3**: The latest standard for Chrome Extensions, ensuring security and performance.
*   **On-Device AI**: Powered by `chrome.ai` (Language Model API) for all text-generation tasks.
*   **JavaScript (ES Modules)**: Clean, modular, and modern JavaScript across the entire extension.
*   **Offscreen Documents**: Used to run the AI model reliably without being terminated by the service worker.
*   **IndexedDB**: Provides a robust, client-side database for storing your relationship data securely.
*   **HTML5 & CSS3**: For the popup, dynamic dashboard, and in-page UI components.

## 🚀 Getting Started

To run and test the extension locally:

1.  **Clone the repository**.
2.  **Open Chrome and navigate to `chrome://extensions`**.
3.  **Enable "Developer mode"** using the toggle in the top-right corner.
4.  Click the **"Load unpacked"** button.
5.  Select the cloned project directory. The Butlinn extension icon should now appear in your browser's toolbar.

> **Note**: After making changes to the code, you will need to click the "Reload" button for the extension in the `chrome://extensions` page and then **reload any web page** where you are testing the content script.

## 🏛️ Project Architecture

The project is organized into a clean, feature-based structure for maintainability.

*   `service/`: Contains all background logic, including the `background.js` service worker and the `offscreen.js` document for handling AI tasks.
*   `features/`: Contains the core AI and feature logic.
    *   `features/tailor/`: A dedicated sub-folder for the "Tailor" feature, including the `recipient_finder.js` and the UI manager.
    *   `writing_suggester.js`: The module responsible for generating all writing suggestions.
*   `ui/`: Contains all user-interface-related code, broken down by component.
    *   `ui/content/`: For the scripts and styles injected directly into web pages.
    *   `ui/dashboard/`: For the main dashboard hub, feature showcase, and the embedded relationship manager.
    *   `ui/popup/`: For the simple browser action popup.
*   `core/`: Contains foundational services for storage (`storage.js`) and AI model creation (`llm.js`).

## 📄 License

This project is licensed under the MIT License. See the `LICENSE` file for details.