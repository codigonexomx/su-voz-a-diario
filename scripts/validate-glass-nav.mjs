import assert from 'node:assert/strict';
import { harness } from './audit-bottom-nav.mjs';

const settle = h => { for (let i = 0; i < 180; i++) h.tick(); };
const start = () => {
    const h = harness();
    h.app.bindGlassNavIndicatorGeometry(); h.tick(); h.tick();
    h.app.currentView = 'stats'; h.app.updateGlassNavIndicator({ animate: true });
    for (let i = 0; i < 6; i++) h.tick();
    return h;
};

for (const animate of [false, true]) {
    const h = start(), before = h.x();
    h.app.updateGlassNavIndicator({ animate });
    assert.equal(h.x(), before, 'Measurement/same button must preserve in-flight position');
    settle(h); assert.equal(h.x(), 334); assert.equal(h.pending(), 0);
}
{
    const h = start(), before = h.x();
    h.buttons[0].pointerdown();
    assert.equal(h.x(), before, 'Pointerdown must not place indicator');
    h.app.currentView = 'home'; h.app.updateGlassNavIndicator({ animate: true });
    assert.equal(h.x(), before, 'Reversal starts at current position');
    h.tick(); assert.ok(Math.abs(h.x() - before) < 35, 'Reversal remains continuous');
    settle(h); assert.equal(h.x(), 46);
}
{
    const h = start();
    for (const view of ['bible', 'stats', 'calendar', 'home', 'community']) {
        const before = h.x(); h.app.currentView = view;
        h.app.scheduleGlassNavIndicatorUpdate({ animate: true });
        h.app.scheduleGlassNavIndicatorUpdate({ animate: false });
        h.tick();
        assert.ok(Math.abs(h.x() - before) < 35, 'Rapid changes do not teleport');
    }
    settle(h); assert.equal(h.x(), 262); assert.equal(h.pending(), 0);
}
{
    const h = start(), before = h.x();
    h.nav.clientWidth = 328;
    h.buttons.forEach((b, i) => { b.offsetLeft = 10 + i * 62; b.offsetWidth = 62; });
    h.app.updateGlassNavIndicator({ animate: false });
    assert.equal(h.x(), before, 'Resize retargets from visible position');
    settle(h); assert.equal(h.x(), 289);
}
{
    const h = start();
    h.app._glassNavReducedMotionMedia = { matches: true };
    h.app.updateGlassNavIndicator({ animate: true });
    assert.equal(h.x(), 334); assert.equal(h.pending(), 0, 'Reduced motion cancels animation');
}
const positions = [];
for (const hz of [20, 30, 60, 120]) {
    const h = harness(); h.app.currentView = 'stats'; h.app.updateGlassNavIndicator({ animate: true });
    for (let i = 0; i < hz / 2; i++) h.tick(1000 / hz);
    positions.push(h.x()); settle(h); assert.equal(h.x(), 334);
}
assert.ok(Math.max(...positions) - Math.min(...positions) < 0.01, 'Spring trajectory is frame-rate independent');
console.log('Glass navigation: rapid clicks, same button, reversal, resize, reduced motion and 20–120 Hz: OK');
