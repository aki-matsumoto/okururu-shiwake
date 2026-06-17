#!/usr/bin/env node
/**
 * scripts/build-zip.js — 配布用 zip を生成（okururu-shiwake-vX.Y.Z.zip）
 * 含める: manifest.json, background.js, content/, utils/, data/, popup/, styles/, README.md
 * OS標準 zip を使用（CI=ubuntu）。Windowsローカルは Compress-Archive 推奨。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const INCLUDE = ['manifest.json', 'background.js', 'README.md', 'content/', 'utils/', 'data/', 'popup/', 'styles/'];
function version() { return JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8')).version; }
function hasZip() { try { execSync('which zip', { stdio: 'ignore' }); return true; } catch (e) { return false; } }
(function () {
  const v = version();
  const distDir = path.join(ROOT, 'dist');
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
  const out = path.join(distDir, 'okururu-shiwake-v' + v + '.zip');
  if (!hasZip()) { console.error('zip not available'); process.exit(1); }
  if (fs.existsSync(out)) { try { fs.unlinkSync(out); } catch (e) { console.warn('既存zip削除不可（続行）:', e.code); } }
  const inc = INCLUDE.filter((p) => fs.existsSync(path.join(ROOT, p)));
  const cmd = 'cd ' + JSON.stringify(ROOT) + ' && zip -rq ' + JSON.stringify(out) + ' ' +
    inc.map((p) => JSON.stringify(p)).join(' ') + ' -x "*/.DS_Store" "*/Thumbs.db" "*.bak" "*.tmp"';
  execSync(cmd, { stdio: 'inherit' });
  console.log('✅ Built ' + out + ' (' + (fs.statSync(out).size / 1024).toFixed(1) + ' KB)');
})();
