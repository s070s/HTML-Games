// Ids of content entries (reference section 13.1). Node built-ins only; the editor loads this file too.
// A file-backed id becomes a file name on a case-insensitive NTFS drive, so it is lower case, short and never a Windows device name.
export const FILE_ID_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;
// An id nested inside another entry (a place inside a district, an NPC inside a map, a flag) may also use capitals.
export const NESTED_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;
export const DEVICE_NAMES = Object.freeze(['con', 'prn', 'aux', 'nul', ...Array.from({ length: 9 }, (_, index) => `com${index + 1}`), ...Array.from({ length: 9 }, (_, index) => `lpt${index + 1}`)]);

export function isFileId(id) {
  return typeof id === 'string' && FILE_ID_PATTERN.test(id) && !DEVICE_NAMES.includes(id);
}

export function isNestedId(id) {
  return typeof id === 'string' && NESTED_ID_PATTERN.test(id) && !DEVICE_NAMES.includes(id.toLowerCase());
}

// Why an id is refused, or null when it is fine.
export function fileIdProblem(id) {
  if (typeof id !== 'string') return 'an id is text';
  if (!FILE_ID_PATTERN.test(id)) return `the id "${id}" must start with a letter and use only lower case letters, digits and _ (at most 32 characters)`;
  if (DEVICE_NAMES.includes(id)) return `the id "${id}" is a Windows device name`;
  return null;
}
