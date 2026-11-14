import { appendFileSync } from 'node:fs';
export default class BrowserRegisteredMutationReporter {
  onTestEnd(test, result) {
    const path = process.env.BROWSER_REGISTERED_MUTATION_AUDIT;
    if (!path) return;
    const entries = result.annotations.filter((entry) => entry.type === 'browser-registered-mutation-activation');
    for (const entry of entries) appendFileSync(path, JSON.stringify({ ...JSON.parse(entry.description), status: result.status }) + '\n');
  }
}
