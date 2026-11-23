import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import mockOnnx from '../mocks/mock-onnx.json';

export const runOnnxVisionTool = createTool({
  id: 'run_onnx_vision_inference',
  description:
    'Menjalankan inferensi model AI Vision ONNX untuk mendeteksi penyakit atau kelainan radiologis pada citra medis (X-Ray / CT Scan). Mendukung deteksi Tuberkulosis paru (TBC), Stroke perdarahan intrakranial, serta skrining toraks umum.',
  inputSchema: z.object({
    studyId: z
      .string()
      .trim()
      .regex(
        /^[A-Za-z0-9_-]{1,64}$/,
        'Format Study ID tidak valid. Hanya karakter alfanumerik, garis bawah (_), dan tanda hubung (-) yang diperbolehkan.'
      )
      .describe(
        'ID Study pemeriksaan yang akan dianalisis citranya (contoh: STUDY_TB_001, STUDY_STROKE_002, STUDY_NORMAL_003)'
      ),
    modality: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{1,16}$/, 'Format modalitas tidak valid.')
      .optional()
      .describe('Modalitas citra medis (misal: DX untuk X-Ray, CT untuk CT Scan)'),
    bodyPart: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{1,32}$/, 'Format bagian tubuh tidak valid.')
      .optional()
      .describe('Bagian tubuh yang diperiksa (misal: CHEST, HEAD)'),
  }),
  outputSchema: z.object({
    source: z.string(),
    success: z.boolean(),
    data: z
      .object({
        studyId: z.string(),
        modelUsed: z.string(),
        modality: z.string().optional(),
        prediction: z.string(),
        confidence: z.number(),
        findings: z.array(
          z.object({
            finding: z.string(),
            severity: z.string(),
            probability: z.number(),
          })
        ),
        recommendationAlert: z.string().optional(),
      })
      .optional(),
    message: z.string().optional(),
  }),
  execute: async ({ studyId, modality, bodyPart }) => {
    const rawUrl = process.env.ONNX_SERVICE_URL || 'http://127.0.0.1:5000';
    const onnxServiceUrl = rawUrl.replace(/\/+$/, '');

    // Smart Switch: Coba hubungi service Python ONNX di vismed-PACS jika sedang menyala
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200); // 1.2 detik timeout

      let healthOk = false;
      try {
        const healthRes = await fetch(`${onnxServiceUrl}/health`, {
          signal: controller.signal,
        });
        healthOk = healthRes.ok;
      } finally {
        clearTimeout(timeoutId);
      }

      if (healthOk) {
        // Service nyata aktif, kirim request prediksi dengan timeout 8 detik
        const predictController = new AbortController();
        const predictTimeoutId = setTimeout(() => predictController.abort(), 8000);

        try {
          const predictRes = await fetch(`${onnxServiceUrl}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studyId, modality, bodyPart }),
            signal: predictController.signal,
          });

          if (predictRes.ok) {
            const liveResult = (await predictRes.json()) as any;
            return {
              source: 'live_onnx_service',
              success: true,
              data: liveResult,
            };
          }
        } finally {
          clearTimeout(predictTimeoutId);
        }
      }
    } catch {
      // Jika service Python lokal sedang tidak aktif / timeout, otomatis fallback ke data mock
    }

    // Fallback aman ke data mock (mencegah prototype pollution)
    if (!Object.prototype.hasOwnProperty.call(mockOnnx, studyId)) {
      return {
        source: 'mock_data',
        success: false,
        message: `Hasil analisis ONNX untuk Study ID "${studyId}" tidak ditemukan. Disarankan evaluasi radiologis manual oleh dokter spesialis.`,
      };
    }

    const mockResult = (mockOnnx as Record<string, any>)[studyId];

    return {
      source: 'mock_data',
      success: true,
      data: mockResult,
    };
  },
});
