import 'dotenv/config';
import { createOpenAI } from '@ai-sdk/openai';

const apiKey = process.env.BIFROST_API_KEY || '';
const rawBaseURL = process.env.BIFROST_BASE_URL || 'https://bifrost.hcm-lab.id/v1';
const baseURL = rawBaseURL.replace(/\/chat\/completions\/?$/, '').replace(/\/+$/, '');

if (!apiKey) {
  console.warn(
    '[Bifrost Security Warning] BIFROST_API_KEY tidak terdeteksi di environment (.env). Pastikan kunci API telah dikonfigurasi.'
  );
}

export const bifrostProvider = createOpenAI({
  baseURL,
  apiKey,
  headers: {
    'x-api-key': apiKey,
  },
});

// Model Medis Spesialis (MedGemma) - Menggunakan endpoint .chat (/v1/chat/completions)
export const medGemmaModel = bifrostProvider.chat('llama.cpp/medgemma-1.5-4b-it-q4') as any;

// Model Penalaran Umum (Gemma 12B) - Menggunakan endpoint .chat (/v1/chat/completions)
export const gemmaModel = bifrostProvider.chat('llama.cpp/gemma-4-12b-it-q8') as any;
