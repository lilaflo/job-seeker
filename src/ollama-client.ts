/**
 * Ollama Client Helper - Centralized Ollama client management
 * Provides a singleton client instance and common utilities
 */

import { Ollama } from 'ollama';

// Configuration
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';

// Singleton instance
let ollamaClient: Ollama | null = null;

/**
 * Gets or creates the Ollama client instance (singleton pattern)
 */
export function getOllamaClient(): Ollama {
  if (!ollamaClient) {
    ollamaClient = new Ollama({ host: OLLAMA_HOST });
  }
  return ollamaClient;
}

/**
 * Resets the Ollama client instance (useful for testing)
 */
export function resetOllamaClient(): void {
  ollamaClient = null;
}

/**
 * Checks if Ollama is available and has models installed
 */
export async function checkOllamaAvailability(): Promise<boolean> {
  try {
    const client = getOllamaClient();
    const response = await client.list();
    return response.models.length > 0;
  } catch (error) {
    console.debug(`Ollama not available: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Gets the best available model for general tasks
 * Preference order: llama3.2, llama3.1, mistral, phi3
 */
export async function getBestModel(): Promise<string> {
  const client = getOllamaClient();
  const response = await client.list();

  // Extract model names (without tags)
  const modelNames = response.models.map(m => m.name.split(':')[0]);

  // Preference order for models
  const preferredModels = ['llama3.2', 'llama3.1', 'mistral', 'phi3'];

  for (const preferred of preferredModels) {
    if (modelNames.includes(preferred)) {
      return preferred;
    }
  }

  // Fallback to first available model
  if (response.models.length > 0) {
    return response.models[0].name.split(':')[0];
  }

  throw new Error('No Ollama models found. Please install a model with: ollama pull llama3.2');
}

/**
 * Checks if a specific model is available
 */
export async function isModelAvailable(modelName: string): Promise<boolean> {
  try {
    const client = getOllamaClient();
    const response = await client.list();
    const modelNames = response.models.map(m => m.name.split(':')[0]);
    return modelNames.includes(modelName);
  } catch (error) {
    console.debug(`Failed to check model availability: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Gets Ollama host configuration
 */
export function getOllamaHost(): string {
  return OLLAMA_HOST;
}
