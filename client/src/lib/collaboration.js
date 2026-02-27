// client/src/lib/collaboration.js
// Y.js document + WebSocket provider factory for collaborative editing
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

/** Distinct high-contrast colors for collaboration cursors */
const CURSOR_COLORS = [
    '#ef4444', '#f97316', '#eab308', '#22c55e',
    '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
    '#14b8a6', '#f59e0b', '#6366f1', '#d946ef',
];

/**
 * Generate a consistent color for a user based on their ID.
 * Same user always gets the same color.
 */
export function generateUserColor(userId) {
    if (!userId) return CURSOR_COLORS[0];
    const hash = String(userId)
        .split('')
        .reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return CURSOR_COLORS[hash % CURSOR_COLORS.length];
}

/**
 * Build the Y.js WebSocket URL.
 * Uses the backend server URL instead of window.location, which is crucial
 * because frontend and backend deployed on Render have different domains.
 */
function getWsUrl() {
    // 1. Check for specific Yjs override
    if (import.meta.env.VITE_YJS_WS_URL) return import.meta.env.VITE_YJS_WS_URL;

    // 2. Read the backend API URL (same one used by Axios and Socket.IO)
    const serverUrl = import.meta.env.VITE_REACT_APP_SERVER_URL || 'http://localhost:8000';

    // 3. Convert http:// to ws:// and https:// to wss://
    let wsUrl = serverUrl.replace(/^http:\/\//i, 'ws://').replace(/^https:\/\//i, 'wss://');

    // Remove trailing slash if present
    if (wsUrl.endsWith('/')) {
        wsUrl = wsUrl.slice(0, -1);
    }

    // 4. Append the /yjs path
    const finalUrl = `${wsUrl}/yjs`;

    console.log('[yjs] Target WebSocket URL:', finalUrl);
    return finalUrl;
}

/**
 * Create a Y.js collaboration session for a specific document.
 *
 * @param {string} documentId  — MongoDB document ID (becomes the Y.js room name)
 * @param {{ id: string, name: string, email: string }} user — current user
 * @returns {{ ydoc, provider, userInfo, destroy }}
 */
export function createCollaboration(documentId, user) {
    const ydoc = new Y.Doc();
    const wsUrl = getWsUrl();
    const userId = user?.id || user?._id;

    const provider = new WebsocketProvider(wsUrl, documentId, ydoc, {
        connect: true,
        resyncInterval: 3000,
    });

    const userInfo = {
        name: user?.name || user?.email || 'Anonymous',
        color: generateUserColor(userId),
        id: userId,
    };

    // Set this user's awareness state (visible to other clients' cursors)
    provider.awareness.setLocalStateField('user', userInfo);

    return {
        ydoc,
        provider,
        userInfo,
        /** Clean up everything when the editor unmounts */
        destroy() {
            provider.awareness.setLocalState(null);
            provider.disconnect();
            provider.destroy();
            ydoc.destroy();
        },
    };
}
