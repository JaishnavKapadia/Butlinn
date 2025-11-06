/**
 * @file Recipient Finder
 * @description A tiered, scalable script to identify the recipient of a reply on various websites.
 * @version 2.0.0
 */

// Encapsulate the script to avoid polluting the global namespace.
// It attaches its main object to the window so other content scripts can access it.
if (!window.recipientFinder) {
    /**
     * Main application object that encapsulates all functionality.
     * @namespace RecipientFinder
     */
    const RecipientFinder = {
        /**
         * A collection of site-specific configurations and logic.
         * To add a new site, add a new key with the site's hostname and provide a `find` method.
         * @property {Object} SITE_RECIPES
         */
        SITE_RECIPES: {
            'www.linkedin.com': {
                /**
                 * Finds the recipient on LinkedIn.
                 * @param {HTMLElement} activeElement - The currently focused element.
                 * @returns {string|null} The recipient's name or null if not found.
                 */
                find: (activeElement) => {
                    const composer = activeElement.closest('div[contenteditable="true"][role="textbox"]');
                    if (!composer) return null;

                    // Path A: Replying to a comment (name is pre-filled in a <p> tag).
                    const prefilled = composer.querySelector('p');
                    if (prefilled && prefilled.innerText.trim()) {
                        return prefilled.innerText.trim();
                    }

                    // Path B: Replying to a main post (composer is empty).
                    const postContainer = composer.closest('[data-urn^="urn:li:share:"], [data-urn^="urn:li:activity:"]');
                    if (postContainer) {
                        const authorEl = postContainer.querySelector('.update-components-actor__title span[aria-hidden="true"]');
                        if (authorEl) {
                            return authorEl.innerText.trim();
                        }
                    }
                    return null;
                }
            },

            'www.reddit.com': {
                /**
                 * Finds the recipient on Reddit.
                 * @param {HTMLElement} activeElement - The currently focused element.
                 * @returns {string|null} The recipient's name or null if not found.
                 */
                find: (activeElement) => {
                    if (!activeElement.closest('shreddit-composer')) return null;

                    // Find recipient from a parent comment.
                    const parentComment = activeElement.closest('shreddit-comment');
                    if (parentComment) {
                        return parentComment.getAttribute('author');
                    }

                    // Fallback to finding the main post author.
                    const postElement = document.querySelector('shreddit-post');
                    if (postElement) {
                        return postElement.getAttribute('author');
                    }
                    return null;
                }
            },

            'mail.google.com': {
                /**
                 * Finds the recipient in Gmail.
                 * @param {HTMLElement} activeElement - The currently focused element.
                 * @returns {string|null} The recipient's email or null if not found.
                 */
                find: (activeElement) => {
                    if (!activeElement.closest('div[aria-label="Message Body"]')) return null;

                    // Case 1: In a reply/compose dialog.
                    const composerDialog = activeElement.closest('div[role="dialog"]');
                    if (composerDialog) {
                        const recipientChip = composerDialog.querySelector('span[email]');
                        if (recipientChip) return recipientChip.getAttribute('email');
                    }

                    // Case 2: Replying inline within a message thread.
                    const messageContainer = activeElement.closest('div[role="listitem"]');
                    if (messageContainer) {
                        const senderChip = messageContainer.querySelector('span[email]');
                        if (senderChip) return senderChip.getAttribute('email');
                    }
                    return null;
                }
            }
        },

        /**
         * ==================================================================
         * --- TIER 1: THE CORE LOGIC & RECIPE BOOK ---
         * Executes the site-specific recipe if one exists.
         * ==================================================================
         * @param {HTMLElement} activeElement - The currently focused element.
         * @returns {string|null} The found recipient or null.
         */
        findRecipientFromDOM(activeElement) {
            try {
                const hostname = window.location.hostname;
                const recipe = this.SITE_RECIPES[hostname];

                if (recipe && typeof recipe.find === 'function') {
                    console.log(`Executing Tier 1 Recipe for: ${hostname}`);
                    const recipient = recipe.find(activeElement);
                    if (recipient) {
                        console.log("Tier 1 Recipe success! Found:", recipient);
                        return recipient;
                    }
                }

                // Fallback to Tier 2 if no recipe exists or if the recipe fails.
                return this.findRecipientHeuristically(activeElement);

            } catch (e) {
                console.error('Recipient Finder DOM Error:', e);
                return null;
            }
        },

        /**
         * ==================================================================
         * --- TIER 2: THE IN-DEPTH HEURISTIC ENGINE ---
         * A powerful, multi-step fallback for any site NOT in the recipe book.
         * ==================================================================
         * @param {HTMLElement} activeElement - The currently focused element.
         * @returns {string|null} The found recipient or null.
         */
        findRecipientHeuristically(activeElement) {
            console.log("Tier 1 failed or unsupported site. Executing In-Depth Heuristic Search...");
            try {
                // Heuristic is more reliable when we search from the parent of the input area
                const parentContainer = activeElement.closest('[role="article"], article, .comment, .post, form');
                if (!parentContainer) return null;

                // Heuristic #1: Check for an ARIA Label (e.g., "Reply to John Doe").
                const replyToAction = parentContainer.querySelector('[aria-label*="Reply to"], [aria-label*="reply to"]');
                if (replyToAction?.getAttribute('aria-label')) {
                    const match = replyToAction.getAttribute('aria-label').match(/Reply to @?([\w\s.-]+)/i);
                    if (match && match[1]) return match[1];
                }

                // Heuristic #2: Look for `data-testid` attributes used in testing frameworks.
                const userTestId = parentContainer.querySelector('[data-testid="User-Name"], [data-testid*="author"]');
                if (userTestId?.innerText.trim()) {
                    return userTestId.innerText.trim().replace(/^@/, '');
                }

                // Heuristic #3: Find a profile link within a designated header area.
                const header = parentContainer.querySelector('header');
                const searchArea = header || parentContainer;
                const profileLink = searchArea.querySelector('a[href*="/"][role="link"]:not(:has(time))');
                if (profileLink?.innerText.trim()) {
                    return profileLink.innerText.trim().split('\n')[0].replace(/^@/, '');
                }

                console.log("Heuristic failed: All patterns were exhausted.");
                return null;

            } catch (e) {
                console.error('Heuristic Finder Error:', e);
                return null;
            }
        }
    };

    // Expose the main object to the window to prevent re-injection and allow for potential debugging.
    window.recipientFinder = RecipientFinder;
    console.log('Advanced Tiered Recipient Finder script is active.');
}