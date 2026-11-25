import { z } from 'zod';

/**
 * Validated Study ID schema supporting both mock IDs (e.g. STUDY_TB_001)
 * and real DICOM StudyInstanceUIDs with dots (e.g. 1.2.840.113619.2.55.3.4270889),
 * while blocking path traversal patterns (consecutive dots or leading/trailing dots).
 */
export const studyIdSchema = z
  .string()
  .trim()
  .regex(
    /^[A-Za-z0-9._-]{1,128}$/,
    'Format Study ID tidak valid. Hanya karakter alfanumerik, titik (.), garis bawah (_), dan tanda hubung (-) yang diperbolehkan.'
  )
  .refine(
    (val) => !val.includes('..') && !val.startsWith('.') && !val.endsWith('.'),
    'Format Study ID tidak valid. Urutan titik beruntun (..) atau titik di awal/akhir tidak diperbolehkan.'
  )
  .describe(
    'ID Study pemeriksaan pasien di PACS (contoh: 1.2.840.113619.2.55.3.4270889 atau STUDY_TB_001)'
  );
