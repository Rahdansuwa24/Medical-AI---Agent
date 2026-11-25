# DARSI (Digital Assistant Rumah Sakit Islam) Implementation Plan
## End-to-End Roadmap: Multimodal GenAI Microservice & PACS Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun dan mengintegrasikan sistem asisten radiologi kecerdasan buatan multimodal (DARSI) yang menghubungkan Orthanc PACS, `dicom-gateway` (`ChristianHinge/dicom-mcp` bridge), model visi komputer ONNX, subsistem RAG klinis lokal (PNPK Kemenkes), dan LLM MedGemma ke dalam antarmuka terpadu OHIF Medical Image Viewer secara *on-premise* tanpa kebocoran data.

**Architecture:** Arsitektur terdistribusi *decoupled microservices* berbasis Docker. Lapisan data (Orthanc PACS + `dicom-gateway` port 4000 yang membungkus `dicom-mcp` & MWL) dan lapisan visi (FastAPI ONNX port 5000) diorkestrasi secara deterministik oleh Mastra AI Engine (`vismed-agent` port 4111) melalui DAG Workflow ber-skema Zod. Agen interaktif dilengkapi `@mastra/memory` terisolasi per `studyId`/`threadId`, diperkuat oleh subsistem RAG *on-premise* (`LibSQLVector`/`DuckDBVector`), dan disajikan ke dokter melalui sidebar ekstensi OHIF Viewer via REST/SSE.

**Tech Stack:**
- **AI Agent & Orchestration:** Node.js `>= 22.13.0`, TypeScript `^6.0.3`, `@mastra/core` `1.83.0`, `@mastra/memory` `1.41.1`, `zod` `^4.4.3`
- **Clinical LLM & Embedding:** `llama.cpp/medgemma-1.5-4b-it-q4` (utama), `llama.cpp/gemma-4-12b-it-q8` (cadangan), `ollama/nomic-embed-text` (embedding via Bifrost Gateway)
- **Vision Inference:** Python 3.10, ONNX Runtime, TorchXRayVision DenseNet-121, Vision Transformer (ViT), 1D-CNN
- **Imaging, PACS & MCP Bridge:** Orthanc PACS (`8042`/`4242`), `vismed-PACS/apps/dicom-gateway` (Express port `4000`, `@modelcontextprotocol/sdk`, `ChristianHinge/dicom-mcp`, MWL, `decode-dicom`), DICOMweb (`WADO-RS`, `QIDO-RS`, `STOW-RS`), DICOM SR
- **Frontend Clinical Viewer:** OHIF Viewer v3.8+, React 18, Cornerstone.js
- **Local Persistence & RAG Vector:** `@mastra/libsql` `1.30.0` (`LibSQLStore` & `LibSQLVector` di `mastra.db`), `@mastra/duckdb` `1.19.0` (`DuckDBStore` & `DuckDBVector` di `mastra.duckdb`)
- **DevOps & Infrastructure:** Docker, Docker Compose, Git

**Spec:** [arsitektur.md](file:///d:/PA/proposal/arsitektur.md) & [Buku PA - Danang - FIX - Copy v3.docx](file:///d:/PA/proposal/gilibb/draft/Buku%20PA%20-%20Danang%20-%20FIX%20-%20Copy%20v3.docx)

---

## Global Constraints

1. **Zero Cloud Telemetry & Data Exfiltration:** Seluruh citra medis, metadata pasien, memori percakapan, dan embedding vektor wajib diproses di infrastruktur lokal/private. Dilarang menggunakan cloud eksternal (OpenAI, AWS, Pinecone) atau mengaktifkan `MastraPlatformExporter`.
2. **Strict Code Freeze on Planning Turns:** Perubahan kode hanya boleh dilakukan pada giliran eksekusi berstatus implementasi terencana.
3. **Deterministic Core Pipeline (Stateless):** Diagnosis awal dan penyusunan draf wajib melalui DAG Workflow (`radiology-workflow.ts`) ber-skema Zod tanpa kontaminasi memori antar pasien.
4. **Curated Read-Only MCP Tooling:** `vismed-agent` memanggil HTTP bridge `dicom-gateway` (port 4000), bukan membuka proses `dicom-mcp` ganda. LLM 4B hanya boleh mengakses tool baca (*read-only*) terkurasi; tool administratif (`switch_dicom_node`, `move_series`) wajib diblokir dari LLM.
5. **Mandatory Human-in-the-Loop & Fail-Safe:** Draf laporan AI selalu menyertakan *clinical disclaimer*; pengesahan akhir ke DICOM SR dilakukan dokter. Seluruh panggilan eksternal wajib memiliki *timeout* dan *smart-switch fallback* ke mock data tervalidasi.

---

## Review Focus

1. **Kesesuaian Format Ekspertise Radiologi:** Apakah teks laporan selalu mematuhi struktur baku (`DATA PASIEN & MODALITAS`, `TEMUAN`, `IMPRESI`, `REKOMENDASI`, `Disclaimer`)?
2. **Grounding Akurat Subsistem RAG:** Apakah rekomendasi rujukan, konfirmasi TCM/GeneXpert, atau *window period* trombolisis benar-benar bersumber dari PNPK Kemenkes, bukan halusinasi LLM?
3. **Kompatibilitas `StudyInstanceUID` Asli:** Apakah validasi Zod di workflow, `dicom-tool`, dan `onnx-tool` sudah mendukung tanda titik `.` pada UID DICOM Orthanc (bukan hanya `STUDY_TB_001`)?
4. **Pemisahan Metadata (`dicom-mcp`) vs Pixel (`onnx-tool`):** Apakah `onnx-tool` dapat mengambil citra asli lewat Orthanc WADO-RS / `decode-dicom` karena `dicom-mcp` hanya memasok metadata & teks PDF?
5. **Isolasi Memori Agen:** Apakah `agent.ts` mengisolasi sesi chat dokter menggunakan `resourceId` (`studyId`) dan `threadId` agar tidak terjadi kebocoran konteks antar pasien?

---

# STATUS KEMAJUAN ROADMAP PROYEK

- [x] **FASE 1: PACS, Vision Models, & `dicom-gateway` (`dicom-mcp` Bridge)** (Selesai di `vismed-PACS`)
- [x] **FASE 2: Mastra AI Agent Core & Deterministic Workflow** (Selesai & Terverifikasi dengan Mock)
- [ ] **FASE 3: Prasyarat Test/Bifrost & On-Premise Clinical RAG Subsystem** (Prioritas Eksekusi Berikutnya)
- [ ] **FASE 4: Integrasi Live `dicom-mcp` Bridge & Hardening Keamanan Gateway** (Rencana)
- [ ] **FASE 5: Multi-Container Production Docker Orchestration** (Rencana)
- [ ] **FASE 6: OHIF Medical Image Viewer Extension Integration** (Rencana)
- [ ] **FASE 7: Evaluasi Klinis, Uji Latensi, & Laporan Bab 4 PA** (Rencana)

---

## FASE 1: PACS, Computer Vision, & `dicom-gateway` Foundation (SELESAI)

### Task 1.1: Penyusunan Model Visi Komputer & FastAPI Serving
- [x] **Step 1:** Siapkan model TorchXRayVision DenseNet-121, Vision Transformer (ViT), dan 1D-CNN format ONNX di `vismed-PACS`.
- [x] **Step 2:** Bangun REST microservice FastAPI (`/predict`, `/health`) pada port `5000`.

### Task 1.2: `dicom-gateway` (`ChristianHinge/dicom-mcp` Bridge) & Mock Testbed
- [x] **Step 1:** Implementasikan Express bridge pada port `4000` di `vismed-PACS/apps/dicom-gateway` (`services/dicomMcpClient.js` dan `routes/dicom-mcp/index.js`) yang memanggil `uv run dicom-mcp configuration.yaml --transport stdio`.
- [x] **Step 2:** Sediakan endpoint `/dicom-mcp/health`, `/verify`, `/patients`, `/studies`, `/tool` beserta rute MWL (`mwl-read`) dan `decode-dicom`.
- [x] **Step 3:** Buat dataset pengujian lokal (`mock-dicom.json`, `mock-onnx.json`) mencakup skenario TB Paru, Stroke Iskemik, dan Toraks Normal.

---

## FASE 2: Mastra AI Agent Core & Deterministic Workflow (SELESAI)

### Task 2.1: Scaffolding Mastra & Private LLM Gateway (Bifrost)
- [x] **Step 1:** Inisialisasi proyek TypeScript dengan `@mastra/core` `1.83.0`, `@mastra/libsql` `1.30.0`, `@mastra/duckdb` `1.19.0`, dan `@mastra/memory` `1.41.1`.
- [x] **Step 2:** Implementasi `src/mastra/lib/bifrost.ts` untuk `llama.cpp/medgemma-1.5-4b-it-q4` dan `llama.cpp/gemma-4-12b-it-q8` dengan auto-trimming `baseURL` dan header `x-api-key`.

### Task 2.2: Tools Awal & Isolasi Privasi
- [x] **Step 1:** Implementasi `src/mastra/tools/dicom-tool.ts` (saat ini berbasis `mock-dicom.json` dengan proteksi prototype pollution).
- [x] **Step 2:** Implementasi `src/mastra/tools/onnx-tool.ts` dengan *smart-switch fallback* (healthcheck 1.2s, timeout 8s).
- [x] **Step 3:** Bangun `src/mastra/agents/agent.ts` dengan `@mastra/memory` dan guardrail anti *prompt injection*.
- [x] **Step 4:** Bangun DAG Workflow deterministik `src/mastra/workflows/radiology-workflow.ts` (`fetch-dicom-step` $\rightarrow$ `run-vision-step` $\rightarrow$ `generate-report-step`).
- [x] **Step 5:** Hapus `MastraPlatformExporter` di `src/mastra/index.ts`; simpan observability dan data lokal hanya ke LibSQL dan DuckDB.

---

## FASE 3: Prasyarat RAG & On-Premise Clinical RAG Subsystem (PRIORITAS BERIKUTNYA)

> **Tujuan:** Menutup celah kesiapan teknis yang ditemukan saat audit dan mengimplementasikan **Pilar Kebaruan ke-2 (Sub-komponen 7.5 Buku PA)** menggunakan paket vektor lokal yang sudah terpasang (`@mastra/libsql` / `@mastra/duckdb`) serta model `ollama/nomic-embed-text` di Bifrost.

### Task 3.0: Penyiapan Test Runner, Konsistensi DB Path, & Smoke Test Embedding Bifrost
**Files:**
- Modify: `vismed-agent/package.json` (tambah script `"test"` dan `"typecheck"`)
- Modify: `vismed-agent/src/mastra/lib/bifrost.ts` (ekspor fungsi/adapter embedding `ollama/nomic-embed-text`)
- Test: `vismed-agent/src/mastra/rag/bifrost-embed.test.ts`

**Interfaces:**
- Consumes: `POST $BIFROST_BASE_URL/embeddings` menggunakan `BIFROST_API_KEY`.
- Produces: Fungsi `createEmbedding(text: string): Promise<number[]>` yang mengembalikan vektor float tervalidasi (dimensi terverifikasi, misal 768).

- [ ] **Step 1: Tambahkan script `"test": "node --test"` (atau `vitest`) dan `"typecheck": "tsc --noEmit"` di `package.json`** agar setiap task RAG memiliki runner TDD resmi.
- [ ] **Step 2: Write failing test (`bifrost-embed.test.ts`)** untuk memastikan pemanggilan embedding ke Bifrost dengan model `ollama/nomic-embed-text` menghasilkan array angka non-kosong berdimensi konsisten.
- [ ] **Step 3: Jalankan test dan pastikan gagal** (`npm test`).
- [ ] **Step 4: Implementasikan `createEmbedding` (atau `bifrostProvider.embedding('ollama/nomic-embed-text')` / `fetch` `/embeddings` ber-timeout)** di `src/mastra/lib/bifrost.ts` dan pastikan path DB `mastra.db` konsisten antara `mastra dev` dan skrip CLI.
- [ ] **Step 5: Jalankan test & typecheck** (`npm test && npm run typecheck` $\rightarrow$ PASS).
- [ ] **Step 6: Commit:** `git commit -m "chore(rag): add test runner and verify Bifrost nomic-embed-text endpoint"`

---

### Task 3.1: Kurasi Korpus Dokumen SOP Medis Klinis
**Files:**
- Create: `vismed-agent/src/mastra/rag/corpus/pnpk-tb-paru.md`
- Create: `vismed-agent/src/mastra/rag/corpus/pnpk-stroke-akut.md`
- Create: `vismed-agent/src/mastra/rag/corpus/standar-radiologi-toraks.md`
- Test: `vismed-agent/src/mastra/rag/corpus.test.ts`

**Interfaces:**
- Consumes: Dokumen resmi PNPK Kemenkes RI, PERDOSNI, dan PDSRI.
- Produces: File Markdown terstruktur dengan frontmatter/metadata (`sourceTitle`, `skNumber`, `conditionTag`, `modality`).

- [ ] **Step 1: Write failing test (`corpus.test.ts`)** memverifikasi keberadaan 3 file korpus dan kata kunci klinis wajib (`GeneXpert`, `OAT`, `tPA`, `Alteplase`, `Kontraindikasi`).
- [ ] **Step 2: Jalankan test dan pastikan gagal**.
- [ ] **Step 3: Susun 3 file korpus Markdown terkurasi** dengan batasan bagian yang jelas per topik agar mudah di-chunk secara semantik.
- [ ] **Step 4: Jalankan test** (`npm test` $\rightarrow$ PASS).
- [ ] **Step 5: Commit:** `git commit -m "docs(rag): add curated PNPK clinical SOP corpus"`

---

### Task 3.2: Chunking, Vector Store Lokal (`LibSQLVector`), & Pipeline Ingesti
**Files:**
- Create: `vismed-agent/src/mastra/rag/chunker.ts`
- Create: `vismed-agent/src/mastra/rag/vector-store.ts`
- Create: `vismed-agent/src/mastra/rag/ingest.ts`
- Test: `vismed-agent/src/mastra/rag/vector-store.test.ts`

**Interfaces:**
- Consumes: `LibSQLVector` dari `@mastra/libsql` (sudah terinstal, tanpa ketergantungan download ekstensi eksternal saat offline) dan `createEmbedding` dari Task 3.0.
- Produces: Index vektor `clinical_sop_index` di `file:./mastra.db` dan fungsi `queryClinicalSop(query: string, filter?: { modality?: string }, topK?: number)`.

- [ ] **Step 1: Write failing test (`vector-store.test.ts`)** menguji *markdown header/section chunking*, `upsert` vektor ke index lokal `:memory:` / test DB, dan pengambilan skor *cosine similarity* tertinggi untuk kueri *"infiltrat apeks paru curiga TB"*.
- [ ] **Step 2: Jalankan test dan pastikan gagal**.
- [ ] **Step 3: Implementasikan chunker semantik (500 karakter/token dengan overlap + metadata heading), inisialisasi `LibSQLVector`, dan skrip `ingest.ts` idempoten** (menggunakan hash konten agar tidak duplikasi saat dijalankan ulang).
- [ ] **Step 4: Jalankan test & jalankan ingesti korpus ke DB lokal** (`npm test` $\rightarrow$ PASS).
- [ ] **Step 5: Commit:** `git commit -m "feat(rag): implement LibSQLVector store, chunker, and idempotent SOP ingestion"`

---

### Task 3.3: Tool Pencarian SOP (`rag-sop-tool.ts`) & Hybrid Guardrails
**Files:**
- Create: `vismed-agent/src/mastra/tools/rag-sop-tool.ts`
- Test: `vismed-agent/src/mastra/tools/rag-sop-tool.test.ts`

**Interfaces:**
- Consumes: `{ query: string, condition?: string, modality?: string, topK?: number }`.
- Produces: `{ success: boolean, references: Array<{ sourceTitle: string, skNumber: string, section: string, excerpt: string, score: number }>, fallbackNotice?: string }`.

- [ ] **Step 1: Write failing test (`rag-sop-tool.test.ts`)** menguji:
  - Kueri kondisi TB/Infiltration mengembalikan kutipan TCM GeneXpert & OAT Kategori 1.
  - Kueri Stroke Iskemik mengembalikan pedoman trombolisis < 4.5 jam.
  - Ambang batas skor kemiripan (jika `< 0.55` atau tidak relevan, mengembalikan hasil kosong terkontrol + `fallbackNotice` tanpa mengarang rujukan).
- [ ] **Step 2: Jalankan test dan pastikan gagal**.
- [ ] **Step 3: Implementasikan `searchClinicalSopTool`** menggabungkan skor vektor `LibSQLVector` dengan *keyword boost* sederhana untuk istilah kritis medis (`GeneXpert`, `Alteplase`, `Pneumothorax`).
- [ ] **Step 4: Jalankan test** (`npm test` $\rightarrow$ PASS).
- [ ] **Step 5: Commit:** `git commit -m "feat(tools): add search_clinical_sop RAG tool with score threshold"`

---

### Task 3.4: Integrasi RAG ke `radiology-workflow.ts` & `agent.ts`
**Files:**
- Modify: `vismed-agent/src/mastra/workflows/radiology-workflow.ts`
- Modify: `vismed-agent/src/mastra/agents/agent.ts`
- Test: `vismed-agent/src/mastra/workflows/radiology-workflow-rag.test.ts`

**Interfaces:**
- Consumes: Output `runVisionStep` + `dicomDataSchema`.
- Produces: `retrieveSopStep` yang menyuntikkan `ragReferences` dan `groundedSources: string[]` ke `generateReportStep` dan `radiologyOutputSchema`.

- [ ] **Step 1: Write failing test (`radiology-workflow-rag.test.ts`)** memverifikasi bahwa workflow menghasilkan `groundedSources` berisi nama pedoman PNPK yang dirujuk dan prompt MedGemma memuat konteks resmi hasil RAG.
- [ ] **Step 2: Jalankan test dan pastikan gagal**.
- [ ] **Step 3: Sisipkan `retrieveSopStep` di `radiology-workflow.ts`** (`fetchDicomStep` $\rightarrow$ `runVisionStep` $\rightarrow$ `retrieveSopStep` $\rightarrow$ `generateReportStep`) dan daftarkan `search_clinical_sop` di `agent.ts` beserta instruksi agar rekomendasi wajib merujuk hasil RAG.
- [ ] **Step 4: Jalankan seluruh test suite & `npm run typecheck`** $\rightarrow$ PASS.
- [ ] **Step 5: Commit:** `git commit -m "feat(workflow): integrate retrieveSopStep into deterministic radiology DAG"`

---

## FASE 4: Integrasi Live `dicom-mcp` Bridge & Hardening Keamanan

> **Tujuan:** Menghubungkan `vismed-agent` ke server Orthanc nyata melalui `dicom-gateway` (`port 4000`) yang sudah Anda bangun di `vismed-PACS`, sambil menutup celah validasi `StudyInstanceUID` dan keamanan tool MCP.

### Task 4.1: Pembaruan Regex `StudyInstanceUID` & Smart-Switch `dicom-tool.ts` ke `dicom-gateway`
**Files:**
- Modify: `vismed-agent/src/mastra/tools/dicom-tool.ts`
- Modify: `vismed-agent/src/mastra/tools/onnx-tool.ts`
- Modify: `vismed-agent/src/mastra/workflows/radiology-workflow.ts`
- Modify: `vismed-agent/.env.example` (tambah `DICOM_GATEWAY_URL`, `ORTHANC_URL`)
- Test: `vismed-agent/src/mastra/tools/dicom-tool-gateway.test.ts`

- [ ] **Step 1: Write failing test** menguji `studyId` berformat UID DICOM asli bertitik (misal `1.2.840.113619.2.55.3.4270889`), pemanggilan ke mock HTTP `DICOM_GATEWAY_URL/dicom-mcp/studies`, serta fallback aman ke `mock-dicom.json` bila gateway mati.
- [ ] **Step 2: Jalankan test dan pastikan gagal** (karena regex saat ini menolak karakter `.`).
- [ ] **Step 3: Perbarui regex menjadi `/^[A-Za-z0-9._-]{1,128}$/`** (tetap memblokir `..`, `/`, `\`, dan spasi untuk mencegah *path traversal*) serta implementasikan *smart-switch* ke `DICOM_GATEWAY_URL` (+ pengayaan keluhan dari MWL jika tersedia).
- [ ] **Step 4: Jalankan test & typecheck** $\rightarrow$ PASS.
- [ ] **Step 5: Commit:** `git commit -m "feat(dicom): support real DICOM UIDs and smart-switch dicom-mcp gateway"`

---

### Task 4.2: Curated Read-Only MCP Tools & Allowlist Hardening di `dicom-gateway`
**Files:**
- Modify: `vismed-PACS/apps/dicom-gateway/routes/dicom-mcp/index.js` (tambah *allowlist* pada `POST /tool`)
- Create: `vismed-agent/src/mastra/tools/dicom-search-tool.ts` (`search_patient_studies` + `extract_prior_dicom_pdf`)
- Modify: `vismed-agent/src/mastra/agents/agent.ts`

- [ ] **Step 1: Tambahkan allowlist tool aman di `routes/dicom-mcp/index.js`** (`verify_connection`, `query_patients`, `query_studies`, `query_series`, `query_instances`, `extract_pdf_text_from_dicom`) dan tolak tool mutasi (`switch_dicom_node`, `switch_calling_aet`, `move_series`) dengan HTTP `403`.
- [ ] **Step 2: Implementasikan tool terkurasi `search_patient_studies` dan `extract_prior_dicom_pdf`** di `vismed-agent` tanpa memaparkan raw MCP tools ke MedGemma 4B.
- [ ] **Step 3: Uji pemanggilan bridge & pastikan endpoint terlarang mengembalikan `403`**.
- [ ] **Step 4: Commit:** `git commit -m "security(mcp): enforce read-only allowlist on dicom-gateway and add curated search tools"`

---

## FASE 5: Multi-Container Production Docker Orchestration

> **Tujuan:** Menyatukan seluruh ekosistem (`vismed-agent`, `vismed-vision`, `vismed-dicom-gateway`, `vismed-pacs`, `vismed-ohif`) ke dalam satu jaringan Docker terisolasi `vismed-net`.

### Task 5.1: Multi-stage Dockerfile untuk `vismed-agent`
**Files:**
- Create: `vismed-agent/Dockerfile`
- Create: `vismed-agent/.dockerignore`

- [ ] **Step 1:** Buat `.dockerignore` (`node_modules`, `.mastra`, `.env`, log).
- [ ] **Step 2:** Susun multi-stage `Dockerfile` berbasis `node:22-alpine` dengan `USER node` (non-root) mengekspos port `4111`.
- [ ] **Step 3:** Uji `docker build` dan healthcheck lokal.

### Task 5.2: Pembuatan `docker-compose.yml` Lengkap
**Files:**
- Create: `docker-compose.yml`
- Create: `.env.docker.example`

- [ ] **Step 1:** Konfigurasikan 5 layanan dalam `vismed-net`:
  1. `vismed-pacs` (`8042` / `4242` Orthanc)
  2. `vismed-dicom-gateway` (`4000` Express + `dicom-mcp` + MWL)
  3. `vismed-vision` (`5000` FastAPI ONNX, mengambil pixel dari Orthanc/gateway)
  4. `vismed-agent` (`4111` Mastra Engine + mounted volume untuk `mastra.db` & `mastra.duckdb`)
  5. `vismed-ohif` (`3000` OHIF Viewer)
- [ ] **Step 2:** Validasi `docker compose config` dan uji koneksi antar kontainer.

---

## FASE 6: OHIF Medical Image Viewer Extension Integration

> **Tujuan:** Menyediakan pengalaman *Single Pane of Glass* bagi dokter radiolog langsung di dalam OHIF Viewer v3.8+ tanpa membundel Mastra ke kode frontend React.

### Task 6.1: Scaffolding Ekstensi OHIF (`@vismed/extension-ai-copilot`)
**Files:**
- Create: `extensions/vismed-copilot/package.json`
- Create: `extensions/vismed-copilot/src/index.tsx`

- [ ] **Step 1:** Registrasikan `getPanelModule` (panel samping kanan) dan `getToolbarModule` (tombol *"Analisis AI"*).

### Task 6.2: Client Streaming SSE, Memory Scoping, & Editor Laporan
**Files:**
- Create: `extensions/vismed-copilot/src/services/mastraClient.ts`
- Create: `extensions/vismed-copilot/src/components/CopilotPanel.tsx`
- Create: `extensions/vismed-copilot/src/components/FindingGauges.tsx`
- Create: `extensions/vismed-copilot/src/components/ReportEditor.tsx`

- [ ] **Step 1:** Hubungkan `mastraClient.ts` ke `POST /api/workflows/radiology-workflow/start` (SSE streaming status per step) serta `POST /api/agents/agent/generate` dengan `{ resourceId: activeStudyInstanceUid, threadId: doctorSessionId }` agar `@mastra/memory` terisolasi per pasien.
- [ ] **Step 2:** Bangun UI `FindingGauges` (probabilitas ONNX + sitasi sumber PNPK dari RAG) dan `ReportEditor` dengan kontras dark-theme OHIF dan `aria-live="polite"` untuk status streaming.

### Task 6.3: Human-in-the-Loop & Ekspor DICOM Structured Report (SR)
**Files:**
- Create: `extensions/vismed-copilot/src/services/dicomSrExport.ts`

- [ ] **Step 1:** Implementasikan konversi laporan yang telah disetujui dokter ke objek DICOM Basic Text SR (`0040,A040`, `0040,A160`) dan kirim ke Orthanc via `STOW-RS` sambil mencatat log audit di Mastra.

---

## FASE 7: Evaluasi Klinis, Benchmark Kinerja, & Laporan Bab 4 PA

- [ ] **Task 7.1 (Benchmark Latensi & Resource):** Ukur waktu tiap tahapan (DICOM MCP query, ONNX inference, RAG LibSQL vector search, MedGemma generation) serta penggunaan RAM/VRAM untuk P50/P90/P99.
- [ ] **Task 7.2 (Evaluasi Kualitas Laporan & Efek RAG):** Uji 30 kasus beranotasi pakar dengan metrik ROUGE-L, BLEU, dan perbandingan tingkat halusinasi rekomendasi klinis **sebelum vs sesudah** RAG PNPK aktif.
- [ ] **Task 7.3 (Uji Akseptabilitas Dokter Radiologi):** Kuisioner skala Likert 5-poin dan *System Usability Scale (SUS)* pada antarmuka OHIF Copilot.
