import assert from 'node:assert/strict';
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { languages: ['en'] } });
const { initMotion, projectOrientation } = await import('../js/motion.js');
const neutral = { alpha: 359, beta: 30, gamma: 0 };
assert.deepEqual(projectOrientation(neutral, neutral), { x: 0, y: 0, z: 0 });
const wrapped = projectOrientation({ alpha: 1, beta: 40, gamma: 0 }, neutral);
assert.ok(wrapped.y > 0 && wrapped.y < .02);
assert.ok(wrapped.x > 0 && wrapped.x < .24);
const landscape = projectOrientation({ ...neutral, beta: 40 }, neutral, 90);
assert.ok(Math.abs(landscape.x) < 1e-10 && landscape.z < 0);
assert.equal(projectOrientation({ ...neutral, beta: null }, neutral), null);
const extreme = projectOrientation({ alpha: 150, beta: -170, gamma: 90 }, neutral);
assert.ok(Math.abs(extreme.x) <= .24 && Math.abs(extreme.y) <= .25 && Math.abs(extreme.z) <= .24);

class Element extends EventTarget {
  textContent = '';
  disabled = false;
  attributes = {};
  setAttribute(name, value) { this.attributes[name] = value; }
  click() { this.dispatchEvent(new Event('click')); }
}

const timers = new Map();
let timerId = 0;
const orientation = Object.assign(new EventTarget(), { angle: 0 });
globalThis.window = Object.assign(new EventTarget(), {
  isSecureContext: true,
  DeviceOrientationEvent: class {},
  screen: { orientation },
  setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
  clearTimeout(id) { timers.delete(id); },
});
globalThis.document = Object.assign(new EventTarget(), { hidden: false });
const button = new Element();
const recenter = new Element();
const status = new Element();
const changes = [];
const control = initMotion({ button, recenter, status, onChange: value => changes.push(value) });
const emit = values => window.dispatchEvent(Object.assign(new Event('deviceorientation'), values));
button.click();
assert.equal(button.textContent, 'Motion on');
assert.equal(timers.size, 1);
emit({ alpha: 0, beta: null, gamma: 0 });
assert.equal(timers.size, 1);
emit(neutral);
assert.equal(timers.size, 0);
emit({ ...neutral, beta: 45 });
assert.ok(changes.at(-1).x > 0);
recenter.click();
emit({ ...neutral, beta: 45 });
assert.equal(changes.at(-1).x, 0);
document.hidden = true;
document.dispatchEvent(new Event('visibilitychange'));
const count = changes.length;
emit({ ...neutral, beta: 70 });
assert.equal(changes.length, count);
document.hidden = false;
document.dispatchEvent(new Event('visibilitychange'));
emit({ ...neutral, beta: 70 });
assert.equal(changes.at(-1).x, 0);
orientation.angle = 90;
orientation.dispatchEvent(new Event('change'));
emit(neutral);
emit({ ...neutral, beta: 45 });
assert.ok(changes.at(-1).z < 0);
button.click();
assert.equal(changes.at(-1), null);
assert.equal(timers.size, 0);
const stoppedCount = changes.length;
emit(neutral);
assert.equal(changes.length, stoppedCount);

let resolvePermission;
let permissionCalls = 0;
window.DeviceOrientationEvent.requestPermission = () => {
  permissionCalls++;
  return new Promise(resolve => { resolvePermission = resolve; });
};
button.click();
assert.equal(permissionCalls, 1);
assert.equal(button.textContent, 'Cancel motion');
button.click();
resolvePermission('granted');
await Promise.resolve();
assert.equal(button.textContent, 'Enable motion');
assert.equal(timers.size, 0);
button.click();
resolvePermission('denied');
await Promise.resolve();
assert.match(status.textContent, /not allowed/);
button.click();
resolvePermission('granted');
await Promise.resolve();
assert.equal(button.textContent, 'Motion on');
const timeout = [...timers.values()][0];
timeout();
assert.equal(button.textContent, 'Enable motion');
assert.match(status.textContent, /No motion data/);
window.isSecureContext = false;
button.click();
assert.match(status.textContent, /HTTPS/);
assert.equal(permissionCalls, 3);
control.destroy();
assert.equal(timers.size, 0);
console.log('Motion checks passed: projection, recenter, screen rotation, visibility, permission cancellation, denial, timeout, secure context and cleanup.');
