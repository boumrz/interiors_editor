const expectedNode = 'v24.19.0';
const expectedPnpm = '11.20.0';
const actualNode = process.version;
const userAgent = process.env.npm_config_user_agent ?? '';
const actualPnpm = /^pnpm\/(\d+\.\d+\.\d+)/.exec(userAgent)?.[1];

if (actualNode !== expectedNode) {
  throw new Error(`InteriorsEditor requires Node ${expectedNode}; received ${actualNode}.`);
}

if (actualPnpm !== expectedPnpm) {
  throw new Error(`InteriorsEditor requires pnpm ${expectedPnpm}; received ${actualPnpm ?? 'unknown'}.`);
}
