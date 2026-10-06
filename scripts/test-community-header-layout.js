const overlaps = (a, b) => Math.min(a.right, b.right) > Math.max(a.left, b.left) + 1
    && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 1;

async function checkLayout() {
    await document.fonts.ready;
    const copy = document.querySelector('.community-hero-copy').getBoundingClientRect();
    const actions = document.querySelector('.community-hero-actions').getBoundingClientRect();
    const hero = document.querySelector('.community-hero').getBoundingClientRect();
    const buttons = [...document.querySelectorAll('.community-hero-actions button')]
        .map(button => button.getBoundingClientRect());
    const failures = [];
    if (actions.top < copy.bottom + 1) failures.push('copy/actions not separated');
    if (buttons.some(button => button.left < hero.left - 1 || button.right > hero.right + 1)) {
        failures.push('control outside header');
    }
    if (buttons.some((button, index) => buttons.slice(index + 1).some(other => overlaps(button, other)))) {
        failures.push('controls overlap');
    }
    if (document.documentElement.scrollWidth > innerWidth) failures.push('horizontal overflow');
    document.getElementById('qa-result').textContent = failures.length
        ? `FAIL: ${failures.join('; ')}`
        : 'PASS: texto separado, controles visibles y sin solapamientos.';
    document.getElementById('qa-details').textContent = [
        `Viewport ${innerWidth} px`,
        `Texto ${Math.round(copy.width)} px`,
        `Separacion ${Math.round(actions.top - copy.bottom)} px`,
        `Controles ${buttons.length}`,
    ].join(' / ');
}

checkLayout();
window.addEventListener('resize', checkLayout);
