export type ResilientReadOptions = { attemptTimeoutMs?: number; totalTimeoutMs?: number; retryDelayMs?: number; retryTransient?: boolean };

function timeoutError(message: string): Error {
  const error = new Error(message); error.name = 'TimeoutError'; return error;
}
function clientFailure(error: unknown): 'transport' | 'tls' | 'transport_policy' | null {
  if (!(error instanceof Error)) return null;
  const message = error.message.toLowerCase();
  if (message.includes('require https') || message.includes('too many api redirects')) return 'transport_policy';
  if (message.includes('certificate') || message.includes('handshake')) return 'tls';
  return error instanceof TypeError || error.name === 'ClientException' ? 'transport' : null;
}

/** @v2 resilientApiRead */
export async function resilientApiRead(uri: string, send: (signal: AbortSignal) => Promise<Response>,
  options: ResilientReadOptions = {}): Promise<Response> {
  const attemptTimeout = options.attemptTimeoutMs ?? 10_000, totalTimeout = options.totalTimeoutMs ?? 15_000;
  const retryDelay = options.retryDelayMs ?? 150, attempts = options.retryTransient === false ? 1 : 2;
  const started = Date.now(), path = new URL(uri).pathname;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const remaining = totalTimeout - (Date.now() - started);
    if (remaining <= 0) throw timeoutError('API read deadline exceeded');
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const response = await Promise.race([send(controller.signal), new Promise<never>((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(timeoutError('API read attempt timed out')); },
          Math.min(attemptTimeout, remaining));
      })]);
      const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
      const html = path.startsWith('/v1/mobile/') && response.status >= 200 && response.status < 300 &&
        (contentType.includes('text/html') || (!contentType && /^\s*<(?:!doctype\s+html|html)[\s>]/i.test(await response.clone().text())));
      if (html) {
        if (attempt === attempts) throw new TypeError('API returned HTML instead of data');
      } else if ([502, 503, 504].includes(response.status)) {
        if (attempt === attempts) return response;
      } else return response;
    } catch (error) {
      const failure = clientFailure(error);
      if (attempt === attempts || (error instanceof Error && error.name !== 'TimeoutError' && failure === null) ||
          failure === 'transport_policy' || failure === 'tls') throw error;
    } finally { if (timer !== undefined) clearTimeout(timer); }
    if (totalTimeout - (Date.now() - started) <= retryDelay) throw timeoutError('API read deadline exceeded');
    await new Promise<void>(resolve => setTimeout(resolve, retryDelay));
  }
  throw new Error('API read attempts exhausted');
}
