import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { methodRange, recoveryMutationConfig, sectionRange } from './stryker-recovery-scopes.mjs';

test('source sections follow markers when lines move and exclude the end marker', () => {
  const original = '// lead\nstart();\nwork();\nend();\n';
  assert.equal(sectionRange(original, 'start();', 'end();'), '2-3');
  assert.equal(sectionRange(`// inserted\n${original}`, 'start();', 'end();'), '3-4');
});

test('missing, duplicate, reversed and same-line anchors fail closed', () => {
  for (const [source, start, end] of [
    ['start();\nend();', 'absent', 'end();'],
    ['start();\nend();', 'start();', 'absent'],
    ['start();\nstart();\nend();', 'start();', 'end();'],
    ['start();\nend();\nend();', 'start();', 'end();'],
    ['end();\nstart();', 'start();', 'end();'],
    ['start(); end();', 'start();', 'end();'],
  ]) assert.throws(() => sectionRange(source, start, end));
});

test('method scopes select the complete named method and track moved lines', () => {
  const source = 'export class Example {\n  public async repair(\n    input: string\n  ): Promise<void> {\n    if (input) {\n      work();\n    }\n  }\n  public next(): void {}\n}\n';
  assert.equal(methodRange(source, 'repair'), '2-8');
  assert.equal(methodRange(`// new line\n${source}`, 'repair'), '3-9');
  assert.equal(methodRange(source, 'next'), '9-9');
  assert.throws(() => methodRange(source, 'missing'));
  assert.throws(() => methodRange(`${source}${source}`, 'repair'));
});

test('all delivery configs resolve current source anchors and use portable report paths', async () => {
  for (const name of ['codec', 'controller', 'resources', 'publication']) {
    const { default: config } = await import(`../stryker.recovery-${name}.config.mjs`);
    assert.ok(config.mutate.length > 0);
    assert.ok(config.mutate.every((scope) => scope.startsWith('src/')));
    assert.equal(config.jsonReporter.fileName, `reports/mutation/recovery-${name}.json`);
    assert.equal(config.thresholds.break, 80);
    for (const filter of config.commandRunner.command.split(' ').filter((argument) => argument.endsWith('.test.ts'))) {
      assert.ok(existsSync(filter), `Test filter must exist: ${filter}`);
    }
  }
  const { default: resources } = await import('../stryker.recovery-resources.config.mjs');
  assert.match(resources.commandRunner.command, /create-custom-glb-floor-item\.test\.ts/);
});

test('the config builder rejects missing test filters before Rstest can silently ignore them', () => {
  assert.throws(() => recoveryMutationConfig('missing', ['src/app/project-recovery.ts'], [
    'src/application/no-such-recovery-test.test.ts',
  ]), /Test filter must exist/);
});
