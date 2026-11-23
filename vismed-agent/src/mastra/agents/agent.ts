import { pathToFileURL } from 'node:url';
import { Agent } from '@mastra/core/agent';
import { TaskSignalProvider } from '@mastra/core/signals';
import { askUserTool, webFetchTool, webSearchTool } from '@mastra/core/tools';
import { LocalFilesystem, LocalSandbox, WORKSPACE_TOOLS, Workspace } from '@mastra/core/workspace';
import { Memory } from '@mastra/memory';
import { startScheduleTool, stopScheduleTool } from '../tools/schedule-tools';
import { medGemmaModel } from '../lib/bifrost';

const workspacePath = 'workspace';

const workspace = new Workspace({
  id: 'agent-workspace',
  name: 'Agent Workspace',
  filesystem: new LocalFilesystem({
    basePath: workspacePath,
  }),
  sandbox: new LocalSandbox({
    workingDirectory: workspacePath,
  }),
  tools: {
    [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]: {
      requireReadBeforeWrite: true,
    },
    [WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE]: {
      requireReadBeforeWrite: true,
    },
    [WORKSPACE_TOOLS.FILESYSTEM.DELETE]: {
      requireApproval: true,
    },
  },
});

export const agent = new Agent({
  id: 'agent',
  name: 'VisMed Radiology Copilot',
  description:
    'Asisten kecerdasan buatan klinis untuk dokter dan radiolog dalam menganalisis metadata medis dan temuan citra radiologi.',
  metadata: {
    suggestedPrompts: [
      'Perkenalkan dirimu dan jelaskan peranmu sebagai asisten radiologi.',
      'Analisis temuan citra rontgen dada untuk dugaan tuberkulosis.',
      'Rangkum temuan klinis pasien dalam format SOAP standar.',
    ],
  },
  instructions: `Anda adalah VisMed Radiology Copilot, asisten AI klinis yang dirancang untuk mendukung dokter dan radiolog.

Tugas dan Pedoman Anda:
1. Membantu dokter dalam interpretasi metadata medis, keluhan pasien, dan temuan radiologi.
2. Menyusun laporan medis terstruktur dalam format standar:
   - TEMUAN (Findings): Rangkuman temuan visual dan kondisi pasien.
   - IMPRESI (Impression): Kesimpulan diagnostik klinis.
   - REKOMENDASI (Recommendations): Tindakan lanjutan (misal tes laboratorium, rujukan, atau scan lanjutan).
3. Selalu sertakan disclaimer medis bahwa keputusan diagnostik dan penanganan akhir berada di tangan dokter penanggung jawab pasien.
4. Gunakan bahasa Indonesia medis yang profesional, objektif, dan baku.
`,
  model: medGemmaModel,
  defaultOptions: {
    maxSteps: 100,
    autoResumeSuspendedTools: true,
  },
  memory: new Memory({
    options: {
      generateTitle: true,
      observationalMemory: {
        model: medGemmaModel,
      },
    },
  }),
  workspace,
  tools: {
    ask_user: askUserTool,
    start_schedule: startScheduleTool,
    stop_schedule: stopScheduleTool,
    web_fetch: webFetchTool,
    web_search: webSearchTool,
  },
  signals: [new TaskSignalProvider()],
});
