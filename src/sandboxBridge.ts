// See src/sandbox.ts/sandbox.html for why this exists: Manifest V3's
// extension-page CSP blocks `new Function`/`eval`, so the custom-expression
// escape hatch (SPEC.md §2) runs inside a sandboxed iframe instead. This
// module owns that iframe and the postMessage request/response bridge.
import type { PipelineHandlers } from "./types.ts";

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
}

let sandboxFrame: HTMLIFrameElement | null = null;
let sandboxReady: Promise<void> | null = null;
let nextRequestId = 0;
const pending = new Map<number, PendingRequest>();

function ensureSandbox(): Promise<void> {
  if (sandboxFrame) return sandboxReady!;
  sandboxFrame = document.createElement("iframe");
  sandboxFrame.src = "sandbox.html";
  sandboxFrame.style.display = "none";
  sandboxReady = new Promise((resolve) => {
    sandboxFrame!.addEventListener("load", () => resolve(), { once: true });
  });
  window.addEventListener("message", (event) => {
    if (event.source !== sandboxFrame!.contentWindow) return;
    const { id, result, error } = (event.data ?? {}) as { id?: number; result?: unknown; error?: string };
    if (id === undefined) return;
    const request = pending.get(id);
    if (!request) return;
    pending.delete(id);
    if (error) request.reject(new Error(error));
    else request.resolve(result);
  });
  document.body.appendChild(sandboxFrame);
  return sandboxReady;
}

export async function runCustomExpressionInSandbox(data: unknown, code: string): Promise<unknown> {
  await ensureSandbox();
  const id = ++nextRequestId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    sandboxFrame!.contentWindow!.postMessage({ id, data, code }, "*");
  });
}

// The one op handler runPipeline needs overridden — everything else in the
// catalog uses the plain in-process implementation in lib/ops.ts directly.
export const pipelineHandlerOverrides: PipelineHandlers = {
  custom: (data, step) => runCustomExpressionInSandbox(data, (step.code as string) ?? ""),
};
