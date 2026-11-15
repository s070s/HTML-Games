// ---- Large text: the text being read, again in big letters in a bar under the picture ---------------------------------------------
// Every screen can say what is being read (caption(): the page of a dialog, the chosen menu row, the line of the battle ticker); the bar
// shows it. The bar is always inside the window: screenLayout() leaves its room, and the letters shrink until the text fits (never below CAPTION_MIN_FONT, 12 px).
// A screen with a question or a title and a chosen row answers { context, text }: the bar always shows both, but the screen reader is told the context only the first
// time the screen is read (the context is hidden from it, aria-hidden, afterwards), so moving the cursor says only the chosen row.
const Caption = {
  element: document.getElementById('caption'), text: null, baseFont: 0, ticks: 0, contextLayer: null, contextText: null,
  apply: function (layout) {
    const style = this.element.style;
    this.text = null; // the next sync() writes the text again
    if (layout.captionHeight === 0) { style.display = 'none'; this.element.textContent = ''; this.contextLayer = null; return; }
    style.display = 'block';
    style.width = layout.cssW + 'px';
    style.height = layout.captionHeight + 'px';
    this.baseFont = layout.captionFont;
    this.fit();
  },
  // The biggest font from the minimum up to the base size at which the text fits the bar (a binary search: a fit costs one reflow per step).
  fit: function () {
    const element = this.element;
    let low = CAPTION_MIN_FONT;
    let high = Math.max(low, this.baseFont);
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      element.style.fontSize = middle + 'px';
      if (element.scrollHeight <= element.clientHeight) low = middle; else high = middle - 1;
    }
    element.style.fontSize = low + 'px';
  },
  // Reads the top screen four times a second; force reads it now.
  sync: function (force) {
    if (OPT.largeText === 0) return;
    this.ticks++;
    if (!force && this.ticks % 15 !== 0) return;
    const top = layers[layers.length - 1];
    const caption = top && top.caption ? top.caption() : null;
    if (caption === null) return;
    const text = OPT.lang + '|' + captionString(caption);
    if (text === this.text) return;
    this.text = text;
    this.write(top, caption);
    this.fit();
  },
  // The bar names its language (a screen reader picks the voice from it), then gets the text.
  write: function (top, caption) {
    const element = this.element;
    element.lang = OPT.lang;
    if (typeof caption === 'string') { element.textContent = caption; this.contextLayer = null; this.contextText = null; return; }
    if (caption.parts) { // lines in different languages: each span names its own
      element.textContent = '';
      caption.parts.forEach(function (part, index) {
        if (index > 0) element.appendChild(document.createTextNode(' '));
        const span = document.createElement('span');
        span.lang = part.lang;
        span.textContent = part.text;
        element.appendChild(span);
      });
      this.contextLayer = null; this.contextText = null;
      return;
    }
    const context = document.createElement('span');
    context.textContent = captionLead(caption.context);
    if (this.contextLayer === top && this.contextText === caption.context) context.setAttribute('aria-hidden', 'true'); // said already: the screen reader hears only the text
    this.contextLayer = top; this.contextText = caption.context;
    element.textContent = '';
    element.appendChild(context);
    element.appendChild(document.createTextNode(caption.text));
  },
};

