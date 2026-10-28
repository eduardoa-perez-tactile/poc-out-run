const doc = (p) => /\.md$/.test(p) || p.startsWith('docs/');
const infra = (p) => /^(scripts\/|\.github\/|package(?:-lock)?\.json$|harness\.config\.json$|\.node-version$|\.gitignore$)/.test(p);

export function classifyPaths(paths) {
  const plan = { paths: [...new Set(paths)].sort(), docsOnly: paths.length > 0 && paths.every(doc), core: false, visual: false, web: false, cooked: false, manual: [] };
  for (const p of plan.paths) {
    if (p === 'harness.config.json') {
      plan.core = plan.visual = plan.web = plan.cooked = true;
      plan.manual.push('Engine pin or platform/budget policy changed: run milestone browser and phone checks.');
      continue;
    }
    if (doc(p) || infra(p)) continue;
    plan.core = true;
    const relative = p.replace(/^outrun\//, '');
    if (/^(src\/sim\/|schema\/|tests\/sim\/)/.test(relative)) {
      plan.web = true;
    } else if (/^(src\/(presentation|render|ui)\/|ui\/|materials\/|effects\/|tests\/(render|goldens)\/)/.test(relative)) {
      plan.visual = true;
      plan.web = true;
      plan.manual.push('Inspect changed frames on landscape phone/tablet and in a real WebGPU browser.');
    } else if (/^(assets\/|scenes\/|prefabs\/|tests\/content\/|pipelines\.json$)/.test(relative)) {
      plan.visual = plan.web = plan.cooked = true;
    } else if (/^(tests\/.*\.test\.ts$|tests\/replays\/|tests\/budgets\/)/.test(relative)) {
      plan.web = true;
      if (relative.startsWith('tests/budgets/')) plan.visual = plan.cooked = true;
    } else {
      // Entry points, input, native code, config, and unknown paths get the broad gate.
      plan.visual = plan.web = plan.cooked = true;
    }
    if (/input|touch|controls|lifecycle|project\.gameengine|native\//i.test(relative)) {
      plan.manual.push('Check simultaneous controls, cancellation, focus loss, background/resume on browser and phone.');
    }
  }
  if (plan.paths.some(infra)) plan.core = true;
  plan.manual = [...new Set(plan.manual)];
  return plan;
}

export function parseNameStatus(text) {
  const fields = text.split('\0');
  const paths = [];
  for (let i = 0; i < fields.length && fields[i];) {
    const status = fields[i++];
    paths.push(fields[i++]);
    if (/^[RC]/.test(status)) paths.push(fields[i++]);
  }
  return paths.filter(Boolean);
}
