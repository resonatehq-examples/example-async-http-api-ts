import express from "express";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { Resonate } from "@resonatehq/sdk";

const app = express();
app.use(express.json());

const resonate = new Resonate({
  url: "http://localhost:8001",
  group: "gateway",
});

// POST /begin starts a durable execution and returns immediately with a request id.
// The execution runs on a registered worker and survives process restarts.
app.post("/begin", async (req: Request, res: Response) => {
  try {
    const queryId = typeof req.query.id === "string" ? req.query.id : undefined;
    const id = queryId ?? randomUUID();
    const data = req.body && Object.keys(req.body).length > 0 ? req.body : { foo: "bar" };

    // beginRpc returns a handle without awaiting completion.
    // Resonate deduplicates by id — calling twice with the same id reconnects
    // to the in-flight execution rather than starting a new one.
    const handle = await resonate.beginRpc(
      id,
      "foo",
      data,
      resonate.options({ target: "poll://any@worker" }),
    );

    return res.status(200).json({
      promise: handle.id,
      status: "pending",
      wait: `/wait?id=${handle.id}`,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: `failed_to_begin: ${err?.message ?? String(err)}`,
    });
  }
});

// GET /wait polls a durable execution by id without blocking the gateway.
// Clients call this repeatedly until status becomes "resolved" or "rejected".
app.get("/wait", async (req: Request, res: Response) => {
  const id = typeof req.query.id === "string" ? req.query.id : undefined;
  if (!id) {
    return res.status(400).json({ error: "id query parameter is required" });
  }

  try {
    const handle = await resonate.get(id);

    // done() is non-blocking — it asks the server for current state.
    if (await handle.done()) {
      try {
        const result = await handle.result();
        return res.status(200).json({
          status: "resolved",
          promise_id: id,
          result,
        });
      } catch (rejection: any) {
        return res.status(200).json({
          status: "rejected",
          promise_id: id,
          error: rejection?.message ?? String(rejection),
        });
      }
    }

    return res.status(200).json({
      status: "pending",
      promise_id: id,
      message: "Processing in progress",
    });
  } catch (err: any) {
    return res.status(404).json({
      error: `${id} not found`,
    });
  }
});

const PORT = 5001;
app.listen(PORT, "127.0.0.1", () => {
  console.log(`gateway listening on http://127.0.0.1:${PORT}`);
});
