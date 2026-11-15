// ---- Text box (typewriter text with pages) ---------------------------------------------------------------------------------
const TEXT_SPEEDS = [0.45, 1, 3]; // characters per frame for slow, normal, fast
function TextBox(width, linesPerPage) {
  this.width = width;
  this.linesPerPage = linesPerPage;
  this.lines = [];
  this.page = 0;
  this.shown = 0;
  this.total = 0;
  this.typed = 0;
}
TextBox.prototype.setText = function (text) {
  this.lines = wrapText(text, this.width);
  this.page = 0;
  this.beginPage();
};
TextBox.prototype.beginPage = function () {
  let total = 0;
  for (let i = this.page * this.linesPerPage; i < Math.min(this.lines.length, (this.page + 1) * this.linesPerPage); i++) total += this.lines[i].length;
  this.total = total;
  this.typed = 0;
};
TextBox.prototype.isTyping = function () { return this.typed < this.total; };
// The whole text of the page being shown (the large-text bar reads it).
TextBox.prototype.pageText = function () {
  const start = this.page * this.linesPerPage;
  return this.lines.slice(start, start + this.linesPerPage).join(' ');
};
TextBox.prototype.hasMorePages = function () { return (this.page + 1) * this.linesPerPage < this.lines.length; };
TextBox.prototype.update = function () {
  if (this.typed < this.total) this.typed = Math.min(this.total, this.typed + TEXT_SPEEDS[OPT.textSpeed]);
};
// A press: finish typing, go to the next page, or report that the text is finished.
TextBox.prototype.advance = function () {
  if (this.isTyping()) { this.typed = this.total; return false; }
  if (this.hasMorePages()) { this.page++; this.beginPage(); return false; }
  return true;
};
TextBox.prototype.draw = function (x, y, lineHeight, color) {
  let remaining = Math.floor(this.typed);
  const start = this.page * this.linesPerPage;
  for (let i = start; i < Math.min(this.lines.length, start + this.linesPerPage); i++) {
    const line = this.lines[i];
    if (remaining <= 0) break;
    drawText(remaining >= line.length ? line : line.slice(0, remaining), x, y + (i - start) * lineHeight, color);
    remaining -= line.length;
  }
};

