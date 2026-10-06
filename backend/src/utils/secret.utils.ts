import fs from 'node:fs';

function readSecretFile(secretName: string): string | undefined {
  const secretPath = `/run/secrets/${secretName}`;

  try {
    if (!fs.existsSync(secretPath)) {
      return undefined;
    }

    const raw = fs.readFileSync(secretPath, 'utf8').trim();
    return raw || undefined;
  } catch {
    return undefined;
  }
}

export function getSecretValue(envName: string, secretName?: string): string | undefined {
  const fromEnv = process.env[envName]?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  const fromSecret = readSecretFile(secretName ?? envName);
  if (fromSecret) {
    return fromSecret;
  }

  return undefined;
}
