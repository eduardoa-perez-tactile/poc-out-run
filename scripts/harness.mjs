import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, lstatSync, symlinkSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { classifyPaths, parseNameStatus } from './lib/plan.mjs';
import { budgetReplayPaths, verifiedReplayReport } from './lib/replay-budgets.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(join(root, 'harness.config.json'), 'utf8'));
const project = join(root, config.project);
const output = join(root, '.artifacts', 'harness');
const [mode = 'plan', ...args] = process.argv.slice(2);
const steps = [];
let selectedPlan;
let budgetReplaysVerified = false;
mkdirSync(output, { recursive: true });
let locked = false;

function git(args) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr || `git ${args[0]} failed`);
  return r.stdout;
}

function pathsChanged() {
  const index = args.indexOf('--base');
  const base = index >= 0 ? args[index + 1] : process.env.HARNESS_BASE || 'origin/develop';
  if (!base) throw new Error('--base needs a Git ref');
  const ancestor = git(['merge-base', 'HEAD', base]).trim();
  return [...new Set([
    ...parseNameStatus(git(['diff', '--name-status', '-z', '--find-renames', ancestor])),
    ...git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean),
  ])];
}

function files(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]);
}

function verify() {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Node 22 or later is required');
  const p = JSON.parse(readFileSync(join(project, 'project.gameengine.json'), 'utf8'));
  if (p.ui.orientation !== config.orientation) throw new Error('Game orientation must match the landscape harness');
  if (JSON.stringify([...p.platforms].sort()) !== JSON.stringify([...config.targets].sort())) throw new Error('Expected mobile + web platforms');
  if (p.ui.referenceResolution[0] <= p.ui.referenceResolution[1]) throw new Error('Expected a landscape reference resolution');
  if (p.sim.dt < 0.0166 || p.sim.dt > 0.0167) throw new Error('Expected fixed 60 Hz simulation');
  const tests = files(join(project, 'tests')).filter((p) => p.endsWith('.test.ts'));
  if (!tests.length) throw new Error('No game tests found');
  for (const path of tests) {
    if (/\b(?:worldTest|renderTest|test|describe|it)\.only\s*\(/.test(readFileSync(path, 'utf8'))) throw new Error(`Focused test committed: ${path}`);
  }
  console.log('PASS repository policy (configuration and test hygiene; no gameplay validation)');
}

function engineCommand() {
  const cli = process.env.GAMEENGINE_CLI;
  if (cli) return cli.endsWith('.mjs') ? [process.execPath, [resolve(cli)]] : [cli, []];
  if (process.env.GAMEENGINE_ROOT) return [process.execPath, [join(resolve(process.env.GAMEENGINE_ROOT), 'tools/cli/bin/gameengine.mjs')]];
  const linked = join(project, '.gameengine/engine/tools/cli/bin/gameengine.mjs');
  if (existsSync(linked)) return [process.execPath, [linked]];
  return ['gameengine', []];
}

function run(label, command, argv, cwd = project, engineTest = false, jsonCheck = undefined) {
  console.log(`RUN ${label}`);
  const started = performance.now();
  const r = spawnSync(command, argv, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 900_000 });
  const text = `${r.stdout || ''}${r.stderr || ''}${r.error ? `\n${r.error.message}` : ''}`;
  writeFileSync(join(output, `${label}.log`), text);
  let json;
  try { json = JSON.parse((r.stdout || '').trim()); } catch { /* Non-JSON tools keep their raw log. */ }
  const count = engineTest && json?.results ? Object.values(json.results).flat().filter((t) => !t.skipped).length : undefined;
  const ok = r.status === 0 && (!engineTest || (json?.ok === true && count > 0)) && (!jsonCheck || jsonCheck(json));
  const step = { label, ok, seconds: Number(((performance.now() - started) / 1000).toFixed(2)), ...(count !== undefined ? { testExecutions: count } : {}) };
  steps.push(step);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label} (${step.seconds}s${count !== undefined ? `, ${count} test executions` : ''})`);
  if (!ok) {
    console.error(text.slice(-6000));
    if (engineTest && r.status === 0) console.error('A test lane with no executed tests cannot pass.');
    throw new Error(`${label} failed; see .artifacts/harness/${label}.log`);
  }
  return { text, json };
}

function engine(label, argv, test = false, jsonCheck = undefined) {
  const [command, prefix] = engineCommand();
  return run(label, command, [...prefix, ...argv, '--json'], project, test, jsonCheck);
}

function preflight() {
  const [command, prefix] = engineCommand();
  const r = spawnSync(command, [...prefix, '--version'], { cwd: project, encoding: 'utf8' });
  if (r.status !== 0) throw new Error('Game Engine unavailable. Install the pinned engine and run npm run setup.');
  if (r.stdout.trim() !== config.engineVersion) throw new Error(`Expected engine ${config.engineVersion}, found ${r.stdout.trim()}`);
  const state = spawnSync(command, [...prefix, 'editor', 'state', '--json'], { cwd: project, encoding: 'utf8' });
  if (state.status === 0) {
    const s = JSON.parse(state.stdout);
    writeFileSync(join(output, 'editor-state.json'), state.stdout);
    if (s.editEngine?.building || s.buildingNative || s.nativeBuild?.running) throw new Error('Editor is building native systems. Wait before running engine checks.');
    console.log('Editor is open: also check its console for an unfinished native build before continuing.');
  }
}

function verifyBudgetReplays() {
  if (budgetReplaysVerified) return;
  const dir = join(project, 'tests/budgets');
  const entries = files(dir).filter((path) => path.endsWith('.json')).map((file) => ({ file, value: JSON.parse(readFileSync(file, 'utf8')) }));
  const replays = budgetReplayPaths(entries);
  for (const [index, replay] of replays.entries()) {
    if (!existsSync(join(project, replay))) throw new Error(`Budget replay missing: ${replay}`);
    engine(`budget-replay-${index + 1}`, ['replay', 'verify', replay, '--js', 'both'], false, verifiedReplayReport);
  }
  budgetReplaysVerified = true;
}

function nativeGate() {
  engine('generated', ['gen', '--check']);
  engine('format', ['fmt', '--check']);
  engine('integrity', ['check']);
  verifyBudgetReplays();
  engine('native-parity', ['test', '--tier', 't0', '--js', 'both'], true);
}
function visual() {
  verifyBudgetReplays();
  engine('render-mobile', ['test', '--tier', 't1', '--js', 'v8', '--gpu-tier', 'mobile', '--memory-class', 'phone-low'], true);
  engine('render-compat', ['test', '--tier', 't1', '--js', 'v8', '--gpu-tier', 'compat', '--memory-class', 'phone-low'], true);
}
function web() { engine('web-parity', ['test', '--tier', 't0', '--js', 'v8,web'], true); }
function cooked() { engine('cooked', ['test', '--tier', 't0', '--js', 'v8', '--cooked'], true); }

try {
  if (mode === 'plan') {
    console.log(JSON.stringify(classifyPaths(pathsChanged()), null, 2));
  } else if (mode === 'verify') {
    verify();
  } else if (mode === 'pr' && (selectedPlan = classifyPaths(pathsChanged())).docsOnly) {
    verify();
    run('harness-tests', process.execPath, ['--test', ...files(join(root, 'scripts')).filter((path) => path.endsWith('.test.mjs'))], root);
    console.log('Docs-only change: no engine work required.');
  } else {
    const lock = join(output, 'engine.lock');
    try { mkdirSync(lock); locked = true; } catch { throw new Error('Another harness command holds .artifacts/harness/engine.lock. If its process died, remove the stale lock.'); }
    writeFileSync(join(lock, 'pid'), String(process.pid));
    preflight();
    if (mode === 'setup') {
      if (process.env.GAMEENGINE_ROOT) {
        const link = join(project, '.gameengine/engine');
        mkdirSync(dirname(link), { recursive: true });
        if (existsSync(link) || (() => { try { return lstatSync(link).isSymbolicLink(); } catch { return false; } })()) {
          if (!lstatSync(link).isSymbolicLink()) throw new Error('Refusing to replace a real .gameengine/engine directory');
          rmSync(link);
        }
        symlinkSync(resolve(process.env.GAMEENGINE_ROOT), link, 'junction');
      }
      engine('skills', ['skills', 'update', '--auto']);
      engine('generate', ['gen']);
      verify();
    } else if (mode === 'focus') {
      if (args.length !== 1 || args[0].startsWith('--')) throw new Error('Usage: npm run test:focus -- "driving.*"');
      engine('focus', ['test', '--tier', 't0', '--js', 'v8', '--filter', args[0]], true);
    } else if (mode === 'fast') engine('fast', ['test', '--tier', 't0', '--js', 'v8'], true);
    else if (mode === 'parity') engine('native-parity', ['test', '--tier', 't0', '--js', 'both'], true);
    else if (mode === 'visual') visual();
    else if (mode === 'web') web();
    else if (mode === 'cooked') cooked();
    else if (mode === 'check') engine('integrity', ['check']);
    else if (mode === 'pr' || mode === 'milestone') {
      verify();
      run('harness-tests', process.execPath, ['--test', ...files(join(root, 'scripts')).filter((path) => path.endsWith('.test.mjs'))], root);
      const plan = mode === 'milestone' ? { core: true, visual: true, web: true, cooked: true, manual: ['Targeted real WebGPU browser playtest required; validate mobile viewports/phone-low budgets on desktop. Physical-phone testing is excluded.'] } : selectedPlan;
      console.log(JSON.stringify(plan, null, 2));
      if (plan.core) nativeGate();
      if (plan.visual) visual();
      if (plan.cooked) cooked();
      if (plan.web) web();
      if (plan.manual.length) console.log(`MANUAL EVIDENCE REQUIRED:\n${plan.manual.join('\n')}`);
    } else throw new Error(`Unknown harness command: ${mode}`);
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  if (locked) rmSync(join(output, 'engine.lock'), { recursive: true, force: true });
  if (mode !== 'plan') writeFileSync(join(output, `${mode}.json`), JSON.stringify({ mode, ok: !process.exitCode, engineVersion: config.engineVersion, steps }, null, 2) + '\n');
}
