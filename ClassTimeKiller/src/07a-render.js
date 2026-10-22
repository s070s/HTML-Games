// ==== S07 RENDERER ====
// STUB until the renderer helper lands: the hook surface later sections may already use (docs/ARCHITECTURE.md).

const Render = {
  sources: [],
  camera: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, fov: 90 },
  cameraOverride: null,    // fn(camera)
  viewModel: null,         // fn(out) -> out
  actorStyle: null,        // fn(id, out)
  addSource(name, draw) { this.sources.push({ name, draw }); },
};

const Fx = {
  burst() {}, tracer() {}, decal() {}, light() {},
};

const HudBatch = {
  rect() {}, text() {}, ring() {}, line() {},
};
