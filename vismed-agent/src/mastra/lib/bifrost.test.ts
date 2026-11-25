import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  chatModelId,
  embeddingModel,
  embeddingModelId,
  fallbackModelId,
  gemmaModel,
  medGemmaModel,
} from './bifrost';

test('bifrost.ts tidak mengandung hardcoded fallback URL eksternal', () => {
  const bifrostSource = fs.readFileSync(
    path.resolve(import.meta.dirname, 'bifrost.ts'),
    'utf8'
  );

  assert.equal(bifrostSource.includes('hcm-lab.id'), false);
  assert.equal(bifrostSource.includes('api.openai.com'), false);
});

test('bifrost.ts mengekspor model chat, fallback, dan embedding sesuai env', () => {
  assert.ok(chatModelId.length > 0);
  assert.ok(fallbackModelId.length > 0);
  assert.ok(embeddingModelId.length > 0);
  assert.equal(medGemmaModel.modelId, chatModelId);
  assert.equal(gemmaModel.modelId, fallbackModelId);
  assert.equal(embeddingModel.modelId, embeddingModelId);
});
