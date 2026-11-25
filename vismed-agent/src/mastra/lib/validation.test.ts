import test from 'node:test';
import assert from 'node:assert/strict';
import { studyIdSchema } from './validation';
import { fetchDicomMetadataTool } from '../tools/dicom-tool';
import { runOnnxVisionTool } from '../tools/onnx-tool';
import { radiologyInputSchema } from '../workflows/radiology-workflow';

test('studyIdSchema menerima StudyInstanceUID DICOM bertitik dan mock ID', () => {
  const validIds = [
    '1.2.840.113619.2.55.3.4270889',
    '1.3.12.2.1107.5.1.4.60124',
    'STUDY_TB_001',
    'STUDY_STROKE_002',
    'STUDY_NORMAL_003',
    '  1.2.840.10008.1  ',
  ];

  for (const id of validIds) {
    const parsed = studyIdSchema.safeParse(id);
    assert.equal(parsed.success, true, `Seharusnya valid: ${id}`);
  }

  assert.equal(studyIdSchema.parse('  1.2.840.10008.1  '), '1.2.840.10008.1');
});

test('studyIdSchema menolak path traversal dan karakter tidak valid', () => {
  const invalidIds = [
    '',
    '   ',
    '../etc/passwd',
    '1.2..840',
    '.leadingdot',
    'trailingdot.',
    'STUDY/001',
    'STUDY\\001',
    'STUDY 001',
    'a'.repeat(129),
  ];

  for (const id of invalidIds) {
    const parsed = studyIdSchema.safeParse(id);
    assert.equal(parsed.success, false, `Seharusnya ditolak: ${id}`);
  }
});

test('tool dan workflow inputSchema mendukung DICOM UID bertitik secara konsisten', async () => {
  const uid = '1.2.840.113619.2.55.3.4270889';
  const dicomValid = await fetchDicomMetadataTool.inputSchema!['~standard'].validate({ studyId: uid });
  const onnxValid = await runOnnxVisionTool.inputSchema!['~standard'].validate({ studyId: uid });
  assert.equal('issues' in dicomValid, false);
  assert.equal('issues' in onnxValid, false);
  assert.equal(radiologyInputSchema.safeParse({ studyId: uid }).success, true);

  const traversal = '../secret';
  const dicomInvalid = await fetchDicomMetadataTool.inputSchema!['~standard'].validate({ studyId: traversal });
  const onnxInvalid = await runOnnxVisionTool.inputSchema!['~standard'].validate({ studyId: traversal });
  assert.equal(Boolean(dicomInvalid.issues?.length), true);
  assert.equal(Boolean(onnxInvalid.issues?.length), true);
  assert.equal(radiologyInputSchema.safeParse({ studyId: traversal }).success, false);
});

test('fetchDicomMetadataTool mengembalikan data mock valid dan menolak UID tidak terdaftar secara aman', async () => {
  const found = await (fetchDicomMetadataTool as any).execute({ studyId: 'STUDY_TB_001' });
  assert.equal(found.success, true);
  assert.equal(found.data.modality, 'DX');

  const notFound = await (fetchDicomMetadataTool as any).execute({
    studyId: '1.2.840.113619.2.55.3.4270889',
  });
  assert.equal(notFound.success, false);
  assert.match(notFound.message, /tidak ditemukan/i);
});
