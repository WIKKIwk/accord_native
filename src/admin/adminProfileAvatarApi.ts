import { fetch } from 'expo/fetch';
import { checkedAdminGuard } from './adminProductionRequest';
import { adminProfileAvatarCanLoad } from './adminProfileAvatarModel';
import { dartTrim } from './dartJsonString';

export type AdminProfileAvatarBytes = { bytes: Uint8Array; mime: string };
const redirects = new Set([301, 302, 303, 307, 308]);
function httpUrl(value: string, base?: string): string | null {
  try {
    const url = new URL(value, base);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname) return null;
    return url.href;
  } catch { return null; }
}
/** @v2 NetworkImage
 * Public avatar reads deliberately use no session transport, cookies, bearer header or refresh. */
export async function readAdminProfileAvatar(rawUrl: string, guard: () => void, signal: AbortSignal): Promise<AdminProfileAvatarBytes | null> {
  const checked = checkedAdminGuard(guard)!;
  const check = () => { checked(); if (signal.aborted) throw new Error('Admin avatar request closed'); };
  check(); if (!adminProfileAvatarCanLoad(rawUrl)) return null;
  let url = httpUrl(dartTrim(rawUrl)); if (!url) return null;
  const visited = new Set<string>();
  try {
    // Dart HttpClientRequest follows at most five redirects for NetworkImage's GET.
    for (let count = 0; count <= 5; count++) {
      check(); if (visited.has(url)) return null; visited.add(url);
      const response = await fetch(url, { method: 'GET', headers: {}, credentials: 'omit', redirect: 'manual', signal }); check();
      if (response.redirected) { try { await response.body?.cancel(); } catch { check(); } check(); return null; }
      if (redirects.has(response.status)) {
        const location = response.headers.get('location'); check();
        try { await response.body?.cancel(); } catch { check(); } check();
        if (!location || count === 5) return null;
        const next = httpUrl(location, url); check(); if (!next) return null; url = next; continue;
      }
      if (response.status !== 200) { try { await response.body?.cancel(); } catch { check(); } check(); return null; }
      const bytes = new Uint8Array(await response.arrayBuffer()); check();
      const mime = response.headers.get('content-type')?.split(';')[0].trim() ?? ''; check();
      return bytes.length ? { bytes, mime: /^image\/[a-z0-9.+-]+$/i.test(mime) ? mime : 'image/jpeg' } : null;
    }
    return null;
  } catch { check(); return null; }
}
