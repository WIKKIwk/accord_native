const assert = require('node:assert/strict'), test = require('node:test');
const v = require('./adminItemDetailViewsSupport.cjs'), imageSupport = require('./adminItemDetailImageSupport.cjs');
const { s, nodes } = v;
const png = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4T8AAAAASUVORK5CYII=', 'base64'));
function fixture(t, platform = 'android', imageUrl) {
  const images = imageSupport.fixture(t), constructions = [];
  images.handler(async () => new Response(png, { headers: { 'cache-control': 'max-age=0', etag: 'original' } }));
  const view = v.fixture(platform, { session: images.session, witness: images.witness, detail: s.detail({ is_finished_goods: true, order_image_order_id: 'actual-order' }),
    imageProvider: (session, witness, current, url) => { assert.equal(session, images.session); assert.equal(witness, images.witness); const provider = images.provider(url, current); constructions.push(provider); return provider; } });
  const component = view.moduleFor('AdminItemDetailThumbnail.tsx').AdminItemDetailThumbnail;
  const renderThumbnail = context => view.render(view.jsx.jsx(component, { context, imageUrl, testID: 'actual-thumbnail' }));
  return { images, view, constructions, renderThumbnail };
}
test('native thumbnail uses genuine scoped shared provider bytes; decode—not download—drives the180ms fade', async t => {
  const { images, view } = fixture(t); view.renderRead(); await s.flush(); view.renderRead(); await s.flush(); let tree = view.renderDirty();
  assert.equal(images.calls.length, 1); const image = nodes(tree, node => node.type === 'NativeImage')[0]; assert.ok(image); assert.equal(image.props.resizeMode, 'cover'); assert.equal(image.props.source.uri, `data:image/png;base64,${Buffer.from(png).toString('base64')}`);
  assert.equal(view.calls.some(value => value[0] === 'fade'), false); image.props.onLoad(); tree = view.renderDirty(); assert.deepEqual(view.calls.find(value => value[0] === 'fade'), ['fade', 1, { duration: 180, easing: 'linear' }]);
  image.props.onError(); tree = view.renderDirty(); assert.equal(nodes(tree, node => node.type === 'NativeImage').length, 0); assert.equal(view.calls.filter(value => value[0] === 'fade').length, 1); view.cleanup(); await s.flush();
});
test('unversioned Source provider epoch changes only on a later actual parent rebuild, never an unsolicited timer or child decode-state update', async t => {
  const { images, view, constructions } = fixture(t); view.renderRead(); await s.flush(); view.renderRead(); await s.flush(); let tree = view.renderDirty(); const original = constructions.at(-1), decoded = nodes(tree, node => node.type === 'NativeImage')[0], count = constructions.length;
  images.advance(31_000); decoded.props.onLoad(); tree = view.renderDirty(); assert.equal(constructions.length, count); assert.equal(constructions.at(-1).key, original.key);
  view.renderRead(); await s.flush(); tree = view.renderDirty(); const next = constructions.at(-1); assert.notEqual(next.key, original.key); assert.equal(next.refreshEpoch, original.refreshEpoch + 1); assert.equal(images.calls.length, 2);
  const before = view.calls.filter(value => value[0] === 'fade').length; decoded.props.onLoad(); decoded.props.onError(); view.renderDirty(); assert.equal(view.calls.filter(value => value[0] === 'fade').length, before); assert.equal(nodes(view.tree(), node => node.type === 'NativeImage').length, 1); view.cleanup(); await s.flush();
});
test('versioned provider key stays immutable across rebuild-time30s boundaries and empty URL never starts a read', async t => {
  const { images, view, constructions, renderThumbnail } = fixture(t, 'ios', '/v1/mobile/calculate/orders/image/view?id=immutable'), context = { session: images.session, witness: images.witness, isCurrent: () => true };
  renderThumbnail(context); await s.flush(); view.renderDirty(); const original = constructions.at(-1); images.advance(31_000); renderThumbnail(context); await s.flush(); view.renderDirty(); assert.equal(constructions.at(-1).key, original.key); assert.equal(original.refreshEpoch, 0); assert.equal(images.calls.length, 1);
  view.cleanup(); await s.flush();
  const other = v.fixture('android'), component = other.moduleFor('AdminItemDetailThumbnail.tsx').AdminItemDetailThumbnail; const tree = other.render(other.jsx.jsx(component, { context: { session: other.session, witness: other.witness, isCurrent: () => true }, imageUrl: '', testID: 'empty' })); assert.equal(nodes(tree, node => node.type === 'NativeImage').length, 0); other.cleanup(); await s.flush();
});
test('original account/consumer retirement rejects late bytes and captured native decode callbacks while shared account cache remains genuine', async t => {
  const pending = s.deferred(), { images, view, constructions } = fixture(t); t.after(() => pending.resolve(new Response(png))); images.handler(() => pending.promise); view.renderRead(); await s.flush(); view.renderRead(); await s.flush(); assert.equal(images.calls.length, 1); const originalUrl = constructions.at(-1).url;
  view.current(false); view.notify(); view.renderRead(); pending.resolve(new Response(png, { headers: { 'cache-control': 'max-age=60' } })); await s.flush(); assert.equal(nodes(view.renderDirty(), node => node.type === 'NativeImage').length, 0);
  const actual = await images.provider(originalUrl, () => true).load(); assert.deepEqual(actual, png); assert.equal(images.calls.length, 1); view.cleanup(); await s.flush();
});
test('real thumbnail owner/bytes survive StrictMode replay; replay cannot duplicate the shared in-flight account download', async t => {
  const pending = s.deferred(), { images, view } = fixture(t); images.handler(() => pending.promise); view.renderRead(); await s.flush(); view.renderRead(); view.replay(); pending.resolve(new Response(png)); await s.flush(); const tree = view.renderRead(); await s.flush(); view.renderDirty(); assert.equal(images.calls.length, 1); assert.equal(nodes(view.tree(), node => node.type === 'NativeImage').length, 1); view.cleanup(); await s.flush();
});
