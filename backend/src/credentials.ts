import { readFileSync } from 'node:fs';
import dotenv from 'dotenv';
import { GoogleAuth, JWT } from 'google-auth-library';

dotenv.config();

/** cloud-platform covers Cloud Storage and Agent Search; generative-language covers Gemini file registration. */
const SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/generative-language',
];

/**
 * Build a JWT client from a service account key file. Only `service_account` keys are
 * accepted: loading arbitrary credential configs (external accounts, etc.) from a file
 * is what google-auth-library deprecated `keyFilename` for.
 */
export function loadServiceAccount(path: string): { client: JWT; projectId?: string } {
  let key: Record<string, unknown>;
  try {
    key = JSON.parse(readFileSync(path, 'utf-8'));
  } catch (err) {
    throw new Error(`SERVICE_ACCOUNT_FILE: cannot read service account key at ${path}`, { cause: err });
  }
  if (key.type !== 'service_account') {
    throw new Error(`SERVICE_ACCOUNT_FILE must be a service account key (type "service_account"), got type "${String(key.type)}"`);
  }
  if (typeof key.client_email !== 'string' || typeof key.private_key !== 'string') {
    throw new Error('SERVICE_ACCOUNT_FILE: service account key is missing client_email or private_key');
  }
  const client = new JWT({
    email: key.client_email,
    key: key.private_key,
    keyId: typeof key.private_key_id === 'string' ? key.private_key_id : undefined,
    scopes: SCOPES,
  });
  return { client, projectId: typeof key.project_id === 'string' ? key.project_id : undefined };
}

function createGoogleAuth(): GoogleAuth {
  const keyFile = process.env.SERVICE_ACCOUNT_FILE;
  if (!keyFile) return new GoogleAuth({ scopes: SCOPES });
  const { client, projectId } = loadServiceAccount(keyFile);
  return new GoogleAuth({ authClient: client, projectId });
}

/**
 * Credentials shared by all Google Cloud clients: the service account key when
 * SERVICE_ACCOUNT_FILE is set, Application Default Credentials otherwise.
 */
export const googleAuth = createGoogleAuth();
