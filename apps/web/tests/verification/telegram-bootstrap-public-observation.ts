import { createTelegramHostBootstrap } from "../../src/adapters/telegram/host-bootstrap";

// The application tsconfig deliberately has browser types; these are test-only native ports.
const assertModule = "node:assert/strict", turnModule = "node:timers/promises";
const assert: {
  ok(condition: unknown, message?: string): asserts condition;
  equal(actual: unknown, expected: unknown, message?: string): void;
  notEqual(actual: unknown, expected: unknown, message?: string): void;
} = (await import(assertModule)).default;
const { setImmediate: nextTurn }: { setImmediate(): Promise<void> } = await import(turnModule);

type Outcome = { kind: "pending" | "fulfilled" | "rejected"; value?: unknown };
type Timer = {
  handle: ReturnType<typeof setTimeout>; delay: number; fired: boolean;
  sourceCancelled: boolean; probeCleanupCleared: boolean;
  callbackComplete: Promise<void>;
};

/** Test observation only: all crypto calls, timer handles and result values remain genuine. */
export function createBootstrapPublicObservation() {
  const nativeSet = globalThis.setTimeout, nativeClear = globalThis.clearTimeout;
  const nativeSubtle = crypto.subtle;
  const descriptors = new Map<string, PropertyDescriptor | undefined>();
  const pendingCrypto = new Set<Promise<unknown>>();
  const outcomes = new Map<Promise<unknown>, Outcome>();
  const bootstraps: ReturnType<typeof createTelegramHostBootstrap>[] = [];
  const timers: Timer[] = [];
  let captureTimers = false, cryptoStarted = 0, cryptoTerminal = 0, closed = false;
  for (const key of ["importKey", "verify", "digest"] as const) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(nativeSubtle, key));
    const original = nativeSubtle[key];
    Object.defineProperty(nativeSubtle, key, {
      configurable: true,
      writable: true,
      value: new Proxy(original, {
        apply(target, receiver, args) {
          const operation = Reflect.apply(target, receiver, args);
          pendingCrypto.add(operation);
          cryptoStarted++;
          const terminal = () => { pendingCrypto.delete(operation); cryptoTerminal++; };
          void operation.then(terminal, terminal);
          return operation;
        },
      }),
    });
  }
  globalThis.setTimeout = new Proxy(nativeSet, {
    apply(target, receiver, args) {
      if (!captureTimers) return Reflect.apply(target, receiver, args);
      const [callback, delay, ...parameters] = args;
      let complete!: () => void;
      const callbackComplete = new Promise<void>((resolve) => { complete = resolve; });
      let timer!: Timer;
      const handle = Reflect.apply(target, receiver, [function (this: unknown, ...values: unknown[]) {
        timer.fired = true;
        try { return Reflect.apply(callback, this, values); }
        finally { complete(); }
      }, delay, ...parameters]);
      timer = { handle, delay, fired: false, sourceCancelled: false, probeCleanupCleared: false, callbackComplete };
      timers.push(timer);
      return handle;
    },
  });
  globalThis.clearTimeout = new Proxy(nativeClear, {
    apply(target, receiver, args) {
      const timer = timers.find((entry) => entry.handle === args[0]);
      if (timer) timer.sourceCancelled = true;
      return Reflect.apply(target, receiver, args);
    },
  });
  function observe<T>(operation: Promise<T>): Promise<T> {
    assert.equal(typeof operation?.then, "function", "Public bootstrap start did not return a Promise");
    if (!outcomes.has(operation)) {
      const outcome: Outcome = { kind: "pending" };
      outcomes.set(operation, outcome);
      void operation.then(
        (value) => { outcome.kind = "fulfilled"; outcome.value = value; },
        (error) => { outcome.kind = "rejected"; outcome.value = error; },
      );
    }
    return operation;
  }
  async function drain() {
    do {
      await Promise.allSettled([...pendingCrypto]);
      await nextTurn();
    } while (pendingCrypto.size > 0);
  }
  return {
    observe,
    drain,
    bootstrap(dependencies: Parameters<typeof createTelegramHostBootstrap>[0]) {
      const actual = createTelegramHostBootstrap(dependencies);
      bootstraps.push(actual);
      return {
        ...actual,
        start() {
          captureTimers = true;
          try { return observe(actual.start()); }
          finally { captureTimers = false; }
        },
      };
    },
    async result<T>(operation: Promise<T>): Promise<T> {
      const outcome = outcomes.get(operation);
      assert.ok(outcome, "Observe the public operation synchronously before awaiting its boundary");
      await drain();
      assert.notEqual(outcome.kind, "pending", "Public bootstrap result remained pending after its observed port boundary");
      if (outcome.kind === "rejected") throw outcome.value;
      return outcome.value as T;
    },
    async nativeDeadline() {
      const timer = timers.at(-1);
      assert.ok(timer, "Public native deadline was not admitted");
      assert.ok(timer.fired || !timer.sourceCancelled, "Public native deadline was cancelled before its firing boundary");
      await timer.callbackComplete;
    },
    disposeAll() {
      const errors: unknown[] = [];
      for (const bootstrap of bootstraps.splice(0)) {
        try { bootstrap.dispose(); }
        catch (error) { errors.push(error); }
      }
      return errors;
    },
    summary() {
      return {
        crypto: { started: cryptoStarted, terminal: cryptoTerminal, pending: pendingCrypto.size },
        publicResults: { observed: outcomes.size, pending: [...outcomes.values()].filter((value) => value.kind === "pending").length },
        timers: timers.map(({ delay, fired, sourceCancelled, probeCleanupCleared }) => ({ delay, fired, sourceCancelled, probeCleanupCleared })),
      };
    },
    async close() {
      if (closed) return;
      closed = true;
      try { await drain(); }
      finally {
        for (const timer of timers) { nativeClear(timer.handle); timer.probeCleanupCleared = true; }
        globalThis.setTimeout = nativeSet;
        globalThis.clearTimeout = nativeClear;
        for (const [key, descriptor] of descriptors) {
          if (descriptor) Object.defineProperty(nativeSubtle, key, descriptor);
          else Reflect.deleteProperty(nativeSubtle, key);
        }
      }
    },
  };
}
