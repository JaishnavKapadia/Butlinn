// core/storage.js
// --- Manages all IndexedDB storage operations for the extension. ---

const DB_NAME = "ButlinnVault";
const STORE_NAME = "files";
const RELATIONSHIPS_STORE_NAME = "relationships";
const DB_VERSION = 2; // <-- INCREMENTED VERSION to trigger upgrade

/**
 * Opens a connection to the IndexedDB database.
 * @returns {Promise<IDBDatabase>} A promise that resolves with the database object.
 */
function openDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        // This event is only triggered for new databases or version changes.
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'name' });
            }
            // --- NEW: Create the relationships store ---
            if (!db.objectStoreNames.contains(RELATIONSHIPS_STORE_NAME)) {
                const relationshipStore = db.createObjectStore(RELATIONSHIPS_STORE_NAME, { keyPath: 'id' });
                // Create an index on 'aliases' to allow searching by any alias.
                // 'multiEntry: true' allows indexing each item in the aliases array.
                relationshipStore.createIndex('aliases', 'aliases', { unique: false, multiEntry: true });
            }
        };

        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

/**
 * Gets an object store from the database with the specified mode.
 * @param {string} storeName - The name of the store to access.
 * @param {IDBTransactionMode} mode - The transaction mode ('readonly' or 'readwrite').
 * @returns {Promise<IDBObjectStore>} A promise that resolves with the object store.
 */
async function getStore(storeName, mode) {
    const db = await openDb();
    return db.transaction(storeName, mode).objectStore(storeName);
}

// --- File Management Functions (Unchanged) ---

export async function addFile(file) {
    const store = await getStore(STORE_NAME, 'readwrite');
    return new Promise((resolve, reject) => {
        const request = store.put(file);
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}

export async function deleteFile(filename) {
    const store = await getStore(STORE_NAME, 'readwrite');
    return new Promise((resolve, reject) => {
        const request = store.delete(filename);
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}

export async function getAllFiles() {
    const store = await getStore(STORE_NAME, 'readonly');
    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = (event) => reject(event.target.error);
    });
}

export async function getFile(filename) {
    const store = await getStore(STORE_NAME, 'readonly');
    return new Promise((resolve, reject) => {
        const request = store.get(filename);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

export async function deleteRelationshipById(personId) {
    const store = await getStore(RELATIONSHIPS_STORE_NAME, 'readwrite');
    return new Promise((resolve, reject) => {
        const request = store.delete(personId);
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}

export async function deleteMultipleRelationships(personIds) {
    const store = await getStore(RELATIONSHIPS_STORE_NAME, 'readwrite');
    // We can just loop, but for performance, a single transaction is better.
    return Promise.all(personIds.map(id => {
        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    }));
}


// --- NEW: Relationship Management Functions ---

/**
 * Adds or updates a relationship in the database.
 * @param {object} person - The person object to save. Must include a unique 'id'.
 * @returns {Promise<void>}
 */
export async function addOrUpdateRelationship(person) {
    const store = await getStore(RELATIONSHIPS_STORE_NAME, 'readwrite');
    return new Promise((resolve, reject) => {
        const request = store.put(person);
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}

/**
 * Retrieves a person object by one of their aliases.
 * @param {string} alias - The alias to search for.
 * @returns {Promise<object|null>} The person object or null if not found.
 */
export async function getRelationshipByAlias(alias) {
    const store = await getStore(RELATIONSHIPS_STORE_NAME, 'readonly');
    const index = store.index('aliases');
    return new Promise((resolve, reject) => {
        const request = index.get(alias);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = (event) => reject(event.target.error);
    });
}

/**
 * Retrieves all relationship objects from the database.
 * @returns {Promise<Array<object>>} An array of all person objects.
 */
export async function getAllRelationships() {
    const store = await getStore(RELATIONSHIPS_STORE_NAME, 'readonly');
    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = (event) => reject(event.target.error);
    });
}