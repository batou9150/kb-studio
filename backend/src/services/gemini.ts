import { GoogleGenAI, createPartFromUri } from '@google/genai';
import { GoogleAuth } from 'google-auth-library';
import { getKbMetadata, updateKbEntry, bulkUpdateKbEntries } from './storage';
import type { KbEntry } from './storage';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = 'gemini-3.1-flash-lite-preview';

const AUTH_SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/generative-language',
];

function createAuth(): GoogleAuth {
  const keyFile = process.env.SERVICE_ACCOUNT_FILE;
  if (keyFile) {
    return new GoogleAuth({ keyFile, scopes: AUTH_SCOPES });
  }
  return new GoogleAuth({ scopes: AUTH_SCOPES });
}

const auth = createAuth();

const ANALYSIS_PROMPT = `Analyze this document and return ONLY a JSON object with:
- "description": short description (1-2 sentences, in French)
- "value_date": most relevant date found in the document (YYYY-MM-DD format) or "" if none found
- "category": one of the following values:

  faq - FAQ / Questions fréquentes
  how_to - Guide pratique / How-to
  manual - Manuel / Documentation technique
  troubleshooting - Dépannage / Troubleshooting
  meeting_minutes - Compte-rendu de réunion
  policy - Politique / Règlement
  sop - Procédure opérationnelle (SOP)
  form - Formulaire
  report - Rapport
  release_notes - Notes de version
  presentation - Présentation
  memo - Note de service / Mémo
  contract - Contrat / Accord
  whitepaper - Livre blanc
  marketing_asset - Support marketing
  other - Autre

Return ONLY valid JSON, no markdown, no explanation.`;

function parseAnalysisResponse(text: string): { description: string; value_date: string; category: string } {
  // Strip markdown code fences if present
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const parsed = JSON.parse(cleaned);
  return {
    description: parsed.description || '',
    value_date: parsed.value_date || '',
    category: parsed.category || 'other',
  };
}

export async function analyzeFile(bucketName: string, entry: KbEntry): Promise<{ description: string; value_date: string; category: string }> {
  const registered = await ai.files.registerFiles({ auth, uris: [entry.content.uri] });
  const fileUri = registered.files?.[0]?.uri ?? entry.content.uri;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          createPartFromUri(fileUri, entry.content.mimeType),
          { text: ANALYSIS_PROMPT },
        ],
      },
    ],
  });

  const text = response.text ?? '';
  return parseAnalysisResponse(text);
}

export async function startBatchAnalysis(bucketName: string): Promise<{ batchName: string; totalFiles: number }> {
  const entries = await getKbMetadata(bucketName);
  if (entries.length === 0) {
    throw new Error('No files to analyze');
  }

  // Register files in batches of 100 (API limit)
  const REGISTER_BATCH_SIZE = 100;
  const uris = entries.map((e) => e.content.uri);
  const registeredFiles: { uri?: string }[] = [];
  for (let i = 0; i < uris.length; i += REGISTER_BATCH_SIZE) {
    const chunk = uris.slice(i, i + REGISTER_BATCH_SIZE);
    const registered = await ai.files.registerFiles({ auth: auth, uris: chunk });
    registeredFiles.push(...(registered.files ?? []));
  }

  const requests = entries.map((entry, i) => ({
    contents: [
      {
        role: 'user' as const,
        parts: [
          createPartFromUri(registeredFiles[i]?.uri ?? entry.content.uri, entry.content.mimeType),
          { text: ANALYSIS_PROMPT },
        ],
      },
    ],
    metadata: { id: entry.id },
  }));

  const batch = await ai.batches.create({
    model: MODEL,
    src: requests,
    config: {
      displayName: `kb-studio-analysis-${Date.now()}`,
    },
  });

  return {
    batchName: batch.name!,
    totalFiles: entries.length,
  };
}

export async function listBatches(): Promise<{
  name: string;
  state: string;
  displayName: string;
  createTime: string;
  endTime: string;
}[]> {
  const stateMap: Record<string, string> = {
    JOB_STATE_SUCCEEDED: 'succeeded',
    JOB_STATE_FAILED: 'failed',
    JOB_STATE_CANCELLED: 'cancelled',
    JOB_STATE_RUNNING: 'running',
    JOB_STATE_PENDING: 'running',
  };

  const result: { name: string; state: string; displayName: string; createTime: string; endTime: string }[] = [];
  const pager = await ai.batches.list({ config: { pageSize: 100 } });
  for await (const batch of pager) {
    const dn = batch.displayName ?? '';
    if (!dn.startsWith('kb-studio-analysis-')) continue;
    result.push({
      name: batch.name!,
      state: stateMap[batch.state ?? ''] ?? 'unknown',
      displayName: dn,
      createTime: (batch as any).createTime ?? '',
      endTime: (batch as any).endTime ?? '',
    });
  }
  return result;
}

function extractResponseError(resp: any): string | null {
  // Check for API-level error on the response item
  if (resp.error) {
    const e = resp.error;
    return e.message || (typeof e === 'string' ? e : JSON.stringify(e));
  }

  const candidate = resp.response?.candidates?.[0];
  if (!candidate) return 'No candidate in response';

  // Check finishReason for non-success stops
  const reason = candidate.finishReason;
  if (reason && reason !== 'FINISH_REASON_STOP' && reason !== 'STOP') {
    const labels: Record<string, string> = {
      FINISH_REASON_SAFETY: 'Blocked: safety filter',
      FINISH_REASON_RECITATION: 'Blocked: unauthorized citation',
      FINISH_REASON_MAX_TOKENS: 'Stopped: max tokens reached',
      FINISH_REASON_BLOCKLIST: 'Blocked: blocked terms',
      FINISH_REASON_PROHIBITED_CONTENT: 'Blocked: prohibited content',
      FINISH_REASON_SPII: 'Blocked: sensitive personal info',
    };
    return labels[reason] || `Stopped: ${reason}`;
  }

  const text = candidate.content?.parts?.[0]?.text ?? '';
  if (!text.trim()) return 'Empty response from model';

  return null; // No error
}

export async function getBatchAnalysisDetails(batchName: string): Promise<{
  results: { id: string; description: string; value_date: string; category: string }[];
  failed: { id: string; error: string }[];
}> {
  const batch = await ai.batches.get({ name: batchName });
  const responses = batch.dest?.inlinedResponses ?? [];
  const results: { id: string; description: string; value_date: string; category: string }[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const resp of responses) {
    const id = resp.metadata?.id;
    if (!id) continue;

    const errorMsg = extractResponseError(resp);
    if (errorMsg) {
      failed.push({ id, error: errorMsg });
      continue;
    }

    try {
      const text = resp.response?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const parsed = parseAnalysisResponse(text);
      results.push({ id, ...parsed });
    } catch (err: any) {
      failed.push({ id, error: `Parse error: ${err.message || String(err)}` });
    }
  }

  return { results, failed };
}

export async function getBatchAnalysisStatus(bucketName: string, batchName: string): Promise<{
  state: string;
  succeededCount?: number;
  failedCount?: number;
  totalCount?: number;
  results?: { id: string; description: string; value_date: string; category: string }[];
  failed?: { id: string; error: string }[];
}> {
  const batch = await ai.batches.get({ name: batchName });
  const state = batch.state ?? 'JOB_STATE_UNSPECIFIED';

  if (state === 'JOB_STATE_SUCCEEDED') {
    const responses = batch.dest?.inlinedResponses ?? [];
    const results: { id: string; description: string; value_date: string; category: string }[] = [];
    const failed: { id: string; error: string }[] = [];
    const bulkUpdates = new Map<string, Partial<{ description: string; value_date: string; category: string }>>();

    for (const resp of responses) {
      const id = resp.metadata?.id;
      if (!id) continue;

      const respError = extractResponseError(resp);
      if (respError) {
        console.error(`Batch response error for id ${id}:`, respError);
        failed.push({ id, error: respError });
        continue;
      }

      try {
        const text = resp.response?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        const parsed = parseAnalysisResponse(text);
        bulkUpdates.set(id, parsed);
        results.push({ id, ...parsed });
      } catch (err: any) {
        const errorMsg = `Parse error: ${err.message || String(err)}`;
        console.error(`Failed to parse batch response for id ${id}:`, errorMsg);
        failed.push({ id, error: errorMsg });
      }
    }

    // Single write for all successful updates
    if (bulkUpdates.size > 0) {
      await bulkUpdateKbEntries(bucketName, bulkUpdates);
    }

    return { state: 'succeeded', results, failed };
  }

  if (state === 'JOB_STATE_FAILED' || state === 'JOB_STATE_CANCELLED') {
    return { state: state === 'JOB_STATE_FAILED' ? 'failed' : 'cancelled' };
  }

  // Still running
  const stats = batch.completionStats;
  return {
    state: 'running',
    succeededCount: parseInt(stats?.successfulCount ?? '0', 10),
    failedCount: parseInt(stats?.failedCount ?? '0', 10),
    totalCount: parseInt(stats?.successfulCount ?? '0', 10) + parseInt(stats?.failedCount ?? '0', 10) + parseInt(stats?.incompleteCount ?? '0', 10),
  };
}
