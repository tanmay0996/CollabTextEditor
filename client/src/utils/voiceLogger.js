// client/src/utils/voiceLogger.js
const PREFIX = '[voice]';

function isEnabled() {
    try {
        if (import.meta.env.DEV) return true;
        return localStorage.getItem('DEBUG_VOICE') === '1';
    } catch {
        return false;
    }
}

function fmt(label, data) {
    if (data !== undefined) return [`${PREFIX} ${label}`, data];
    return [`${PREFIX} ${label}`];
}

export const voiceLogger = {
    debug(label, data) {
        if (!isEnabled()) return;
        console.debug(...fmt(label, data));
    },
    info(label, data) {
        if (!isEnabled()) return;
        console.info(...fmt(label, data));
    },
    warn(label, data) {
        if (!isEnabled()) return;
        console.warn(...fmt(label, data));
    },
    error(label, data) {
        // errors always log
        console.error(...fmt(label, data));
    },
    group(label) {
        if (!isEnabled()) return false;
        console.groupCollapsed(`${PREFIX} ${label}`);
        return true;
    },
    groupEnd() {
        if (!isEnabled()) return;
        console.groupEnd();
    },
};
