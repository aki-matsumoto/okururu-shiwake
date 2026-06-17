#!/usr/bin/env node
/**
 * scripts/update-release-feed.js — manifest.json + CHANGELOG.md から release/latest.json 生成。
 * CI の tag-release から呼ばれ main に push。s7 update-notifier が読む。
 * 既存 latest.json に force_min_version があれば引き継ぐ（手動設定を保持）。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(ROOT, 'manifest.json');
const CHANGELOG = path.join(ROOT, 'CHANGELOG.md');
const OUT = path.join(ROOT, 'release', 'latest.json');
const REPO_SLUG = 'aki-matsumoto/okururu-shiwake';
function getVersion() { return JSON.parse(fs.readFileSync(MANIFEST, 'utf8')).version; }
function extractChangelogSection(version) {
  let raw; try { raw = fs.readFileSync(CHANGELOG, 'utf8'); } catch (e) { return null; }
  const re = new RegExp('^##\\s*\\[' + version.replace(/\./g, '\\.') + '\\]([^\\n]*)$', 'm');
  const m = raw.match(re); if (!m) return null;
  const after = raw.slice(m.index + m[0].length);
  const endMatch = after.match(/\n##\s*\[|\n---\n/);
  const body = endMatch ? after.slice(0, endMatch.index) : after;
  const bullets = [];
  let inSub = false;
  for (const ln of body.split('\n')) {
    if (/^###\s+/.test(ln)) { inSub = true; continue; }
    if (inSub && /^\s*-\s+/.test(ln)) { const t = ln.replace(/^\s*-\s+/, '').replace(/\*\*/g, '').trim(); if (t) bullets.push(t); }
  }
  const message = bullets.length ? bullets.join(' / ').slice(0, 200) : 'リリース v' + version;
  return { title: 'Release v' + version, message };
}
function build() {
  const version = getVersion();
  const section = extractChangelogSection(version) || { title: 'Release v' + version, message: 'リリース v' + version };
  let force = '0.0.0';
  try { const prev = JSON.parse(fs.readFileSync(OUT, 'utf8')); if (prev && prev.force_min_version) force = prev.force_min_version; } catch (e) { /* noop */ }
  return {
    version, title: section.title, force_min_version: force, message: section.message,
    min_version: '0.0.0', released_at: new Date().toISOString(),
    notes_url: 'https://github.com/' + REPO_SLUG + '/releases/tag/v' + version,
    zip_url: 'https://github.com/' + REPO_SLUG + '/archive/refs/tags/v' + version + '.zip'
  };
}
function main() {
  const checkOnly = process.argv.includes('--check');
  const out = build();
  const text = JSON.stringify(out, null, 2) + '\n';
  if (checkOnly) { process.stdout.write(text); return; }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  let prev = ''; try { prev = fs.readFileSync(OUT, 'utf8'); } catch (e) { /* noop */ }
  const strip = (s) => s.replace(/"released_at":\s*"[^"]+",?\s*/g, '');
  if (strip(prev) === strip(text)) { console.log('latest.json: no change (v' + out.version + ')'); return; }
  fs.writeFileSync(OUT, text, 'utf8');
  console.log('latest.json: updated to v' + out.version);
}
if (require.main === module) main();
module.exports = { build, extractChangelogSection };
