// Production smoke tests — no new dependencies (Node's built-in runner).
// Run with: npm test
// Needs server/.env present (uses MONGODB_URI + Firebase env, like local dev).
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');

let base;
let server;

before(async () => {
  const app = require('../index.js');
  await new Promise((resolve) => {
    server = app.listen(0, resolve); // ephemeral port, never collides
  });
  base = `http://localhost:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await require('../config/db.js').closeDB(); // let the runner exit cleanly
});

describe('liveness', () => {
  it('GET /health returns ok without needing the database', async () => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
  });

  it('GET / returns the service banner', async () => {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /CrowdFundHub server is running/);
  });

  it('unknown routes return JSON 404, not an HTML page', async () => {
    const res = await fetch(`${base}/__nope_xyz`);
    assert.equal(res.status, 404);
    assert.equal(res.headers.get('content-type'), 'application/json; charset=utf-8');
    const body = await res.json();
    assert.equal(body.message, 'Not found');
  });

  it('security headers are set and x-powered-by is hidden', async () => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-powered-by'), null);
  });
});

describe('POST /jwt validation', () => {
  it('rejects a missing body with 400', async () => {
    const res = await fetch(`${base}/jwt`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
  });

  it('rejects a forged token with 401', async () => {
    const res = await fetch(`${base}/jwt`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: 'forged-token' }),
    });
    assert.equal(res.status, 401);
  });
});
