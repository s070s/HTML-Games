// ---- Frame helpers -----------------------------------------------------------------------------------------------------------
let frameWaiters = [];
function nextFrame() { return new Promise(function (resolve) { frameWaiters.push(resolve); }); }
async function waitFrames(count) { for (let i = 0; i < count; i++) await nextFrame(); }
function releaseFrameWaiters() {
  const waiters = frameWaiters;
  frameWaiters = [];
  for (let i = 0; i < waiters.length; i++) waiters[i]();
}

