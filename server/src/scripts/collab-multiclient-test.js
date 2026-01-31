/* eslint-disable no-console */
const assert = require('assert');
const { io } = require('socket.io-client');

const SERVER = process.env.SERVER_URL || 'http://localhost:8000';
const API = `${SERVER}/api`;

function pickSetCookie(headers) {
  const raw = headers.get('set-cookie');
  if (!raw) return null;
  // We only care about the sid cookie value.
  // raw looks like: sid=...; Path=/; HttpOnly; SameSite=Lax
  const sidPair = raw.split(';')[0];
  if (!sidPair.startsWith('sid=')) return sidPair;
  return sidPair;
}

async function loginAndGetCookie({ email, password }) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const msg = json?.error || `login failed (${res.status})`;
    throw new Error(msg);
  }

  const cookie = pickSetCookie(res.headers);
  if (!cookie) throw new Error('login did not return Set-Cookie');
  return cookie;
}

async function apiJson(path, { method = 'GET', cookie, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);
  return { res, data };
}

function connectClient({ cookie, name }) {
  const socket = io(SERVER, {
    transports: ['websocket'],
    withCredentials: true,
    extraHeaders: {
      Cookie: cookie,
      'x-test-client': name,
    },
  });

  return new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error(`${name} connect timeout`)), 8000);

    socket.on('connect', () => {
      clearTimeout(to);
      resolve(socket);
    });

    socket.on('connect_error', (err) => {
      clearTimeout(to);
      reject(err);
    });
  });
}

function waitFor(socket, event, { timeoutMs = 8000, filter } = {}) {
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);

    function handler(payload) {
      try {
        if (filter && !filter(payload)) return;
        clearTimeout(to);
        socket.off(event, handler);
        resolve(payload);
      } catch (e) {
        clearTimeout(to);
        socket.off(event, handler);
        reject(e);
      }
    }

    socket.on(event, handler);
  });
}

async function emitEditAndWaitAck(socket, { documentId, json, baseVersion }) {
  socket.emit('doc:edit', { documentId, json, baseVersion });

  const ack = await Promise.race([
    waitFor(socket, 'doc:ack', { timeoutMs: 8000, filter: (p) => p?.documentId === documentId }),
    waitFor(socket, 'doc:reject', { timeoutMs: 8000 }),
    waitFor(socket, 'doc:error', { timeoutMs: 8000 }),
  ]);

  if (ack?.reason === 'stale') {
    const err = new Error('stale');
    err.code = 'STALE';
    err.current = ack.current;
    throw err;
  }

  if (ack?.message) {
    throw new Error(ack.message);
  }

  // doc:ack payload
  return ack;
}

async function main() {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;

  if (!email || !password) {
    console.error('Missing TEST_EMAIL / TEST_PASSWORD env vars');
    process.exit(1);
  }

  const cookie = await loginAndGetCookie({ email, password });

  // Create a new document (authoritative source-of-truth)
  const created = await apiJson('/documents', {
    method: 'POST',
    cookie,
    body: { title: `Socket Test ${Date.now()}` },
  });
  assert.strictEqual(created.res.status, 201);
  const documentId = created.data?._id;
  assert.ok(documentId, 'created doc should have _id');

  const a = await connectClient({ cookie, name: 'A' });
  const b = await connectClient({ cookie, name: 'B' });
  const c = await connectClient({ cookie, name: 'C' });

  try {
    a.emit('join-document', { documentId });
    b.emit('join-document', { documentId });
    c.emit('join-document', { documentId });

    await Promise.all([
      waitFor(a, 'doc:init', { filter: (p) => p?.documentId === documentId }),
      waitFor(b, 'doc:init', { filter: (p) => p?.documentId === documentId }),
      waitFor(c, 'doc:init', { filter: (p) => p?.documentId === documentId }),
    ]);

    // Sequential edits
    const json1 = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one' }] }] };
    const ack1 = await emitEditAndWaitAck(a, { documentId, json: json1, baseVersion: 1 });
    assert.strictEqual(ack1.version, 2);

    const updateOnB = await waitFor(b, 'doc:update', { filter: (p) => p?.version === 2 });
    assert.strictEqual(updateOnB.version, 2);

    const json2 = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'two' }] }] };
    const ack2 = await emitEditAndWaitAck(b, { documentId, json: json2, baseVersion: 2 });
    assert.strictEqual(ack2.version, 3);

    // Concurrent edits (one should win, one should get stale)
    const json3a = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'three-A' }] }] };
    const json3c = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'three-C' }] }] };

    const pA = emitEditAndWaitAck(a, { documentId, json: json3a, baseVersion: 3 });
    const pC = emitEditAndWaitAck(c, { documentId, json: json3c, baseVersion: 3 });

    const results = await Promise.allSettled([pA, pC]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    assert.strictEqual(fulfilled.length, 1, 'expected exactly one concurrent edit to be accepted');
    assert.strictEqual(rejected.length, 1, 'expected exactly one concurrent edit to be rejected');

    const finalAck = fulfilled[0].value;
    assert.strictEqual(finalAck.version, 4);

    // Validate DB is authoritative and matches final ack
    const fetched = await apiJson(`/documents/${documentId}`, { cookie });
    assert.strictEqual(fetched.res.status, 200);

    assert.strictEqual(fetched.data.version, 4);
    assert.deepStrictEqual(fetched.data.data, finalAck.data);

    console.log('OK: multi-client collaboration test passed', {
      documentId,
      finalVersion: fetched.data.version,
    });
  } finally {
    try { a.disconnect(); } catch { /* ignore */ }
    try { b.disconnect(); } catch { /* ignore */ }
    try { c.disconnect(); } catch { /* ignore */ }
  }
}

main().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});
