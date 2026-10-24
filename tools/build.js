#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'NodeSeek Issue Templates.user.js');
const minifiedOutput = path.join(root, 'NodeSeek Issue Templates.min.user.js');
const sourceDir = path.join(root, 'src');
const assetDir = path.join(root, 'assets', 'vendors');
const parts = ['config.js', 'ui.js', 'logic.js', 'image-upload.js', 'toolbar.js', 'auto-tasks.js', 'author-info.js', 'threaded.js', 'home-feed.js', 'background.js', 'sticky-header.js', 'main.js'];
const start = "(function () {\n  'use strict';\n\n";
const mimeTypes = { svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content.replace(/\n*$/, '\n'));
}

function buildReadable() {
  const header = read(path.join(sourceDir, 'header.txt')).trimEnd();
  const inlineAsset = (directory, file) => {
    const asset = path.join(directory, file);
    const extension = path.extname(file).slice(1);
    const mime = mimeTypes[extension] || 'image/x-icon';
    return JSON.stringify(`data:${mime};base64,${fs.readFileSync(asset).toString('base64')}`);
  };
  const body = parts.map((part) => read(path.join(sourceDir, part)).trim()).join('\n\n')
    .replace(/__NSIT_VENDOR_ASSET__\('([^']+)'\)/g, (_, file) => inlineAsset(assetDir, file));
  write(output, `${header}\n\n${start}${body}\n})();`);
}

async function build() {
  buildReadable();
  const source = read(output);
  const headerEnd = source.indexOf('// ==/UserScript==') + '// ==/UserScript=='.length;
  if (headerEnd < '// ==/UserScript=='.length) throw new Error('无法识别 userscript 元数据。');
  const { minify } = require('terser');
  const result = await minify(source.slice(headerEnd), {
    compress: { passes: 2 },
    mangle: true,
    format: { comments: false },
  });
  if (!result.code) throw new Error('压缩 userscript 失败。');
  write(minifiedOutput, `${source.slice(0, headerEnd)}\n\n${result.code}`);
}

const command = process.argv[2];
if (command === 'build') build().catch((error) => { console.error(error); process.exitCode = 1; });
else throw new Error('用法：node tools/build.js build');
