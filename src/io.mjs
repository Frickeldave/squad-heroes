import { lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fail } from './errors.mjs';

export function readUtf8(filePath, { maxBytes = 262_144 } = {}) {
  let stat;
  try {
    stat = lstatSync(filePath);
  } catch (error) {
    if (error.code === 'ENOENT') fail('file_missing', `Missing required file: ${filePath}`);
    throw error;
  }
  if (stat.isSymbolicLink()) fail('unsafe_symlink', `Symlink is not allowed: ${filePath}`);
  if (!stat.isFile()) fail('not_regular_file', `Path is not a regular file: ${filePath}`);
  if (stat.size > maxBytes) {
    fail('file_too_large', `File exceeds ${maxBytes} bytes: ${filePath}`);
  }
  const bytes = readFileSync(filePath);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    fail('invalid_utf8', `File is not valid UTF-8: ${filePath}`);
  }
}

export function parseJsonFile(filePath, options) {
  const source = readUtf8(filePath, options);
  try {
    return JSON.parse(source);
  } catch (error) {
    fail('invalid_json', `Invalid JSON in ${filePath}: ${error.message}`);
  }
}

export function safeRelativePath(value) {
  if (typeof value !== 'string' || !value || value.includes('\0')) return false;
  if (path.isAbsolute(value) || value.split(/[\\/]/).includes('..')) return false;
  if (value.includes('\\') || value.startsWith('/') || value.endsWith('/')) return false;
  return path.posix.normalize(value) === value;
}

export function assertSafeTarget(root, relativePath) {
  if (!safeRelativePath(relativePath)) fail('unsafe_path', `Unsafe target path: ${relativePath}`);
  const resolved = path.resolve(root, relativePath);
  const boundary = `${path.resolve(root)}${path.sep}`;
  if (!resolved.startsWith(boundary)) fail('path_traversal', `Target escapes repository: ${relativePath}`);
  return resolved;
}
