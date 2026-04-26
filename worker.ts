import { Resonate } from "@resonatehq/sdk";
import type { Context } from "@resonatehq/sdk";

const resonate = new Resonate({
  url: "http://localhost:8001",
  group: "worker",
});

// Durable workflow registered as "foo".
// The gateway dispatches work to this name via beginRpc.
// All inputs and the return value must be JSON-serializable.
function* foo(_: Context, data: unknown) {
  console.log("processing on worker:", data);

  // Real workloads would call ctx.run(stepFn, ...) for checkpointed side
  // effects (DB writes, external APIs, long computations). Each ctx.run
  // step is durably recorded so the workflow can resume from the last
  // successful step after a crash or restart.

  return {
    result: `Processed: ${JSON.stringify(data)}`,
    timestamp: Date.now(),
  };
}

resonate.register("foo", foo);

console.log("worker running, waiting for tasks...");
