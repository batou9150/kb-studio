import { test } from 'node:test';
import assert from 'node:assert/strict';
import { batchBelongsToBucket } from './gemini';

test('batchBelongsToBucket scopes batches to the bucket they were started for', () => {
  assert.equal(batchBelongsToBucket('kb-studio-analysis-my-bucket-1730000000000', 'my-bucket'), true);
  assert.equal(batchBelongsToBucket('kb-studio-analysis-my-bucket-1730000000000', 'bucket'), false);
  assert.equal(batchBelongsToBucket('kb-studio-analysis-other-1730000000000', 'my-bucket'), false);
  assert.equal(batchBelongsToBucket('kb-studio-analysis-my-bucket-x-1730000000000', 'my-bucket'), false);
  assert.equal(batchBelongsToBucket('something-else-1730000000000', 'my-bucket'), false);
});

test('batchBelongsToBucket keeps legacy batches (no bucket in name) visible', () => {
  assert.equal(batchBelongsToBucket('kb-studio-analysis-1730000000000', 'my-bucket'), true);
});
