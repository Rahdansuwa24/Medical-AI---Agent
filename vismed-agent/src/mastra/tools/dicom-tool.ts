import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import mockDicom from '../mocks/mock-dicom.json';

export const fetchDicomMetadataTool = createTool({
  id: 'fetch_dicom_metadata',
  description:
    'Mengambil metadata pasien dan modalitas citra DICOM dari PACS berdasarkan ID pemeriksaan (studyId). Mengembalikan informasi pasien, usia, jenis kelamin, keluhan klinis, modalitas (DX/CT), dan deskripsi pemeriksaan.',
  inputSchema: z.object({
    studyId: z
      .string()
      .describe(
        'ID Study pemeriksaan pasien di PACS (contoh: STUDY_TB_001, STUDY_STROKE_002, STUDY_NORMAL_003)'
      ),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z
      .object({
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
      })
      .optional(),
    message: z.string().optional(),
  }),
  execute: async ({ studyId }) => {
    const study = (mockDicom as Record<string, any>)[studyId];

    if (!study) {
      return {
        success: false,
        message: `Data pemeriksaan DICOM untuk Study ID "${studyId}" tidak ditemukan di server PACS.`,
      };
    }

    return {
      success: true,
      data: study,
    };
  },
});
