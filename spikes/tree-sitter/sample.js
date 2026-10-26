import fs from 'node:fs';

/** Reads a file. */
export function readText(path) {
  return fs.readFileSync(path, 'utf8');
}

class Cache {
  get(key) {
    return key;
  }
}

const double = (n) => n * 2;
