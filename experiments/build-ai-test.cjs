const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const header = `// ==UserScript==
// @name         NodeSeek auto AI test
// @namespace    https://github.com/wangjialiangsaa/NodeSeek_auto/experiments/ai-assistant
// @version      1.4.75
// @description  独立测试版：自定义 AI 接口、思考等级、连接测试与论坛阅读总结，可与 NodeSeek auto 稳定版同时使用。
// @author       wangjialiangsaa
// @homepageURL  https://github.com/wangjialiangsaa/NodeSeek_auto
// @match        https://www.nodeseek.com/*
// @match        https://nodeseek.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @connect      *
// @run-at       document-idle
// @noframes
// ==/UserScript==`;

const source = ['ai-core.js', 'ai-assistant.js'].map(file => fs.readFileSync(path.join(root, 'ai-assistant', file), 'utf8').replace(/\r\n/g, '\n'));
const entry = `
  const aiTestController = installAiAssistant();
  if (typeof GM_registerMenuCommand === 'function') GM_registerMenuCommand('AI 助手设置（独立测试版）', () => aiTestController.openSettings());
`;
const target = path.join(root, 'NodeSeek-auto-AI-test.user.js');
fs.writeFileSync(target, `${header}\n\n(function () {\n  'use strict';\n${source.join('\n')}\n${entry}\n})();\n`, 'utf8');
console.log(path.relative(path.dirname(root), target));
