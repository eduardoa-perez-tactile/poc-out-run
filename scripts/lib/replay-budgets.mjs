import { posix } from 'node:path';

// Budgets run the configured start scene. Its entire setup must be recorded input.
export function budgetReplayPaths(entries) {
  const paths = new Set();
  for (const { file, value } of entries) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Malformed budget: ${file}`);
    if (!Object.hasOwn(value, 'structural')) continue;
    const replay = value.replay;
    if (!value.structural || typeof value.structural !== 'object' || Array.isArray(value.structural)) throw new Error(`Malformed structural budget: ${file}`);
    if (typeof replay !== 'string' || !/^tests\/replays\/.+\.greplay$/.test(replay) || replay.includes('\\') || posix.normalize(replay) !== replay) {
      throw new Error(`Structural budget ${file} needs a canonical tests/replays/*.greplay path`);
    }
    if (Object.hasOwn(value, 'scene')) throw new Error(`Budget ${file} must use the configured start scene and recorded setup input`);
    paths.add(replay);
  }
  if (!paths.size) throw new Error('No structural budget replays selected; replay verification cannot pass empty');
  return [...paths].sort();
}

export function verifiedReplayReport(report) {
  if (report?.ok !== true || !report.results) return false;
  const lanes = ['v8', 'hermes'].map((lane) => report.results[lane]);
  return lanes.every((lane) => lane?.ok === true && Number.isSafeInteger(lane.steps) && lane.steps > 0)
    && lanes[0].steps === lanes[1].steps;
}
