import type { Session } from '../auth';
import { adminServerMonitorLiveUri } from './serverMonitorApi';
import { monitorLiveEventFromJson, type AdminServerMonitorLiveEvent } from './serverMonitorModel';

/** @v2 adminServerMonitorLiveEvents */
export function adminServerMonitorLiveEvents(session: Session) {
  return {
    subscribe(onEvent: (event: AdminServerMonitorLiveEvent) => void, onError: (error: unknown) => void, onDone?: () => void): () => void {
      let cancelled = false, finished = false, socket: WebSocket | null = null, pingId = 0;
      let watchdog: ReturnType<typeof setTimeout> | undefined, connectTimer: ReturnType<typeof setTimeout> | undefined;
      let pingTimer: ReturnType<typeof setInterval> | undefined;
      const clear = () => {
        if (watchdog !== undefined) clearTimeout(watchdog);
        if (connectTimer !== undefined) clearTimeout(connectTimer);
        if (pingTimer !== undefined) clearInterval(pingTimer);
        watchdog = undefined; connectTimer = undefined; pingTimer = undefined;
      };
      const close = () => {
        const old = socket; socket = null;
        if (!old) return;
        old.onopen = null; old.onmessage = null; old.onerror = null; old.onclose = null;
        try { old.close(); } catch { /* Closing an already-failed socket is best effort. */ }
      };
      const finish = (error?: unknown) => {
        if (cancelled || finished) return;
        finished = true; clear(); close();
        if (error !== undefined) onError(error);
        if (!cancelled) onDone?.();
      };
      const watch = () => {
        if (watchdog !== undefined) clearTimeout(watchdog);
        watchdog = setTimeout(() => {
          const error = new Error('Live stream timed out'); error.name = 'TimeoutError'; finish(error);
        }, 7_000);
      };
      const ping = () => {
        if (!cancelled && !finished && socket?.readyState === 1) {
          socket.send(JSON.stringify({ type: 'ping', id: ++pingId, sent_at_ms: Date.now() }));
        }
      };
      watch();
      void Promise.resolve().then(() => {
        if (cancelled || finished) return;
        let current: WebSocket;
        try { current = new WebSocket(adminServerMonitorLiveUri(session).toString()); }
        catch (error) { finish(error); return; }
        socket = current;
        connectTimer = setTimeout(() => {
          const error = new Error('Live stream connection timed out'); error.name = 'TimeoutError'; finish(error);
        }, 10_000);
        current.onopen = () => {
          if (cancelled || finished || socket !== current) return;
          if (connectTimer !== undefined) clearTimeout(connectTimer);
          connectTimer = undefined;
          ping(); pingTimer = setInterval(ping, 2_000);
        };
        current.onmessage = event => {
          if (cancelled || finished || socket !== current || typeof event.data !== 'string') return;
          let parsed: AdminServerMonitorLiveEvent;
          try {
            const decoded: unknown = JSON.parse(event.data);
            if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) throw new TypeError('Invalid live event');
            watch();
            parsed = monitorLiveEventFromJson(decoded);
          } catch (error) { finish(error); return; }
          if (parsed.report !== null || parsed.latency_ms !== null) onEvent(parsed);
        };
        current.onerror = event => { if (socket === current) finish(event); };
        current.onclose = () => { if (socket === current) finish(); };
      });
      return () => { if (!cancelled) { cancelled = true; clear(); close(); } };
    },
  };
}
