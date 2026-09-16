const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../supabase/functions/product-images/index.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const user = '11111111-1111-4111-8111-111111111111';
// Minimal RIFF/WebP header for the endpoint's signature validation.
const photo = Buffer.from('RIFF\x04\x00\x00\x00WEBP', 'binary');

function harness(denial, options = {}) {
  let handler;
  const calls = [], uploads = [], lookups = [], logs = [], updates = [];
  let state = { image_status: null, image_reviewed_at: null, image_reviewed_by: null };
  if(options.approve) state = { ...state, image_status: 'pending', image_path: `product-corrections/${user}/1234567890123/image.webp` };
  const ticket = '2026-09-13T12:00:00.123456Z';
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: user } } }) },
    from: () => ({
      filters: [], patch: null,
      select() { return this; }, eq(key, value) { this.filters.push([key, value]); return this; },
      maybeSingle: async () => ({ data: options.approve ? { user_id: user } : null }),
      single: async () => ({ data: { ...state } }),
      update(patch) { this.patch = patch; return this; },
      then(resolve) {
        updates.push({ patch: this.patch, filters: this.filters });
        if (!options.restoreError) Object.assign(state, this.patch);
        resolve({ error: options.restoreError });
      },
    }),
    rpc: async (name, args) => {
      calls.push({ name, args });
      if (name === 'begin_product_image_action') {
        if (denial) return { error: { message: denial } };
        const previous = { ...state };
        state = { ...state, image_status: 'pending', image_reviewed_by: user, image_reviewed_at: ticket };
        return { data: { ticket, previous } };
      }
      assert.equal(name, 'finish_product_image_action');
      if (options.finishError && !options.commitBeforeError) return { error: options.finishError };
      state = { image_status: 'pending', image_reviewed_at: null, image_reviewed_by: null, image_path: 'saved-image' };
      if(options.approve) state.image_status = 'approved';
      if (options.finishError) return { error: options.finishError };
      return { data: null };
    },
  };
  class Command { constructor(input) { this.input = input; } }
  vm.runInNewContext(compiled, {
    exports: {}, Response, URL, Uint8Array, TextDecoder, AbortSignal, TransformStream,
    console: { error: entry => logs.push(JSON.parse(entry)), info: entry => logs.push(JSON.parse(entry)) },
    Deno: { env: { get: name => `secret-${name}` }, serve: fn => { handler = fn; } },
    fetch: async url => { lookups.push(url); throw new Error('External lookup unavailable'); },
    require: name => {
      if (name.includes('supabase-js')) return { createClient: () => db };
      if (name.includes('client-s3')) return {
        S3Client: class {
          constructor(config) {
            assert.equal(config.requestChecksumCalculation, 'WHEN_REQUIRED');
            assert.equal(config.responseChecksumValidation, 'WHEN_REQUIRED');
          }
          async send(command) {
          uploads.push(command.input);
          if(command.constructor.name === 'GetObjectCommand') return { Body: options.body(), $metadata: { httpStatusCode: 200 } };
          const failure = command.constructor.name === 'PutObjectCommand' ? options.putError : options.deleteError;
          if (failure) throw failure;
          return { $metadata: { httpStatusCode: 200 } };
        } },
        PutObjectCommand: class PutObjectCommand extends Command {},
        GetObjectCommand: class GetObjectCommand extends Command {},
        DeleteObjectCommand: class DeleteObjectCommand extends Command {},
      };
      if (name.includes('s3-request-presigner')) return { getSignedUrl: async () => 'unused' };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return { calls, uploads, lookups, logs, updates, state: () => state, submit: (body = photo, authenticated = true) => handler(new Request(
    `https://example.test/product-images?action=${options.approve ? 'approve' : 'upload'}&barcode=1234567890123&userId=${user}`,
    { method: 'POST', headers: { 'content-type': 'image/webp', ...(authenticated ? { authorization: 'Bearer test' } : {}) }, body },
  )) };
}

test('uploads and finalizes a private photo without contacting OFF', async () => {
  const h = harness();
  const result = await h.submit();
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { success: true });
  assert.equal(h.lookups.length, 0);
  assert.deepEqual(h.calls.map(c => c.name), ['begin_product_image_action', 'finish_product_image_action']);
  assert.equal(h.calls[0].args.p_user, user);
  assert.equal(h.calls[1].args.p_action, 'upload');
  assert.equal(h.uploads.length, 1);
  assert.equal(h.uploads[0].Bucket, 'foodworth-private-images');
  assert.equal(h.uploads[0].Key, `product-corrections/${user}/1234567890123/image.webp`);
  assert.deepEqual(Buffer.from(h.uploads[0].Body), photo);
});

test('approval uses Web streams instead of the failing SDK byte converter, including SDK fallback', async () => {
  for(const fallback of [false, true]) {
    const h = harness(null, { approve: true, body: () => {
      const stream = new ReadableStream({ start(controller) { controller.enqueue(photo); controller.close(); } });
      const body = fallback ? { transformToWebStream: () => stream } : stream;
      body.transformToByteArray = () => { throw Object.assign(new RangeError('Received -754728320'), { code: 'ERR_OUT_OF_RANGE' }); };
      return body;
    } });
    assert.equal((await h.submit()).status, 200);
    assert.equal(h.state().image_status, 'approved');
    assert.equal(h.uploads.length, 3); // GET private, PUT public, DELETE private.
    assert.equal(h.uploads[1].Bucket, 'foodworth-public-images');
    assert.equal(h.uploads[1].Key, 'products/1234567890123/image.webp');
    assert.deepEqual(Buffer.from(h.uploads[1].Body), photo);
    assert.equal(h.uploads[2].Bucket, 'foodworth-private-images');
    assert.equal(h.calls[1].args.p_action, 'approve');
  }
});

test('failed, oversized and non-WebP approval reads release the reservation without publishing', async () => {
  for(const kind of ['checksum-error', 'oversize', 'invalid']) {
    const h = harness(null, { approve: true, body: () => new ReadableStream({ start(controller) {
      if(kind === 'checksum-error') {
        controller.error(Object.assign(new RangeError('Received -754728320'), { code: 'ERR_OUT_OF_RANGE' }));
      } else {
        controller.enqueue(kind === 'oversize' ? new Uint8Array(2 * 1024 * 1024 + 1) : new Uint8Array(12));
        controller.close();
      }
    } }) });
    assert.equal((await h.submit()).status, 500);
    assert.equal(h.state().image_status, 'pending');
    assert.equal(h.state().image_reviewed_by, null);
    assert.equal(h.state().image_reviewed_at, null);
    assert.equal(h.uploads.length, 1);
    assert.equal(h.calls.length, 1);
  }
});

test('R2 upload and cleanup denial still release the database reservation', async () => {
  const error = { name: 'AccessDenied', message: 'Access denied', $metadata: { httpStatusCode: 403 } };
  const h = harness(null, { putError: error, deleteError: error });
  assert.equal((await h.submit()).status, 500);
  assert.equal(h.state().image_status, null);
  assert.equal(h.state().image_reviewed_by, null);
  assert.equal(h.state().image_reviewed_at, null);
  assert.equal(h.calls.length, 1); // Never finalized a failed upload.
  assert.ok(h.updates[0].filters.some(([key, value]) => key === 'image_reviewed_at' && value.endsWith('.123456Z')));
  assert.ok(h.logs.some(l => l.operation === 'PutObject' && l.code === 'AccessDenied' && l.http_status === 403));
  assert.ok(h.logs.some(l => l.operation === 'RollbackDeleteObject' && l.code === 'AccessDenied'));
});

test('database finalization failure releases reservation; a committed upload is preserved', async () => {
  for (const committed of [false, true]) {
    const h = harness(null, { finishError: { code: '08006', message: 'Connection lost' }, commitBeforeError: committed });
    assert.equal((await h.submit()).status, 500);
    assert.equal(h.state().image_status, committed ? 'pending' : null);
    assert.equal(h.updates.length, committed ? 0 : 1);
    assert.equal(h.uploads.length, committed ? 1 : 2);
    assert.ok(h.logs.some(l => l.operation === 'finish_product_image_action' && l.code === '08006'));
  }
});

test('logs database recovery errors and redacts sensitive fields from provider messages', async () => {
  const h = harness(null, {
    putError: { name: 'SignatureDoesNotMatch', message: 'secret-R2_ACCESS_KEY_ID secret-R2_SECRET_ACCESS_KEY https://example.test/?X-Amz-Signature=hidden Bearer hidden-token',
      $metadata: { httpStatusCode: 403 }, $response: { headers: { authorization: 'never-log-this' } } },
    restoreError: { code: '42501', message: 'Database permission denied' },
  });
  assert.equal((await h.submit()).status, 500);
  assert.ok(h.logs.some(l => l.operation === 'rollback_restore' && l.code === '42501'));
  const output = JSON.stringify(h.logs);
  for (const secret of ['secret-R2_ACCESS_KEY_ID', 'secret-R2_SECRET_ACCESS_KEY', 'https://', 'hidden-token', 'never-log-this']) assert.ok(!output.includes(secret));
  assert.ok(output.includes('SignatureDoesNotMatch'));
});

test('database denial prevents R2 upload', async () => {
  const h = harness('A photo is already pending.');
  assert.equal((await h.submit()).status, 409);
  assert.equal(h.uploads.length, 0);
  assert.equal(h.calls.length, 1);
});

test('authentication and WebP size/signature checks still reject invalid uploads', async () => {
  for (const [body, authenticated, status] of [
    [photo, false, 401], [Buffer.from('invalid photo'), true, 400],
    [Buffer.alloc(2 * 1024 * 1024 + 1), true, 413],
  ]) {
    const h = harness();
    assert.equal((await h.submit(body, authenticated)).status, status);
    assert.equal(h.uploads.length, 0);
    assert.equal(h.calls.length, 0);
  }
});
