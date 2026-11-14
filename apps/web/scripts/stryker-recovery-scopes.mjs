import { existsSync, readFileSync } from 'node:fs';

function uniqueOffset(source, marker) {
  const offset = source.indexOf(marker);
  if (offset < 0 || source.indexOf(marker, offset + marker.length) >= 0) {
    throw new Error(`Mutation scope requires one exact anchor: ${marker}`);
  }
  return offset;
}

function lineRange(source, start, end) {
  const firstLine = source.slice(0, start).split('\n').length;
  const lastLine = source.slice(0, end).split('\n').length - 1;
  if (lastLine < firstLine) throw new Error('Mutation scope anchors must be ordered on separate lines');
  return `${firstLine}-${lastLine}`;
}

/** End markers are excluded; source drift fails instead of silently changing scope. */
export function sectionRange(source, startMarker, endMarker) {
  return lineRange(source, uniqueOffset(source, startMarker), uniqueOffset(source, endMarker));
}

export function methodRange(source, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^([\\t ]+)(?:public|private|protected) (?:async )?${escapedName}\\(`, 'gm');
  const matches = [...source.matchAll(pattern)];
  if (matches.length !== 1) throw new Error(`Mutation scope requires one method: ${name}`);
  const match = matches[0];
  const memberOrClassEnd = new RegExp(`^(?:${match[1]}(?:public|private|protected) |\\})`, 'gm');
  memberOrClassEnd.lastIndex = match.index + match[0].length;
  const next = memberOrClassEnd.exec(source);
  if (!next) throw new Error(`Mutation scope cannot find the end of method: ${name}`);
  return lineRange(source, match.index, next.index);
}

export function methodScopes(path, names) {
  const source = readFileSync(path, 'utf8');
  return names.map((name) => `${path}:${methodRange(source, name)}`);
}

export function sectionScope(path, start, end) {
  return `${path}:${sectionRange(readFileSync(path, 'utf8'), start, end)}`;
}

/** Run in an isolated source copy: TypeScript 7 requires Stryker inPlace mode. */
export function recoveryMutationConfig(name, mutate, tests) {
  for (const filter of tests) {
    if (!existsSync(filter)) throw new Error(`Test filter must exist: ${filter}`);
  }
  return {
    commandRunner: {
      command: `node ./node_modules/@rstest/core/bin/rstest.js run --config rstest.config.mjs ${tests.join(' ')}`,
    },
    concurrency: 1,
    coverageAnalysis: 'off',
    disableTypeChecks: false,
    inPlace: true,
    jsonReporter: { fileName: `reports/mutation/recovery-${name}.json` },
    mutate,
    packageManager: 'pnpm',
    reporters: ['clear-text', 'json'],
    testRunner: 'command',
    thresholds: { break: 80, high: 80, low: 70 },
    timeoutMS: 10_000,
    timeoutFactor: 2,
  };
}
