import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JWT } from 'google-auth-library';
import { loadServiceAccount } from './credentials';

const withKeyFile = (content: string, fn: (path: string) => void) => {
  const dir = mkdtempSync(join(tmpdir(), 'kb-studio-creds-'));
  try {
    const path = join(dir, 'key.json');
    writeFileSync(path, content);
    fn(path);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

test('loadServiceAccount builds a scoped JWT client and keeps the key project', () => {
  const key = {
    type: 'service_account',
    project_id: 'my-project',
    private_key_id: 'abc123',
    private_key: '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n',
    client_email: 'sa@my-project.iam.gserviceaccount.com',
  };
  withKeyFile(JSON.stringify(key), path => {
    const { client, projectId } = loadServiceAccount(path);
    assert.ok(client instanceof JWT);
    assert.equal(client.email, key.client_email);
    assert.equal(client.keyId, key.private_key_id);
    assert.ok(Array.isArray(client.scopes) && client.scopes.includes('https://www.googleapis.com/auth/cloud-platform'));
    assert.equal(projectId, 'my-project');
  });
});

test('loadServiceAccount rejects credential types other than service_account', () => {
  const external = { type: 'external_account', audience: 'x', subject_token_type: 'y', credential_source: { file: '/etc/passwd' } };
  withKeyFile(JSON.stringify(external), path => {
    assert.throws(() => loadServiceAccount(path), /must be a service account key.*external_account/);
  });
});

test('loadServiceAccount rejects keys missing client_email or private_key', () => {
  withKeyFile(JSON.stringify({ type: 'service_account', client_email: 'sa@x' }), path => {
    assert.throws(() => loadServiceAccount(path), /missing client_email or private_key/);
  });
});

test('loadServiceAccount reports unreadable or malformed files', () => {
  assert.throws(() => loadServiceAccount('/nonexistent/kb-studio-key.json'), /cannot read service account key/);
  withKeyFile('{not json', path => {
    assert.throws(() => loadServiceAccount(path), /cannot read service account key/);
  });
});
