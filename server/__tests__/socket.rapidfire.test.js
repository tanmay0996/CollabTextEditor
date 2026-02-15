const { createServer } = require('../src/createServer');
const ioClient = require('socket.io-client');

const TOTAL_EDITS = 50;
const DOCUMENT_ID = 'rapid-fire-doc';

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

// collects exactly `count` events, rejects if it takes too long
function collectEvents(socket, event, count, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        const received = [];

        const timer = setTimeout(() => {
            socket.off(event, handler);
            reject(new Error(
                `Only received ${received.length}/${count} "${event}" events before ${timeoutMs}ms timeout`
            ));
        }, timeoutMs);

        const handler = (data) => {
            received.push(data);
            if (received.length === count) {
                clearTimeout(timer);
                socket.off(event, handler);
                resolve(received);
            }
        };

        socket.on(event, handler);
    });
}

function createConnectedClient(port) {
    return new Promise((resolve, reject) => {
        const socket = ioClient(`http://localhost:${port}`, {
            transports: ['websocket'],
            reconnection: false,
        });

        socket.on('connect', () => resolve(socket));
        socket.on('connect_error', (err) => {
            reject(new Error(`Client failed to connect: ${err.message}`));
        });
    });
}

describe('Socket.IO – Rapid-Fire Burst Traffic', () => {
    let httpServer, io, clientA, clientB, port;

    beforeAll(async () => {
        const created = createServer({ skipAuth: true });
        httpServer = created.server;
        io = created.io;

        await new Promise((resolve) => {
            httpServer.listen(0, () => {
                port = httpServer.address().port;
                resolve();
            });
        });

        clientA = await createConnectedClient(port);
        clientB = await createConnectedClient(port);

        // both clients join the same room before any test runs
        const joinAckA = waitForEvent(clientA, 'join-ack');
        const joinAckB = waitForEvent(clientB, 'join-ack');
        clientA.emit('join-document', { documentId: DOCUMENT_ID });
        clientB.emit('join-document', { documentId: DOCUMENT_ID });
        await Promise.all([joinAckA, joinAckB]);
    });

    afterAll(async () => {
        if (clientA?.connected) clientA.disconnect();
        if (clientB?.connected) clientB.disconnect();
        if (io) await new Promise((resolve) => io.close(resolve));
        if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
    });

    test(`server delivers all ${TOTAL_EDITS} rapid-fire events without dropping any`, async () => {
        // start collecting BEFORE emitting
        const allReceived = collectEvents(clientB, 'remote-text-change', TOTAL_EDITS);

        // fire all edits in a tight synchronous loop
        for (let i = 0; i < TOTAL_EDITS; i++) {
            clientA.emit('text-change', {
                documentId: DOCUMENT_ID,
                delta: { ops: [{ insert: `edit-${i}` }], seq: i },
            });
        }

        const events = await allReceived;

        expect(events).toHaveLength(TOTAL_EDITS);
    });

    test('every delta payload arrives intact and in order', async () => {
        const allReceived = collectEvents(clientB, 'remote-text-change', TOTAL_EDITS);

        for (let i = 0; i < TOTAL_EDITS; i++) {
            clientA.emit('text-change', {
                documentId: DOCUMENT_ID,
                delta: { ops: [{ insert: `ordered-${i}` }], seq: i },
            });
        }

        const events = await allReceived;

        // verify ordering + payload integrity
        events.forEach((event, i) => {
            expect(event.documentId).toBe(DOCUMENT_ID);
            expect(event.delta.seq).toBe(i);
            expect(event.delta.ops[0].insert).toBe(`ordered-${i}`);
        });
    });

    test('bidirectional burst — both clients fire simultaneously', async () => {
        // A fires to B, B fires to A — both at the same time
        const aReceives = collectEvents(clientA, 'remote-text-change', TOTAL_EDITS);
        const bReceives = collectEvents(clientB, 'remote-text-change', TOTAL_EDITS);

        for (let i = 0; i < TOTAL_EDITS; i++) {
            clientA.emit('text-change', {
                documentId: DOCUMENT_ID,
                delta: { ops: [{ insert: `from-a-${i}` }], seq: i, source: 'A' },
            });
            clientB.emit('text-change', {
                documentId: DOCUMENT_ID,
                delta: { ops: [{ insert: `from-b-${i}` }], seq: i, source: 'B' },
            });
        }

        const [bEvents, aEvents] = await Promise.all([bReceives, aReceives]);

        // B should get all of A's edits
        expect(bEvents).toHaveLength(TOTAL_EDITS);
        bEvents.forEach((e) => expect(e.delta.source).toBe('A'));

        // A should get all of B's edits
        expect(aEvents).toHaveLength(TOTAL_EDITS);
        aEvents.forEach((e) => expect(e.delta.source).toBe('B'));
    });

    test('emitter receives zero of its own events during burst', async () => {
        let selfCount = 0;
        const selfHandler = () => { selfCount++; };
        clientA.on('remote-text-change', selfHandler);

        const bReceives = collectEvents(clientB, 'remote-text-change', TOTAL_EDITS);

        for (let i = 0; i < TOTAL_EDITS; i++) {
            clientA.emit('text-change', {
                documentId: DOCUMENT_ID,
                delta: { ops: [{ insert: `no-echo-${i}` }], seq: i },
            });
        }

        await bReceives;

        // one extra tick to catch any straggler
        await new Promise((resolve) => setImmediate(resolve));
        expect(selfCount).toBe(0);

        clientA.off('remote-text-change', selfHandler);
    });
});
