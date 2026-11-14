import { expect, it } from "@rstest/core";
import { createBootstrapPublicObservation } from "../../../tests/verification/telegram-bootstrap-public-observation";

async function usingObservation(
  run: (ports: ReturnType<typeof createBootstrapPublicObservation>) => Promise<void>,
) {
  const ports = createBootstrapPublicObservation();
  try { await run(ports); }
  finally { ports.disposeAll(); await ports.close(); }
}

for (const value of [undefined, null, false, 0, "", { kind: "actual-public-result" }]) {
  it(`keeps the actual fulfilled public value ${JSON.stringify(value)}`, async () => {
    await usingObservation(async (ports) => {
      const operation = Promise.resolve(value);
      expect(ports.observe(operation)).toBe(operation);
      expect(await ports.result(operation)).toBe(value);
    });
  });
}
it("reports a logical pending result after a genuine event-loop turn without a framework timeout", async () => {
  await usingObservation(async (ports) => {
    const operation = ports.observe(new Promise<void>(() => {}));
    await expect(ports.result(operation)).rejects.toThrow(/remained pending/);
  });
});
it("preserves the actual public rejection rather than manufacturing a successful result", async () => {
  await usingObservation(async (ports) => {
    const reason = new Error("actual public rejection");
    const operation = ports.observe(Promise.reject(reason));
    await expect(ports.result(operation)).rejects.toBe(reason);
  });
});
it("drains real native crypto and returns its exact result", async () => {
  await usingObservation(async (ports) => {
    const operation = ports.observe(crypto.subtle.digest("SHA-256", new Uint8Array([97])));
    const digest = await ports.result(operation);
    expect(Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")).toBe("ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb");
    expect(ports.summary().crypto).toEqual({ started: 1, terminal: 1, pending: 0 });
  });
});
it("requires an actually admitted native timer before observing a deadline", async () => {
  await usingObservation(async (ports) => {
    await expect(ports.nativeDeadline()).rejects.toThrow(/not admitted/);
  });
});
it("observes the real configured native callback and public bootstrap completion", async () => {
  await usingObservation(async (ports) => {
    const bootstrap = ports.bootstrap({
      configuration: { botId: "7342037359", environment: "production" },
      source: { read: () => undefined, start: () => () => {} },
      timeoutMs: 1, nowEpochMs: () => 1_733_584_787_000, onExit() {},
    });
    const operation = bootstrap.start();
    await ports.nativeDeadline();
    expect(await ports.result(operation)).toEqual({ kind: "unavailable", reason: "timeout" });
    expect(ports.summary().timers[0]).toMatchObject({ delay: 1, fired: true });
  });
});
it("restores the exact native functions after its observation scope", async () => {
  const original = [setTimeout, clearTimeout, crypto.subtle.importKey, crypto.subtle.verify, crypto.subtle.digest];
  const ports = createBootstrapPublicObservation();
  await ports.close();
  expect([setTimeout, clearTimeout, crypto.subtle.importKey, crypto.subtle.verify, crypto.subtle.digest]).toEqual(original);
});
it("cleans a saved genuine timer without pretending its pending public operation completed", async () => {
  await usingObservation(async (ports) => {
    const bootstrap = ports.bootstrap({
      configuration: { botId: "7342037359", environment: "production" },
      source: { read: () => undefined, start: () => () => {} },
      timeoutMs: 100, nowEpochMs: () => 1_733_584_787_000, onExit() {},
    });
    bootstrap.start();
    await ports.close();
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(ports.summary().timers[0]).toMatchObject({ fired: false, sourceCancelled: false, probeCleanupCleared: true });
    expect(ports.summary().publicResults.pending).toBe(1);
  });
});
