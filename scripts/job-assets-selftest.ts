import assert from 'node:assert/strict';
import { extractUploadFileId, extractUploadFileIds } from '../lib/uploads/job-assets';

/**
 * Lightweight self-test for the uploads proxy URL parsing helpers.
 *
 * Run manually:
 * - pnpm: `pnpm -s dlx tsx scripts/job-assets-selftest.ts`
 * - npm: `npx tsx scripts/job-assets-selftest.ts`
 */
function run() {
  assert.equal(extractUploadFileId('/api/uploads/123/file?teamId=1&exp=0&sig=x'), 123);
  assert.equal(extractUploadFileId('https://example.com/api/uploads/987/file?sig=x'), 987);
  assert.equal(extractUploadFileId('https://example.com/api/uploads/987/file'), 987);
  assert.equal(extractUploadFileId('/api/uploads/0/file'), null);
  assert.equal(extractUploadFileId('/api/uploads/nope/file'), null);
  assert.equal(extractUploadFileId('/api/other/123/file'), null);

  assert.deepEqual(extractUploadFileIds(['/api/uploads/1/file', '/api/uploads/2/file', '/api/uploads/1/file']), [1, 2]);
}

run();
console.log('job-assets-selftest: OK');


