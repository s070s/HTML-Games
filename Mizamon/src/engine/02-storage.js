// ---- Storage (works without localStorage) ----------------------------------------------------
const Store = {
  memory: {},
  forceMemory: false,
  get: function (key) {
    if (!this.forceMemory) {
      try { return window.localStorage.getItem(key); } catch (error) { /* private mode or blocked storage */ }
    }
    return Object.prototype.hasOwnProperty.call(this.memory, key) ? this.memory[key] : null;
  },
  set: function (key, value) {
    if (!this.forceMemory) {
      try { window.localStorage.setItem(key, value); return true; } catch (error) { /* fall back to memory */ }
    }
    this.memory[key] = value;
    return false;
  },
  remove: function (key) {
    if (!this.forceMemory) {
      try { window.localStorage.removeItem(key); } catch (error) { /* ignore */ }
    }
    delete this.memory[key];
  },
};

