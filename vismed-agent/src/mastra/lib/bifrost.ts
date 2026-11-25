import 'dotenv/config';
import { createOpenAI } from '@ai-sdk/openai';

const apiKey = (process.env.BIFROST_API_KEY || '').trim();
const rawBaseURL = (process.env.BIFROST_BASE_URL || '').trim();
const baseURL = rawBaseURL
  .replace(/\/chat\/completions\/?$/, '')
  .replace(/\/+$/, '');

export const chatModelId =
  (process.env.BIFROST_CHAT_MODEL || '').trim() || 'llama.cpp/medgemma-1.5-4b-it-q4';
export const fallbackModelId =
  (process.env.BIFROST_FALLBACK_MODEL || '').trim() || 'llama.cpp/gemma-4-12b-it-q8';
export const embeddingModelId =
  (process.env.BIFROST_EMBEDDING_MODEL || '').trim() ||
  'ollama/snowflake-arctic-embed2:latest';

if (!baseURL) {
  console.warn(
    '[Bifrost Security Warning] BIFROST_BASE_URL tidak terdeteksi di environment (.env). Pastikan URL gateway lokal telah dikonfigurasi.'
  );
}

if (!apiKey) {
  console.warn(
    '[Bifrost Security Warning] BIFROST_API_KEY tidak terdeteksi di environment (.env). Pastikan kunci API telah dikonfigurasi.'
  );
}

const failClosedFetch: typeof fetch = async (input, init) => {
  if (!baseURL) {
    throw new Error(
      'BIFROST_BASE_URL belum dikonfigurasi di environment (.env). Permintaan LLM diblokir untuk mencegah kebocoran data.'
    );
  }
  return fetch(input, init);
};

export const bifrostProvider = createOpenAI({
  baseURL: baseURL || 'http://127.0.0.1:0/v1',
  apiKey,
  headers: {
    'x-api-key': apiKey,
  },
  fetch: failClosedFetch,
});

// Model Medis Spesialis (MedGemma) - Menggunakan endpoint .chat (/v1/chat/completions)
export const medGemmaModel = bifrostProvider.chat(chatModelId) as any;

// Model Penalaran Umum (Fallback) - Menggunakan endpoint .chat (/v1/chat/completions)
export const gemmaModel = bifrostProvider.chat(fallbackModelId) as any;

// Model Embedding (RAG) - Menggunakan endpoint .embedding (/v1/embeddings)
export const embeddingModel = bifrostProvider.embedding(embeddingModelId);
