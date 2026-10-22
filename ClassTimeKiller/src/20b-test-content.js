// Content audit (ARC-031, VIS-002, step 20.1): no reference game, studio or character name anywhere in the shipped source.
// The list is base64-encoded so the source itself stays free of those names.

const BANNED_NAMES_B64 = 'WyJhcGV4IGxlZ2VuZHMiLCJiYXR0bGVmaWVsZCIsImJpb3Nob2NrIiwiY2FsbCBvZiBkdXR5IiwibW9kZXJuIHdhcmZhcmUiLCJjb3VudGVyLXN0cmlrZSIsImNvdW50ZXIgc3RyaWtlIiwiY3Jvc3NmaXJlIiwiY3J5c2lzIiwiZGVzdGlueSIsImRldXMgZXgiLCJkaXNob25vcmVkIiwiZG9vbSIsImZvcnRuaXRlIiwiaGFsZi1saWZlIiwiaGFsZiBsaWZlIiwiaGFsbyIsIm92ZXJ3YXRjaCIsInBhaW5raWxsZXIiLCJxdWFrZSIsInRpdGFuZmFsbCIsInR1cm9rIiwidW5yZWFsIHRvdXJuYW1lbnQiLCJ2YWxvcmFudCIsIndhcmZyYW1lIiwibWFzdGVyIGNoaWVmIiwiZ29yZG9uIGZyZWVtYW4iLCJzcGFydGFuIiwiY292ZW5hbnQiLCJuZWVkbGVyIiwiZ3Jhdml0eSBndW4iLCJwb3J0YWwgZ3VuIiwiYmZnIiwiaW5zdGFnaWIiLCJvdmVyc2hpZWxkIiwibWFydHlyZG9tIiwic2xheWVyIiwibWlyYWdlIiwiYmFzdGlvbiIsImp1Z2dlcm5vZyIsImtpbGxzdHJlYWsiLCJuYW5vc3VpdCIsImFwZXJ0dXJlIHNjaWVuY2UiLCJibGFjayBtZXNhIiwidGVubm8iLCJnaG9zdCByZWNvbiIsInJhaW5ib3cgc2l4IiwiYnVuZ2llIiwiZXBpYyBnYW1lcyIsImlkIHNvZnR3YXJlIiwiYmxpenphcmQiLCJyaW90IGdhbWVzIiwiYWN0aXZpc2lvbiIsInViaXNvZnQiLCJxdWFkIGRhbWFnZSJd';

Test.add('content', (check) => {
  const banned = JSON.parse(atob(BANNED_NAMES_B64));
  const source = Array.from(document.scripts).map((script) => script.textContent).join('\n').toLowerCase();
  const hits = [];
  for (const word of banned) {
    const escaped = word.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const pattern = new RegExp('(^|[^a-z0-9])' + escaped + '(?![a-z0-9])');
    if (pattern.test(source)) hits.push(word);
  }
  check('no reference names in the source', hits.length === 0, hits.join(', '));
  check('banned list decodes', banned.length > 40);
});
