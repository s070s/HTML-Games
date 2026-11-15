// ---- Layers: a stack of screens; only the top one gets input ------------------------------------------------------
const layers = [];
function pushLayer(layer) {
  layers.push(layer);
  if (layer.onEnter) layer.onEnter();
  return layer;
}
function removeLayer(layer) {
  const index = layers.indexOf(layer);
  if (index >= 0) layers.splice(index, 1);
}
// Opens a layer and waits until it closes itself with layer.close(value).
function openLayer(layer) {
  return new Promise(function (resolve) {
    layer.resolve = resolve;
    pushLayer(layer);
  });
}
function closeLayer(layer, value) {
  removeLayer(layer);
  if (layer.resolve) { const resolve = layer.resolve; layer.resolve = null; resolve(value); }
}
function updateLayers() {
  const top = layers[layers.length - 1];
  if (top) top.update();
  // layers below the top may animate (overworld NPCs) when they ask for it
  for (let i = 0; i < layers.length - 1; i++) if (layers[i].backgroundUpdate) layers[i].backgroundUpdate();
}
function drawLayers() {
  let first = layers.length - 1;
  while (first > 0 && !layers[first].opaque) first--;
  for (let i = Math.max(0, first); i < layers.length; i++) layers[i].draw();
}

