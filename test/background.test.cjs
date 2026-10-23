const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const file = path.join(__dirname, '../src/background.js');
const source = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
function helpers(t) {
  const dom = new JSDOM('<html><body></body></html>', { url: 'https://www.nodeseek.com/', runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  if (source) dom.window.eval(`${source}\nwindow.backgroundHelpers = { normalizeBackgroundSettings, backgroundPalette, backgroundAutoPosition, backgroundCrop };`);
  assert.ok(dom.window.backgroundHelpers, 'the background module exposes its actual settings and image calculations');
  return dom.window.backgroundHelpers;
}
function image(width, height, pixel) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const c = pixel(x, y); data.set([...c, 255], (y * width + x) * 4);
  }
  return { width, height, data };
}
// Independent WCAG calculation checks the final colors against BOTH extremes,
// rather than reproducing the implementation's average-image decision.
function luminance(rgb) {
  const linear = rgb.map(c => c / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
}
function rgb(hex) { return hex.match(/[0-9a-f]{2}/gi).map(c => parseInt(c, 16)); }
function contrast(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
function assertReadable(palette) {
  for (const value of [0, 255]) {
    const panel = palette.surface.map(c => c * palette.alpha + value * (1 - palette.alpha));
    for (const color of [palette.ink, palette.muted, palette.link]) {
      assert.ok(contrast(rgb(color), panel) >= 4.5, `${color} must remain readable over ${value === 0 ? 'black' : 'white'} image pixels`);
    }
  }
}

test('background settings accept image URLs but reject executable or credential URLs and clamp corrupt values', t => {
  const { normalizeBackgroundSettings: normalize } = helpers(t);
  for (const backgroundUrl of ['javascript:alert(1)', 'data:image/svg+xml,<svg/>', 'file:///C:/secret.png', 'https://user:pass@example.com/a.png', '//example.com/a.png']) {
    const s = normalize({ enabled: true, backgroundUrl });
    assert.equal(s.enabled, false);
    assert.equal(s.backgroundUrl, '');
  }
  const s = normalize({ enabled: true, backgroundUrl: ' https://cdn.example.com/image.webp?token=public ', blur: 100, opacity: -5, focusX: '92', focusY: NaN });
  assert.equal(s.enabled, true);
  assert.equal(s.backgroundUrl, 'https://cdn.example.com/image.webp?token=public');
  assert.equal(s.blur, 32);
  assert.equal(s.opacity, 35);
  assert.equal(s.focusX, 92);
  assert.equal(s.focusY, 50);
});

test('Bing UHD wallpaper thumbnail links load the original without rewriting other image hosts or assets', t => {
  const { normalizeBackgroundSettings: normalize } = helpers(t);
  const wallpaper = 'https://cn.bing.com/th?id=OHR.NaejangsanNP_EN-US7010419904_UHD.jpg&pid=hp';
  const thumbnail = wallpaper + '&w=384&h=216&rs=1&c=4';
  assert.equal(normalize({ enabled: true, backgroundUrl: thumbnail }).backgroundUrl, wallpaper);
  assert.equal(normalize({ enabled: true, backgroundUrl: wallpaper }).backgroundUrl, wallpaper);
  for (const url of [
    'https://cdn.example.com/photo.jpg?w=384&h=216&signature=keep',
    'https://cn.bing.com/th?id=some-other-image&w=384&h=216',
    'https://cn.bing.com.example.com/th?id=OHR.Example_UHD.jpg&w=384&h=216',
    'https://cn.bing.com/other?id=OHR.Example_UHD.jpg&w=384&h=216'
  ]) assert.equal(normalize({ enabled: true, backgroundUrl: url }).backgroundUrl, url);
});

test('bright and dark images choose opposite text palettes with readable primary, secondary and link text', t => {
  const { backgroundPalette } = helpers(t);
  const settings = { opacity: 35, autoContrast: true };
  const bright = backgroundPalette(image(8, 8, () => [255, 255, 255]), settings);
  const dark = backgroundPalette(image(8, 8, () => [0, 0, 0]), settings);
  assert.equal(bright.mode, 'light');
  assert.equal(dark.mode, 'dark');
  assert.notEqual(bright.ink, dark.ink);
  assertReadable(bright); assertReadable(dark);
});

test('mixed images and inaccessible pixel data always have a readable fallback, without assuming the average is every pixel', t => {
  const { backgroundPalette } = helpers(t);
  for (const sample of [null, image(16, 8, x => x < 8 ? [0, 0, 0] : [255, 255, 255])]) {
    const palette = backgroundPalette(sample, { opacity: 35, autoContrast: true });
    assertReadable(palette);
  }
  assert.equal(backgroundPalette(null, { opacity: 35, autoContrast: true }).mode, 'dark');
});

test('disabling automatic contrast follows the native light or dark theme while retaining sufficient contrast', t => {
  const { backgroundPalette } = helpers(t);
  const dark = backgroundPalette(image(4, 4, () => [255, 255, 255]), { opacity: 50, autoContrast: false }, null, true);
  const light = backgroundPalette(image(4, 4, () => [0, 0, 0]), { opacity: 50, autoContrast: false }, null, false);
  assert.equal(dark.mode, 'dark'); assert.equal(light.mode, 'light');
  assertReadable(dark); assertReadable(light);
});

test('cover crops follow the actual viewport aspect ratio and focus percentage rather than stretching the image', t => {
  const { backgroundCrop } = helpers(t);
  const portrait = backgroundCrop({ width: 2000, height: 1000 }, { width: 500, height: 1000 }, { x: 100, y: 50 });
  assert.equal(portrait.left, .75); assert.equal(portrait.width, .25);
  assert.equal(portrait.top, 0); assert.equal(portrait.height, 1);
  const landscape = backgroundCrop({ width: 1000, height: 2000 }, { width: 1000, height: 500 }, { x: 50, y: 0 });
  assert.equal(landscape.top, 0); assert.equal(landscape.height, .25);
  assert.equal(landscape.left, 0); assert.equal(landscape.width, 1);
});

test('automatic framing keeps a detailed subject inside a portrait crop and centers uniform images', t => {
  const { backgroundAutoPosition } = helpers(t);
  const sample = image(64, 32, (x, y) => x > 46 && x < 58 && y > 7 && y < 25 ? ((x + y) % 2 ? [255, 210, 30] : [20, 60, 220]) : [70, 70, 70]);
  const pos = backgroundAutoPosition(sample, { width: 2000, height: 1000 }, { width: 500, height: 1000 });
  assert.ok(pos.x >= 75, `subject on the right must be retained, got ${pos.x}`);
  assert.equal(pos.y, 50);
  const uniform = backgroundAutoPosition(image(32, 16, () => [200, 200, 200]), { width: 2000, height: 1000 }, { width: 500, height: 1000 });
  assert.equal(uniform.x, 50); assert.equal(uniform.y, 50);
});

test('contrast samples the visible cover crop so offscreen bright borders cannot flip a dark subject to dark text', t => {
  const { backgroundPalette } = helpers(t);
  const sample = image(32, 16, x => x < 24 ? [255, 255, 255] : [0, 0, 0]);
  const palette = backgroundPalette(sample, { opacity: 74, autoContrast: true }, { left: .75, top: 0, width: .25, height: 1 });
  assert.equal(palette.mode, 'dark'); assertReadable(palette);
});
