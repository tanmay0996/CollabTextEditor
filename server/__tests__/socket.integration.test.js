const { createServer } = require('../src/createServer');
const ioClient = require('socket.io-client');

// resolves when the socket fires `event`, rejects after timeout
function waitForEvent(socket, event, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Timed out waiting for "${event}" after ${timeoutMs}ms`));
        }, timeoutMs);

        socket.once(event, (data) => {
            clearTimeout(timer);
            resolve(data);
        });
    });
}

// returns a fully-connected client socket
function createConnectedClient(port) {
    return new Promise((resolve, reject) => {
        const socket = ioClient(`http://localhost:${port}`, {
            transports: ['websocket'],  // no polling
            reconnection: false,
        });

        socket.on('connect', () => resolve(socket));
        socket.on('connect_error', (err) => {
            reject(new Error(`Client failed to connect: ${err.message}`));
        });
    });
}

describe('Socket.IO – Multi-User Sync', () => {
    let httpServer, io, clientA, clientB, port;

    beforeAll(async () => {
        const created = createServer({ skipAuth: true });
        httpServer = created.server;
        io = created.io;

        // port 0 → OS picks a random free port
        await new Promise((resolve) => {
            httpServer.listen(0, () => {
                port = httpServer.address().port;
                resolve();
            });
        });

        clientA = await createConnectedClient(port);
        clientB = await createConnectedClient(port);
    });

    afterAll(async () => {
        if (clientA?.connected) clientA.disconnect();
        if (clientB?.connected) clientB.disconnect();
        if (io) await new Promise((resolve) => io.close(resolve));
        if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
    });

    test('both clients connect successfully', () => {
        expect(clientA.connected).toBe(true);
        expect(clientB.connected).toBe(true);
    });

    test('both clients join the same document room', async () => {
        const DOCUMENT_ID = 'test-doc-001';

        // listen BEFORE emitting to avoid race conditions
        const joinAckA = waitForEvent(clientA, 'join-ack');
        const joinAckB = waitForEvent(clientB, 'join-ack');

        clientA.emit('join-document', { documentId: DOCUMENT_ID });
        clientB.emit('join-document', { documentId: DOCUMENT_ID });

        const [ackA, ackB] = await Promise.all([joinAckA, joinAckB]);

        expect(ackA).toEqual({ documentId: DOCUMENT_ID, room: `doc:${DOCUMENT_ID}` });
        expect(ackB).toEqual({ documentId: DOCUMENT_ID, room: `doc:${DOCUMENT_ID}` });
    });

    test('Client B receives remote-text-change when Client A emits text-change', async () => {
        const DOCUMENT_ID = 'test-doc-001';
        const DELTA = {
            ops: [
                { retain: 5 },
                { insert: 'Hello, collaborator!' },
                { delete: 3 },
            ],
        };

        const remoteChangePromise = waitForEvent(clientB, 'remote-text-change');
        clientA.emit('text-change', { documentId: DOCUMENT_ID, delta: DELTA });
        const received = await remoteChangePromise;

        expect(received).toEqual({ documentId: DOCUMENT_ID, delta: DELTA });
    });

    test('Client A receives remote-text-change when Client B emits text-change', async () => {
        const DOCUMENT_ID = 'test-doc-001';
        const DELTA = { ops: [{ insert: 'Reverse direction works too!' }] };

        const remoteChangePromise = waitForEvent(clientA, 'remote-text-change');
        clientB.emit('text-change', { documentId: DOCUMENT_ID, delta: DELTA });
        const received = await remoteChangePromise;

        expect(received).toEqual({ documentId: DOCUMENT_ID, delta: DELTA });
    });

    test('emitter does NOT receive its own remote-text-change', async () => {
        const DOCUMENT_ID = 'test-doc-001';
        const DELTA = { ops: [{ insert: 'Only others should see this' }] };

        let selfReceived = false;
        const selfHandler = () => { selfReceived = true; };
        clientA.on('remote-text-change', selfHandler);

        const remoteChangePromise = waitForEvent(clientB, 'remote-text-change');
        clientA.emit('text-change', { documentId: DOCUMENT_ID, delta: DELTA });
        await remoteChangePromise;

        // extra tick – if server accidentally emitted to sender it would fire by now
        await new Promise((resolve) => setImmediate(resolve));
        expect(selfReceived).toBe(false);

        clientA.off('remote-text-change', selfHandler);
    });

    test('changes are isolated to their document room', async () => {
        const DOC_ROOM_2 = 'test-doc-isolated';

        // only Client B joins the second room
        const joinAckB2 = waitForEvent(clientB, 'join-ack');
        clientB.emit('join-document', { documentId: DOC_ROOM_2 });
        await joinAckB2;

        let leakDetected = false;
        const leakHandler = (data) => {
            if (data.documentId === DOC_ROOM_2) leakDetected = true;
        };
        clientA.on('remote-text-change', leakHandler);

        clientB.emit('text-change', {
            documentId: DOC_ROOM_2,
            delta: { ops: [{ insert: 'Isolated content' }] },
        });

        await new Promise((resolve) => setImmediate(resolve));
        expect(leakDetected).toBe(false);

        clientA.off('remote-text-change', leakHandler);
    });

    test('editor-update triggers remote-editor-update on the other client', async () => {
        const DOCUMENT_ID = 'test-doc-001';
        const JSON_PAYLOAD = { type: 'doc', content: [{ type: 'paragraph', children: [{ text: 'Hello' }] }] };
        const BASE_VERSION = 3;

        const remoteUpdatePromise = waitForEvent(clientB, 'remote-editor-update');

        clientA.emit('editor-update', {
            documentId: DOCUMENT_ID,
            json: JSON_PAYLOAD,
            baseVersion: BASE_VERSION,
        });

        const received = await remoteUpdatePromise;

        expect(received.json).toEqual(JSON_PAYLOAD);
        expect(received.from).toBe(clientA.id);
        expect(received.version).toBe(BASE_VERSION + 1);
    });

    test('complex delta payloads are transmitted with full fidelity', async () => {
        const DOCUMENT_ID = 'test-doc-001';
        const COMPLEX_DELTA = {
            ops: [
                { retain: 12 },
                {
                    insert: 'Collaborators 🤝 can edit simultaneously!',
                    attributes: { bold: true, color: '#ff5500', font: 'monospace' },
                },
                { delete: 7 },
                { retain: 100, attributes: { italic: true } },
                {
                    insert: { image: 'data:image/png;base64,iVBORw0KGgo=' },
                    attributes: { width: 320, height: 240, alt: 'Screenshot' },
                },
            ],
        };

        const remoteChangePromise = waitForEvent(clientB, 'remote-text-change');
        clientA.emit('text-change', { documentId: DOCUMENT_ID, delta: COMPLEX_DELTA });
        const received = await remoteChangePromise;

        expect(received.delta).toEqual(COMPLEX_DELTA);
    });
});
