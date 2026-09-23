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

// Liquid deformation must stay inside the capsule, follow actual velocity,
// and disappear completely at rest or when reduced motion is requested.
{
    const h = harness(), css = {};
    h.nav.style.setProperty = (key, value) => { css[key] = value; };
    let sawRight = false, sawLeft = false;
    for (const view of ['stats', 'home', 'community', 'bible']) {
        h.app.currentView = view;
        h.app.updateGlassNavIndicator({ animate: true });
        for (let i = 0; i < 80; i++) {
            h.tick();
            const flow = Number(css['--nav-water-flow']);
            sawRight ||= flow > 0.1; sawLeft ||= flow < -0.1;
            const radius = Number.parseFloat(css['--nav-glass-width']) * Number(css['--nav-glass-scale-x']) / 2;
            assert.ok(h.x() - radius >= 1.95 && h.x() + radius <= h.nav.clientWidth - 1.95, 'Liquid stays inside nav');
            assert.ok(Number(css['--nav-glass-scale-y']) >= 0.86, 'Liquid remains readable');
        }
        assert.equal(Number(css['--nav-water-energy']), 0, 'Liquid settles without an idle loop');
    }
    assert.ok(sawRight && sawLeft, 'Liquid follows both travel directions');
    h.app.currentView = 'stats'; h.app.updateGlassNavIndicator({ animate: true }); h.tick();
    h.app._glassNavReducedMotionMedia = { matches: true };
    h.app.updateGlassNavIndicator({ animate: true });
    assert.equal(Number(css['--nav-water-energy']), 0);
    assert.equal(Number(css['--nav-glass-scale-x']), 1);
    assert.equal(h.pending(), 0);
}
console.log('Liquid lens: containment, direction, rest and reduced motion: OK');

{
    const h = harness(), shapes = {};
    const indicator = { querySelector: selector => ({setAttribute(key, value) { (shapes[selector] ||= {})[key] = value; }}) };
    h.nav.querySelector = () => indicator;
    let separated = false;
    for (const view of ['stats', 'home', 'stats', 'bible']) {
        h.app.currentView = view; h.app.updateGlassNavIndicator({animate:true});
        for (let i=0;i<90;i++) {
            h.tick();
            const body = shapes['[data-water-body]'];
            for (const name of ['tail','drop']) {
                const dot = shapes[`[data-water-${name}]`], r = Number(dot.r), x = Number(dot.cx);
                assert.ok(h.x() + x - 70 - r >= 3.99, 'Droplet clears left edge');
                assert.ok(h.x() + x - 70 + r <= h.nav.clientWidth - 3.99, 'Droplet clears right edge');
                if (r > 2 && (x+r < Number(body.x) || x-r > Number(body.x)+Number(body.width))) separated = true;
            }
        }
        assert.equal(Number(shapes['[data-water-tail]'].r),0);
        assert.equal(Number(shapes['[data-water-drop]'].r),0);
        assert.equal(Number(shapes['[data-water-body]'].rx),14);
        assert.ok(Number(shapes['[data-water-body]'].width)<=54,'Compact resting shape');
    }
    assert.ok(separated,'Travel produces distinct droplets, not just a stretched oval');
}
console.log('Metaballs: real separation, edge clearance and complete reunion: OK');
