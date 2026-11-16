const s = require('./adminUsersSupport.cjs');
const strict = s.load('shared/camera/synchronousGuard'), model = s.load('admin/adminTopNoticeModel');
const messenger = s.load('admin/adminTopNoticeMessenger', { '../shared/camera/synchronousGuard': strict });
const service = s.load('admin/adminTopNoticeService', { './adminTopNoticeMessenger': messenger, './adminTopNoticeModel': model });
function fixture(extra = {}) {
  const clock = s.scheduler(), runtime = new service.AdminTopNoticeService({ setTimer: clock.set, clearTimer: clock.clear }); let current = true;
  const target = new messenger.AdminTopNoticeMessenger({ isCurrent: () => current, ...extra }), driver = {}, scaffoldIdentity = {};
  const scaffold = target.createScaffold(scaffoldIdentity, null); let stopDriver, stopScaffold;
  const mount = (accessible = false) => { stopDriver = target.attachDriver(driver, accessible); stopScaffold = target.attachScaffold(scaffold); };
  const show = (message, tone = 'success') => runtime.show(target, { message, tone });
  const complete = () => target.completeTransition(driver, target.getSnapshot().transition);
  return { clock, runtime, target, driver, scaffold, mount, show, complete, current: value => { current = value; }, stopDriver: () => stopDriver?.(), stopScaffold: () => stopScaffold?.() };
}
module.exports = { ...s, strict, noticeModel: model, messenger, service, fixture };
