#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CORNERSTONE_URL = 'https://github.com/bigcommerce/cornerstone.git';
const LINK_TAG = `<link rel="stylesheet" href="{{cdn 'assets/tailwind/tailwind.css'}}"/>`;

const args = process.argv.slice(2);

function getArg(name) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const next = args[i + 1];
  return next && !next.startsWith('--') ? next : true;
}

function log(msg) { console.log(`\x1b[32m✔\x1b[0m ${msg}`); }
function skip(msg) { console.log(`\x1b[33m-\x1b[0m ${msg}`); }
function fail(msg) { console.error(`\x1b[31m✖ ${msg}\x1b[0m`); process.exit(1); }

function run(cmd, cmdArgs, cwd) {
  const res = spawnSync(cmd, cmdArgs, {
    cwd: cwd || process.cwd(),
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  if (res.status !== 0) fail(`Command failed: ${cmd} ${cmdArgs.join(' ')}`);
}

// ---- checks ----
const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
if (nodeMajor < 20) fail(`Node 20+ required. You have ${process.versions.node}`);

const targetArg = getArg('target');
if (!targetArg || targetArg === true) {
  fail(
    'Missing --target.\n' +
    '  Existing theme : npm run setup -- --target ../my-theme\n' +
    '  Fresh theme    : npm run setup:fresh -- --target ./my-new-theme'
  );
}

const target = path.resolve(process.cwd(), targetArg);
const fresh = args.includes('--fresh');
const noInstall = args.includes('--no-install');
const prefixArg = getArg('prefix');
const prefix = prefixArg && prefixArg !== true ? prefixArg : '';

// ---- fresh Cornerstone ----
if (fresh) {
  if (fs.existsSync(target) && fs.readdirSync(target).length > 0) {
    fail(`Target folder is not empty: ${target}`);
  }
  console.log('Cloning Cornerstone...');
  run('git', ['clone', '--depth', '1', CORNERSTONE_URL, target]);
  if (!args.includes('--keep-git')) {
    fs.rmSync(path.join(target, '.git'), { recursive: true, force: true });
    run('git', ['init'], target);
    log('Fresh git repo created (Cornerstone history removed)');
  }
}

// ---- validate theme ----
const pkgPath = path.join(target, 'package.json');
const basePath = path.join(target, 'templates', 'layout', 'base.html');

if (!fs.existsSync(pkgPath)) fail(`package.json not found in ${target}`);
if (!fs.existsSync(basePath)) fail(`templates/layout/base.html not found. Is this a Stencil theme?`);

// ---- 1. input css ----
const inputDir = path.join(target, 'assets', 'tailwind');
const inputFile = path.join(inputDir, 'tailwind-input.css');

if (fs.existsSync(inputFile)) {
  skip('assets/tailwind/tailwind-input.css already exists');
} else {
  fs.mkdirSync(inputDir, { recursive: true });
  const tpl = fs.readFileSync(path.join(ROOT, 'templates', 'tailwind-input.css'), 'utf8');
  fs.writeFileSync(inputFile, tpl.replace('{{PREFIX}}', prefix ? ` prefix(${prefix})` : ''));
  log('Created assets/tailwind/tailwind-input.css' + (prefix ? ` (prefix: ${prefix}:)` : ''));
}

// ---- 2. package.json ----
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.scripts = pkg.scripts || {};
pkg.devDependencies = pkg.devDependencies || {};
const S = pkg.scripts;

const IN = './assets/tailwind/tailwind-input.css';
const OUT = './assets/tailwind/tailwind.css';

S['tailwind:build'] = `npx @tailwindcss/cli -i ${IN} -o ${OUT} --minify`;
S['tailwind:watch'] = `npx @tailwindcss/cli -i ${IN} -o ${OUT} --watch`;

if (!S.postinstall) {
  S.postinstall = 'npm run tailwind:build';
} else if (!S.postinstall.includes('tailwind:build')) {
  S.postinstall += ' && npm run tailwind:build';
}

if (!S.dev) S.dev = 'concurrently -k "npm:tailwind:watch" "stencil start"';
if (!S.push) S.push = 'npm run tailwind:build && stencil push';
if (S.build && !S.build.includes('tailwind:build')) {
  S.build = `npm run tailwind:build && ${S.build}`;
}

const deps = {
  tailwindcss: '^4.1.0',
  '@tailwindcss/cli': '^4.1.0',
  concurrently: '^9.0.0'
};
Object.keys(deps).forEach((name) => {
  const existing = pkg.dependencies && pkg.dependencies[name];
  if (!pkg.devDependencies[name] && !existing) pkg.devDependencies[name] = deps[name];
});

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
log('Updated package.json (scripts + devDependencies)');

// ---- 3. base.html ----
let html = fs.readFileSync(basePath, 'utf8');
if (/tailwind\.css/.test(html)) {
  skip('base.html already has tailwind.css link');
} else if (/<\/head>/i.test(html)) {
  html = html.replace(/<\/head>/i, () => `    ${LINK_TAG}\n</head>`);
  fs.writeFileSync(basePath, html);
  log('Added Tailwind link in templates/layout/base.html');
} else {
  console.log(`\x1b[33m!\x1b[0m </head> not found. Add this manually inside <head>:\n  ${LINK_TAG}`);
}

// ---- 4. .gitignore ----
const giPath = path.join(target, '.gitignore');
const giLines = ['node_modules/', 'assets/tailwind/tailwind.css'];
let gi = fs.existsSync(giPath) ? fs.readFileSync(giPath, 'utf8') : '';
const missing = giLines.filter((l) => !gi.split(/\r?\n/).includes(l));
if (missing.length) {
  if (gi && !gi.endsWith('\n')) gi += '\n';
  fs.writeFileSync(giPath, gi + missing.join('\n') + '\n');
  log('Updated .gitignore');
} else {
  skip('.gitignore already OK');
}

// ---- 5. .nvmrc ----
const nvmPath = path.join(target, '.nvmrc');
if (!fs.existsSync(nvmPath)) {
  fs.writeFileSync(nvmPath, '20\n');
  log('Created .nvmrc');
}

// ---- 6. install + first build ----
if (noInstall) {
  skip('Skipped npm install (--no-install). Run: npm install');
} else {
  console.log('Running npm install (this also builds tailwind.css)...');
  run('npm', ['install'], target);
}

console.log('\n\x1b[32mDone!\x1b[0m');
console.log(`Next:\n  cd ${path.relative(process.cwd(), target) || '.'}\n  npm run dev`);
