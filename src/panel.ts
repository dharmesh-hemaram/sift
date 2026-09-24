// Composition root: wires capture, initial DOM listeners, and the first
// render. Everything else lives in its own module — state.ts owns data,
// actions.ts owns mutations, render.ts + ui/*.ts own the DOM, lib/*.ts owns
// pure logic. See PLAN.md / SPEC.md for the feature-level phase history.
import "./capture.ts";
import { initRail } from "./ui/rail.ts";
import { render } from "./render.ts";

initRail();
render();
