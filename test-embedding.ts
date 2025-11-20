#!/usr/bin/env node
/**
 * Test script to generate embedding for "SAP" using Ollama
 * Run with: tsx test-embedding.ts
 */

import { Ollama } from 'ollama';

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const TEST_TEXT = 'SAP';

// Try installed embedding models (check ollama list output)
const EMBEDDING_MODELS = [
  'nomic-embed-text',
  'hf.co/Mungert/all-MiniLM-L6-v2-GGUF',
];

async function testEmbedding() {
  console.log('=== Embedding Model Test Script ===\n');
  console.log(`Ollama Host: ${OLLAMA_HOST}`);
  console.log(`Test Text: "${TEST_TEXT}"`);
  console.log('');

  const client = new Ollama({ host: OLLAMA_HOST });

  // Test 1: Check if Ollama is available
  console.log('1. Checking if Ollama is available...');
  try {
    const models = await client.list();
    console.log(`   ✓ Ollama is available (${models.models.length} models installed)`);
  } catch (error) {
    console.error(`   ✗ Ollama is not available: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  // Test 2: Get available models
  console.log('\n2. Getting available embedding models...');
  let availableModels: string[];
  try {
    const models = await client.list();
    availableModels = models.models.map(m => m.name.split(':')[0]);
    console.log(`   ✓ Found ${models.models.length} models`);
  } catch (error) {
    console.error(`   ✗ Failed to get models: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  // Test 3: Try each embedding model
  console.log('\n3. Testing embedding models...\n');

  let successfulModel: string | null = null;

  for (const modelName of EMBEDDING_MODELS) {
    console.log(`   Testing: ${modelName}`);

    if (!availableModels.includes(modelName)) {
      console.log(`   ⊘ Model not installed (skipping)`);
      continue;
    }

    const startTime = Date.now();

    try {
      // Add 10 second timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout after 10 seconds')), 10000);
      });

      const embeddingPromise = client.embeddings({
        model: modelName,
        prompt: TEST_TEXT,
      });

      const response = await Promise.race([embeddingPromise, timeoutPromise]);
      const elapsed = Date.now() - startTime;

      console.log(`   ✓ SUCCESS in ${elapsed}ms`);
      console.log(`     - Dimensions: ${response.embedding.length}`);
      console.log(`     - Sample: [${response.embedding.slice(0, 3).map(v => v.toFixed(4)).join(', ')}...]`);

      successfulModel = modelName;
      break; // Found a working model

    } catch (error) {
      const elapsed = Date.now() - startTime;
      console.log(`   ✗ FAILED in ${elapsed}ms: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log('');
  }

  if (successfulModel) {
    console.log(`\n=== Recommendation: Use "${successfulModel}" ===\n`);
  } else {
    console.log(`\n=== No working embedding model found ===`);
    console.log(`Try: ollama pull all-minilm\n`);
    process.exit(1);
  }
}

testEmbedding().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
