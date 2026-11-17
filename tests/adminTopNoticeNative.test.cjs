const assert = require('node:assert/strict'), test = require('node:test');
const s = require('./adminTopNoticeNativeSupport.cjs');
const inline = tree => s.nodes(tree, node => node.props.testID === 'admin-top-notice-inline')[0];
const measured = tree => s.nodes(tree, node => typeof node.props.onLayout === 'function')[0];
function mounted(platform = 'android', accessible = false) { const f = s.fixture(platform, accessible); f.render(); const host = f.makeHost(null); host.render(); return { ...f, host }; }

test('actual Provider and original registered Scaffold are both required; hook has no default provider/ancestor/accessibility state', () => {
  const f = s.fixture(); assert.throws(() => f.provider.useAdminTopNoticeTarget(), /genuine AdminTopNoticeProvider/); assert.equal(f.show('no provider'), null);
  f.render(); assert.equal(f.show('no Scaffold'), null); const host = f.makeHost(undefined); host.render(); assert.equal(host.binding.ticket, null); assert.equal(f.show('missing actual Source ancestor'), null);
  f.accessible(undefined); assert.throws(f.render, /Actual platform accessible-navigation/); f.cleanup();
});
test('a duplicate actual Provider cannot publish a second progress/context or render children when its original driver lease was rejected', async () => {
  const f = mounted(); f.show('single coordinator'); f.render(); const original = f.provider.useAdminTopNoticeTarget(), animations = f.animations.length, duplicate = f.makeDuplicateProvider();
  assert.equal(duplicate.render(), null); assert.equal(duplicate.stats.mountedChildren, 0); assert.equal(f.provider.useAdminTopNoticeTarget(), original); assert.equal(f.animations.length, animations);
  duplicate.runtime.unmount(); await s.flush(); assert.equal(f.target.current(), true); f.finish(); f.ack(); assert.equal(f.target.getSnapshot().phase, 'visible'); f.cleanup();
});
test('native linear250 controller and real finished callback own queue completion; a canceled animation or five-second clock cannot acknowledge', () => {
  const f = mounted(); const shown = f.show('native transition'); f.render(); assert.equal(f.animations.at(-1).options.duration, 250); assert.equal(f.animations.at(-1).options.easing, s.Easing.linear);
  f.finish(undefined, false); f.ack(); assert.equal(f.target.getSnapshot().phase, 'entering'); f.clock.advance(5000); f.render(); assert.equal(f.target.getSnapshot().head, shown.banner);
  f.finish(); assert.equal(f.target.getSnapshot().head, shown.banner); f.ack(); assert.equal(f.target.getSnapshot().head, null); f.cleanup();
});
test('Source reverse duration follows actual remaining linear progress, not a new full250ms or eased-height fraction', () => {
  const f = mounted(); f.show('reverse'); f.render(); f.values[0].value = .4; f.target.hideCurrent(); f.render(); assert.equal(f.animations.at(-1).target, 0); assert.equal(f.animations.at(-1).options.duration, 100);
  f.finish(); f.ack(); assert.equal(f.target.getSnapshot().head, null); f.cleanup();
});
test('a queued old real-finished callback after StrictMode effect replay cannot settle the new native run', async () => {
  const f = mounted(); f.show('replay'); f.render(); const original = f.animations.at(-1); f.finish(original); f.r.replay(); f.ack(); await s.flush();
  assert.equal(f.target.getSnapshot().retired, false); assert.equal(f.target.getSnapshot().phase, 'entering'); assert.notEqual(f.animations.at(-1), original); f.finish(); f.ack(); assert.equal(f.target.getSnapshot().phase, 'visible'); f.cleanup();
});
test('old actual native completions after original account retirement cannot advance or revive text in another target', () => {
  const f = mounted(); f.show('original'); f.render(); const original = f.animations.at(-1); f.current(false); f.finish(original); f.ack(); assert.equal(f.target.getSnapshot().retired, true); assert.equal(f.host.render(), null); f.cleanup();
});
for (const platform of ['android', 'ios']) {
  test(`${platform} actual inline host consumes measured Source height below header and uses fastOutSlowIn bottom-aligned clipping with real L/R SafeArea`, () => {
    const f = mounted(platform); f.host.insets = { left: 11, right: 23 }; f.show('multiline\nresolved'); f.render(); let tree = f.host.render(); assert.equal(s.flattenStyle(inline(tree).props.style).height, 0);
    measured(tree).props.onLayout({ nativeEvent: { layout: { height: 64 } } }); f.values[0].value = .5; tree = f.host.render(); const style = s.flattenStyle(inline(tree).props.style), body = s.flattenStyle(measured(tree).props.style);
    assert.ok(Math.abs(style.height - 64 * .77556131) < .0001); assert.equal(style.position, undefined); assert.equal(style.overflow, 'hidden'); assert.equal(style.flexShrink, 0);
    assert.equal(body.position, 'absolute'); assert.equal(body.bottom, 0); assert.equal(body.left, 11); assert.equal(body.right, 23); assert.equal(inline(tree).props.accessibilityLiveRegion, 'polite'); assert.equal(inline(tree).props.accessibilityLabel, 'multiline\nresolved');
    f.cleanup();
  });
  test(`${platform} Source success/error colors, native row16/12, frozen raw text, optional24 icon and transparent empty16 action space remain genuine`, () => {
    const f = mounted(platform), shown = f.runtime.show(f.target, { message: ' raw\nmessage ', tone: 'error', icon: { androidSource: 7, iosSystemName: 'exclamationmark.triangle' } }); f.render(); const tree = f.host.render();
    const message = s.nodes(tree, node => node.type === (platform === 'android' ? 'RNText' : 'Text'))[0]; assert.equal(message.props.children, shown.banner.message);
    if (platform === 'android') {
      assert.equal(message.props.maxFontSizeMultiplier, 1.5); const style = s.flattenStyle(message.props.style); assert.equal(style.fontFamily, 'ActualRegisteredAdminRegular'); assert.equal(style.fontSize, 14); assert.equal(style.lineHeight, 20); assert.equal(style.color, '#5F1412');
      const surface = s.nodes(tree, node => node.type === 'Surface')[0], row = s.nodes(tree, node => node.type === 'Row')[0], icon = s.nodes(tree, node => node.type === 'Icon')[0];
      assert.equal(surface.props.color, '#FCE8E6'); assert.equal(surface.props.shadowElevation, 0); assert.deepEqual(row.props.modifiers.find(value => value.name === 'padding').args, [16, 12, 16, 12]); assert.equal(icon.props.source, 7); assert.equal(icon.props.size, 24); assert.equal(icon.props.tint, '#111111');
    } else {
      const row = s.nodes(tree, node => node.type === 'HStack')[0], icon = s.nodes(tree, node => node.type === 'Image')[0]; assert.equal(row.props.modifiers.find(value => value.name === 'background').args[0], '#FCE8E6'); assert.deepEqual(row.props.modifiers.find(value => value.name === 'padding').args[0], { leading: 16, top: 12, trailing: 16, bottom: 12 });
      assert.equal(icon.props.systemName, 'exclamationmark.triangle'); assert.equal(icon.props.size, 24); assert.ok(icon.props.modifiers.some(value => value.name === 'accessibilityHidden' && value.args[0])); assert.ok(message.props.modifiers.some(value => value.name === 'font' && value.args[0].textStyle === 'subheadline'));
    }
    const spaces = s.nodes(tree, node => node.type === 'Spacer'); assert.equal(spaces.length, 2); assert.deepEqual(s.noticeModel.adminTopNoticeColors('success'), { background: '#E6F4EA', foreground: '#173A24' }); f.cleanup();
  });
  test(`${platform} unknown original-window geometry retains SAME banner/native text lifetime, hides semantics, and fences queued layout/dismiss until fresh known geometry`, async () => {
    const f = mounted(platform, true), shown = f.show('original native text'); f.host.insets = { left: 11, right: 23, width: 400 }; f.render(); let tree = f.host.render();
    const oldLayout = measured(tree).props.onLayout, oldDismiss = inline(tree).props.onAccessibilityAction; oldLayout({ nativeEvent: { layout: { height: 64, width: 366 } } }); assert.equal(s.flattenStyle(inline(f.host.render()).props.style).height, 64);
    f.host.insets = null; tree = f.host.render(); const writes = f.host.runtime.counters.writes; assert.equal(s.flattenStyle(inline(tree).props.style).height, 0); assert.equal(inline(tree).props.pointerEvents, 'none'); assert.equal(inline(tree).props.accessibilityLiveRegion, 'none'); assert.equal(inline(tree).props.importantForAccessibility, 'no-hide-descendants');
    assert.equal(s.nodes(tree, node => node.type === (platform === 'android' ? 'RNText' : 'Text'))[0].props.children, shown.banner.message);
    oldLayout({ nativeEvent: { layout: { height: 80, width: 366 } } }); oldDismiss({ nativeEvent: { actionName: 'dismiss' } }); measured(tree).props.onLayout({ nativeEvent: { layout: { height: 80, width: 366 } } });
    await s.flush(); assert.equal(f.host.runtime.counters.writes, writes); assert.equal(f.target.getSnapshot().head, shown.banner); assert.equal(shown.isClosed(), false); assert.equal(f.clock.size(), 1);
    f.host.insets = { left: 11, right: 23, width: 400 }; tree = f.host.render(); assert.equal(s.flattenStyle(inline(tree).props.style).height, 0); oldLayout({ nativeEvent: { layout: { height: 99, width: 366 } } }); assert.equal(f.host.runtime.counters.writes, writes);
    measured(tree).props.onLayout({ nativeEvent: { layout: { height: 56, width: 366 } } }); assert.equal(s.flattenStyle(inline(f.host.render()).props.style).height, 56); assert.equal(f.target.getSnapshot().head, shown.banner); f.cleanup();
  });
}
test('accessible-navigation host immediately consumes full measured height; semantic remove affects only exact original Messenger head', () => {
  const f = mounted('android', true); f.show('accessible'); f.render(); let tree = f.host.render(); measured(tree).props.onLayout({ nativeEvent: { layout: { height: 44 } } }); tree = f.host.render(); assert.equal(s.flattenStyle(inline(tree).props.style).height, 44);
  const old = inline(tree).props.onAccessibilityAction; old({ nativeEvent: { actionName: 'dismiss' } }); assert.equal(f.target.getSnapshot().head, null);
  const next = f.show('new'); old({ nativeEvent: { actionName: 'dismiss' } }); assert.equal(f.target.getSnapshot().head, next.banner); f.cleanup();
});
test('actual text-instance unmount abandons global latest without hiding a sibling root; stale measurement cannot write', async () => {
  const f = mounted(); const second = f.makeHost(null); second.render(); const shown = f.show('shared roots'); f.render(); const tree = f.host.render(); second.render(); const layout = measured(tree).props.onLayout, dismiss = inline(tree).props.onAccessibilityAction, writes = f.host.runtime.counters.writes;
  f.host.runtime.unmount(); layout({ nativeEvent: { layout: { height: 70 } } }); dismiss({ nativeEvent: { actionName: 'dismiss' } }); assert.equal(f.host.runtime.counters.writes, writes); assert.equal(f.target.getSnapshot().head, shown.banner); await s.flush();
  assert.equal(shown.isClosed(), true); assert.equal(f.clock.size(), 0); assert.equal(f.target.getSnapshot().head, shown.banner); assert.equal(second.binding.messenger.bannerFor(second.binding.ticket), shown.banner); f.cleanup();
});
test('a new banner cannot reuse the prior measured height or an old layout callback, while same-banner real inset relayout remains valid', () => {
  const f = mounted('android', true); f.show('first'); f.render(); let tree = f.host.render(); const old = measured(tree).props.onLayout;
  old({ nativeEvent: { layout: { height: 90 } } }); tree = f.host.render(); assert.equal(s.flattenStyle(inline(tree).props.style).height, 90);
  const next = f.show('second'); f.render(); tree = f.host.render(); assert.equal(s.flattenStyle(inline(tree).props.style).height, 0); const writes = f.host.runtime.counters.writes;
  old({ nativeEvent: { layout: { height: 150 } } }); assert.equal(f.host.runtime.counters.writes, writes); measured(tree).props.onLayout({ nativeEvent: { layout: { height: 44 } } }); f.host.insets = { left: 20, right: 10 }; tree = f.host.render();
  assert.equal(s.flattenStyle(inline(tree).props.style).height, 0); assert.equal(f.target.getSnapshot().head, next.banner); assert.equal(s.flattenStyle(measured(tree).props.style).left, 20);
  measured(tree).props.onLayout({ nativeEvent: { layout: { height: 56 } } }); assert.equal(s.flattenStyle(inline(f.host.render()).props.style).height, 56); f.cleanup();
});
test('unknown real inline SafeArea retains hidden original native content while malformed values remain rejected; no Modal/overlay carrier is created', () => {
  const f = mounted(); const shown = f.show('no fake geometry'); f.render(); f.host.insets = null; const held = f.host.render(); assert.equal(inline(held).props.pointerEvents, 'none'); assert.equal(inline(held).props.accessibilityElementsHidden, true); assert.equal(f.target.getSnapshot().head, shown.banner);
  f.host.insets = { left: NaN, right: 0 }; assert.throws(() => f.host.render(), /Actual inline banner SafeArea/); f.host.insets = { left: 0, right: 0 }; const tree = f.host.render();
  assert.equal(s.nodes(tree, node => ['Modal', 'BottomSheet', 'ModalBottomSheet', 'SnackbarHost'].includes(node.type)).length, 0); f.cleanup();
});
test('Android Source start alignment follows actual theme direction rather than system-language or first strong character guesses', () => {
  const f = mounted(); f.show('Latin source fallback'); f.render();
  for (const [direction, textAlign, writingDirection] of [['leftToRight', 'left', 'ltr'], ['rightToLeft', 'right', 'rtl']]) {
    f.host.theme.direction = direction; const tree = f.host.render(), text = s.nodes(tree, node => node.type === 'RNText')[0], style = s.flattenStyle(text.props.style);
    assert.equal(style.textAlign, textAlign); assert.equal(style.writingDirection, writingDirection); assert.equal(text.props.children, 'Latin source fallback');
  }
  f.cleanup();
});
test('same-inset real viewport width changes invalidate old height and reject clearly stale native widths while allowing documented fractional native rounding', () => {
  const f = mounted('android', true); f.host.insets = { left: 11.636363636, right: 23.272727273, width: 400 }; f.show('width changes with same actual insets'); f.render(); let tree = f.host.render();
  measured(tree).props.onLayout({ nativeEvent: { layout: { height: 64, width: 365.5 } } }); assert.equal(s.flattenStyle(inline(f.host.render()).props.style).height, 64);
  f.host.insets = { ...f.host.insets, width: 600 }; tree = f.host.render(); assert.equal(s.flattenStyle(inline(tree).props.style).height, 0); const writes = f.host.runtime.counters.writes;
  for (const width of [365.5, NaN, undefined, 0]) measured(tree).props.onLayout({ nativeEvent: { layout: { height: 99, width } } }); assert.equal(f.host.runtime.counters.writes, writes);
  measured(tree).props.onLayout({ nativeEvent: { layout: { height: 44, width: 565.75 } } }); assert.equal(s.flattenStyle(inline(f.host.render()).props.style).height, 44); f.cleanup();
});
test('reentrant original Messenger callback changing committed inset version cannot publish the old native measurement after its guard', () => {
  const f = mounted('android', true); f.host.insets = { left: 11, right: 23, width: 400 }; const shown = f.show('retained original banner'); f.render(); let tree = f.host.render(), once = true;
  const old = measured(tree).props.onLayout, original = f.target.bannerFor.bind(f.target), writes = f.host.runtime.counters.writes;
  f.target.bannerFor = ticket => { if (once) { once = false; f.host.insets = { left: 20, right: 10, width: 500 }; f.host.render(); } return original(ticket); };
  old({ nativeEvent: { layout: { height: 88, width: 366 } } }); assert.equal(f.host.runtime.counters.writes, writes); assert.equal(f.target.getSnapshot().head, shown.banner); tree = f.host.render(); assert.equal(s.flattenStyle(inline(tree).props.style).height, 0);
  measured(tree).props.onLayout({ nativeEvent: { layout: { height: 48, width: 470 } } }); assert.equal(s.flattenStyle(inline(f.host.render()).props.style).height, 48); f.cleanup();
});
