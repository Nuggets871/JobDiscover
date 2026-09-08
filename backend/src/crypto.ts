const encoder = new TextEncoder();

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}

export function randomToken(bytes = 32) {
  const value = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...value))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

export async function tokenHash(value: string) {
  return hex(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', encoder.encode(value)),
    ),
  );
}

export async function passwordHash(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const rounds = 600_000;
  const derived = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: rounds },
      key,
      256,
    ),
  );
  return `pbkdf2-sha256$${rounds}$${hex(salt)}$${hex(derived)}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, iterations, saltHex, expectedHex] = encoded.split('$');
  if (
    algorithm !== 'pbkdf2-sha256' ||
    !/^\d+$/.test(iterations) ||
    !/^[a-f0-9]{32}$/.test(saltHex) ||
    !/^[a-f0-9]{64}$/.test(expectedHex)
  )
    return false;
  const salt = new Uint8Array(
    saltHex.match(/../g)!.map((x) => Number.parseInt(x, 16)),
  );
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const actual = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: Number(iterations) },
      key,
      256,
    ),
  );
  const expected = new Uint8Array(
    expectedHex.match(/../g)!.map((x) => Number.parseInt(x, 16)),
  );
  let difference = actual.length ^ expected.length;
  for (let index = 0; index < actual.length; index++)
    difference |= actual[index] ^ (expected[index] ?? 0);
  return difference === 0;
}