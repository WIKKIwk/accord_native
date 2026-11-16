const s = require('./adminTopNoticeSupport.cjs');
const model = s.load('admin/adminFixedSnackBarModel'), geometry = s.load('admin/adminFixedSnackBarGeometry');
const controller = s.load('admin/adminFixedSnackBarController', { '../shared/camera/synchronousGuard': s.strict, './adminFixedSnackBarModel': model, './adminFixedSnackBarGeometry': geometry });
const runtime = s.load('admin/adminFixedSnackBarRuntime', { './adminFixedSnackBarController': controller });
function pair(window = {}, patch = {}) {
  return { window: { identity: window, viewport: { x: 0, y: 0, width: 400, height: 800 }, rawImeBottom: 0 }, host: { windowIdentity: window, frame: { x: 0, y: 0, width: 400, height: 800 } },
    dock: { windowIdentity: window, height: 199 }, remainingSafeArea: { left: 11, right: 23, bottom: 0 }, ...patch };
}
function fixture(options = {}) {
  const source = s.fixture(); if (options.sourceMounted !== false) source.mount(options.accessible ?? false); else source.target.attachDriver(source.driver, options.accessible ?? false);
  const clock = s.scheduler(), queue = new controller.AdminFixedSnackBarController({ messenger: source.target, setTimer: clock.set, clearTimer: clock.clear, ...options.timers }), driver = {}, stopDriver = options.driver === false ? null : queue.attachDriver(driver);
  let current = true, top = true; const host = queue.createHost({ identity: {}, scaffold: source.scaffold, isCurrent: () => current, canInteract: () => top }), stopHost = queue.attachHost(host), window = {};
  const facts = pair(window); if (options.geometry !== false) queue.setGeometry(host, facts);
  const show = (message, identity = {}) => queue.enqueue({ identity, message }), finish = () => queue.completeTransition(driver, queue.getSnapshot().transition), build = () => queue.startDisplayTimer(driver, queue.getSnapshot().head);
  const cleanup = () => { stopHost?.(); stopDriver?.(); queue.retire(); source.target.retire(); };
  return { ...source, clock, queue, driver, host, window, facts, show, finish, build, stopHost, stopDriver, cleanup, hostCurrent: value => { current = value; }, top: value => { top = value; } };
}
module.exports = { ...s, fixedModel: model, geometry, controller, runtime, fixture, pair };
