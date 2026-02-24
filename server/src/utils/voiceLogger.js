// server/src/utils/voiceLogger.js
const PREFIX = '[voice]';

function isEnabled() {
    return process.env.DEBUG_VOICE === '1';
}

function fmt(label, data) {
    if (data !== undefined) return [`${PREFIX} ${label}`, data];
    return [`${PREFIX} ${label}`];
}

const voiceLogger = {
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
};

// Boot-time notice
if (isEnabled()) {
    console.info('[voice] debug logging enabled');
}

module.exports = { voiceLogger };
