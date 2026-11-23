import { createStep, Workflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { fetchDicomMetadataTool } from '../tools/dicom-tool';
import { runOnnxVisionTool } from '../tools/onnx-tool';
import { medGemmaModel } from '../lib/bifrost';

// 1. Schema Input Workflow
export const radiologyInputSchema = z.object({
  studyId: z
    .string()
    .trim()
    .regex(
      /^[A-Za-z0-9_-]{1,64}$/,
      'Format Study ID tidak valid. Hanya karakter alfanumerik, garis bawah (_), dan tanda hubung (-) yang diperbolehkan.'
    )
    .describe('ID Study pemeriksaan pasien di PACS (contoh: STUDY_TB_001, STUDY_STROKE_002, STUDY_NORMAL_003)'),
});

// Schema Data Pasien dari DICOM
const dicomDataSchema = z.object({
  studyId: z.string(),
  patientId: z.string(),
  patientName: z.string(),
  patientAge: z.string(),
  patientSex: z.string(),
  modality: z.string(),
  bodyPartExamined: z.string(),
  studyDescription: z.string(),
  studyDate: z.string().optional(),
  clinicalComplaint: z.string(),
  referringPhysician: z.string().optional(),
});

// Schema Hasil Visi AI
const visionDataSchema = z.object({
  source: z.string(),
  modelUsed: z.string(),
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
});

// Gabungan Data untuk Step Sintesis
const combinedDataSchema = z.object({
  dicom: dicomDataSchema,
  vision: visionDataSchema,
});

// Schema Output Akhir Workflow
export const radiologyOutputSchema = z.object({
  success: z.boolean(),
  studyId: z.string(),
  patientId: z.string(),
  patientName: z.string(),
  modality: z.string(),
  bodyPartExamined: z.string(),
  aiPrediction: z.string(),
  aiConfidence: z.number(),
  visionSource: z.string(),
  report: z.string(),
  disclaimer: z.string(),
});

// STEP 1: Ekstraksi Metadata DICOM
const fetchDicomStep = createStep({
  id: 'fetch-dicom-step',
  description: 'Mengambil metadata pemeriksaan pasien dan keluhan klinis dari server PACS.',
  inputSchema: radiologyInputSchema,
  outputSchema: dicomDataSchema,
  execute: async ({ inputData }) => {
    const result = await (fetchDicomMetadataTool as any).execute({
      studyId: inputData.studyId,
    });

    if (!result.success || !result.data) {
      throw new Error(result.message || `Data DICOM untuk "${inputData.studyId}" tidak ditemukan.`);
    }

    return result.data;
  },
});

// STEP 2: Inferensi AI Vision ONNX
const runVisionStep = createStep({
  id: 'run-vision-step',
  description: 'Menjalankan deteksi visi komputer ONNX terhadap citra radiologi.',
  inputSchema: dicomDataSchema,
  outputSchema: combinedDataSchema,
  execute: async ({ inputData }) => {
    const visionResult = await (runOnnxVisionTool as any).execute({
      studyId: inputData.studyId,
      modality: inputData.modality,
      bodyPart: inputData.bodyPartExamined,
    });

    if (!visionResult.success || !visionResult.data) {
      throw new Error(
        visionResult.message || `Inferensi visi ONNX gagal untuk "${inputData.studyId}".`
      );
    }

    return {
      dicom: inputData,
      vision: {
        source: visionResult.source,
        modelUsed: visionResult.data.modelUsed,
        prediction: visionResult.data.prediction,
        confidence: visionResult.data.confidence,
        findings: visionResult.data.findings || [],
        recommendationAlert: visionResult.data.recommendationAlert,
      },
    };
  },
});

// STEP 3: Sintesis Laporan Radiologi dengan MedGemma
const generateReportStep = createStep({
  id: 'generate-report-step',
  description: 'Menghubungkan korelasi klinis dan temuan AI visi untuk menyusun laporan radiologi terstruktur.',
  inputSchema: combinedDataSchema,
  outputSchema: radiologyOutputSchema,
  execute: async ({ inputData }) => {
    const { dicom, vision } = inputData;

    const findingsSummary = vision.findings
      .map((f: any, idx: number) => `${idx + 1}. ${f.finding} (Severity: ${f.severity}, Prob: ${(f.probability * 100).toFixed(1)}%)`)
      .join('\n');

    const promptText = `Anda adalah VisMed Radiology Copilot, asisten AI klinis spesialis radiologi.
Berdasarkan data pemeriksaan pasien dan hasil analisis citra berikut, susunlah LAPORAN RADIOLOGI MEDIS TERSTRUKTUR:

[DATA PASIEN & PEMERIKSAAN]
- Study ID: ${dicom.studyId}
- ID Pasien: ${dicom.patientId}
- Nama Pasien: ${dicom.patientName} (${dicom.patientAge}, ${dicom.patientSex})
- Modalitas / Bagian Tubuh: ${dicom.modality} / ${dicom.bodyPartExamined}
- Deskripsi: ${dicom.studyDescription}
- Keluhan Klinis: ${dicom.clinicalComplaint}

[HASIL DETEKSI VISI AI ONNX]
- Model: ${vision.modelUsed}
- Prediksi Utama: ${vision.prediction} (Confidence: ${(vision.confidence * 100).toFixed(1)}%)
- Rincian Temuan Visual:
${findingsSummary}
- Catatan Model: ${vision.recommendationAlert || '-'}

FORMAT LAPORAN WAJIB:
1. DATA PASIEN & MODALITAS
2. TEMUAN (Findings): Korelasikan temuan visual dengan keluhan klinis pasien.
3. IMPRESI (Impression): Kesimpulan klinis diagnostik.
4. REKOMENDASI (Recommendations): Tindakan lanjutan (pemeriksaan penunjang/rujukan).

Gunakan bahasa Indonesia medis yang profesional dan objektif.`;

    const response = await medGemmaModel.doGenerate({
      inputFormat: 'messages',
      mode: { type: 'regular' },
      prompt: [
        {
          role: 'user',
          content: [{ type: 'text', text: promptText }],
        },
      ],
    });

    const textPart = response.content?.find((c: any) => c.type === 'text');
    const reportContent =
      textPart?.text ||
      (response as any).text ||
      'Laporan radiologi berhasil disusun berdasarkan data pemeriksaan dan inferensi model.';
    const disclaimer = 'Disclaimer: Laporan ini disusun oleh sistem AI (VisMed Radiology Copilot) sebagai pendukung keputusan klinis. Keputusan diagnostik akhir dan tindakan terapeutik sepenuhnya berada di tangan dokter penanggung jawab pasien.';

    return {
      success: true,
      studyId: dicom.studyId,
      patientId: dicom.patientId,
      patientName: dicom.patientName,
      modality: dicom.modality,
      bodyPartExamined: dicom.bodyPartExamined,
      aiPrediction: vision.prediction,
      aiConfidence: vision.confidence,
      visionSource: vision.source,
      report: reportContent,
      disclaimer,
    };
  },
});

// DEFINISI WORKFLOW DETERMINISTIK
export const radiologyWorkflow = new Workflow({
  id: 'radiology-workflow',
  description:
    'Alur kerja analisis radiologi otomatis: ekstraksi metadata DICOM, inferensi visi ONNX, dan sintesis laporan klinis MedGemma.',
  inputSchema: radiologyInputSchema,
  outputSchema: radiologyOutputSchema,
})
  .then(fetchDicomStep)
  .then(runVisionStep)
  .then(generateReportStep)
  .commit();
