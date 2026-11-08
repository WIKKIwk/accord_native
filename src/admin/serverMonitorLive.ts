import type { Session } from '../auth';
import { adminServerMonitorLiveUri } from './serverMonitorApi';
import { monitorLiveEventFromJson, type AdminServerMonitorLiveEvent } from './serverMonitorModel';

export type ServerMonitorLiveSubscription = (() => void) & { pause(resumeSignal?: Promise<unknown>): void; resume(): void };

/** @v2 adminServerMonitorLiveEvents */
export function adminServerMonitorLiveEvents(session: Session) {
  return {
    subscribe(onEvent: (event: AdminServerMonitorLiveEvent) => void, onError: (error: unknown) => void,
      onDone?: () => void): ServerMonitorLiveSubscription {
      let cancelled = false, finished = false, paused = false, pauseCount = 0, socket: WebSocket | null = null, pingId = 0;
      const pending: (() => void)[] = [];
      const dispatch = (callback: () => void) => { if (paused) pending.push(callback); else callback(); };
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
        finished = true; pending.length = 0; clear(); close();
        if (error !== undefined) onError(error);
        if (!cancelled) onDone?.();
      };
      const watch = () => {
        if (watchdog !== undefined) clearTimeout(watchdog);
        watchdog = undefined;
        if (paused) return;
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
        catch (error) { dispatch(() => finish(error)); return; }
        socket = current;
        connectTimer = setTimeout(() => {
          const error = new Error('Live stream connection timed out'); error.name = 'TimeoutError'; dispatch(() => finish(error));
        }, 10_000);
        current.onopen = () => {
          if (cancelled || finished || socket !== current) return;
          if (connectTimer !== undefined) clearTimeout(connectTimer);
          connectTimer = undefined;
          ping(); pingTimer = setInterval(ping, 2_000);
        };
        current.onmessage = event => {
          if (typeof event.data !== 'string') return;
          dispatch(() => {
            if (cancelled || finished || socket !== current) return;
            let parsed: AdminServerMonitorLiveEvent;
            try {
              const decoded: unknown = JSON.parse(event.data);
              if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) throw new TypeError('Invalid live event');
              watch();
              parsed = monitorLiveEventFromJson(decoded);
            } catch (error) { finish(error); return; }
            if (parsed.report !== null || parsed.latency_ms !== null) onEvent(parsed);
          });
        };
        current.onerror = event => dispatch(() => { if (socket === current) finish(event); });
        current.onclose = () => dispatch(() => { if (socket === current) finish(); });
      });
      const cancel = () => { if (!cancelled) { cancelled = true; pending.length = 0; clear(); close(); } };
      const resume = () => {
        if (cancelled || finished || pauseCount === 0) return;
        if (--pauseCount > 0) return;
        paused = false; watch();
        while (!paused && !cancelled && !finished && pending.length) pending.shift()!();
      };
      return Object.assign(cancel, {
        pause: (resumeSignal?: Promise<unknown>) => {
          if (cancelled || finished) return;
          pauseCount++;
          if (!paused) { paused = true; watch(); }
          if (resumeSignal) void resumeSignal.then(resume, resume);
        },
        resume,
      });
    },
  };
}
