// Tiny pub/sub so UI and action modules can trigger a re-render without
// importing render.ts directly. render.ts imports the UI modules that build
// each view, so a direct back-import (ui/foo.ts -> render.ts) would be a
// circular dependency; routing through this bus instead means render.ts is
// the only module that ever calls setRender/setMainRender, and everything
// else only calls the schedule* triggers.
type RenderFn = () => void;

let fullRender: RenderFn = () => {};
let mainRender: RenderFn = () => {};

export function setRender(fn: RenderFn): void {
  fullRender = fn;
}

export function setMainRender(fn: RenderFn): void {
  mainRender = fn;
}

export function scheduleRender(): void {
  fullRender();
}

export function scheduleMainRender(): void {
  mainRender();
}
