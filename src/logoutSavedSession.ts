/** @v2 logoutSavedSession */
export async function logoutSavedSession(token: string, baseUrl: string): Promise<void> {
  const normalizedToken = token.trim(); if (!normalizedToken) return;
  const url = new URL(`${baseUrl}/v1/mobile/auth/logout`);
  if (url.protocol !== 'https:') throw new TypeError('API connections require HTTPS');
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10_000);
  try {
    await fetch(url.toString(), { method: 'POST',
      headers: { Authorization: `Bearer ${normalizedToken}` }, signal: controller.signal });
  } finally { clearTimeout(timer); }
}
