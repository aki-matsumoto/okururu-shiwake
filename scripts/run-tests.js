#!/usr/bin/env node
'use strict';
// 全テストを node のみで実行（CI 用、依存なし）
const { execSync } = require('child_process');
const path = require('path');
try {
  execSync('node ' + JSON.stringify(path.resolve(__dirname, '..', 'tests', 'brand_detect.test.js')), { stdio: 'inherit' });
} catch (e) { process.exit(1); }
