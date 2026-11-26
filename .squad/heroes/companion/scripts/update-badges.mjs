#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const START = '<!-- BEGIN GENERATED BADGES -->';
const END = '<!-- END GENERATED BADGES -->';
const file = 'README.md';
const check = process.argv.includes('--check');
const source = readFileSync(file, 'utf8');
const firstStart = source.indexOf(START);
const firstEnd = source.indexOf(END);
if (firstStart < 0 || firstEnd <= firstStart || source.indexOf(START, firstStart + 1) >= 0 || source.indexOf(END, firstEnd + 1) >= 0) {
  throw new Error('README must contain exactly one managed badge block');
}
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const block = `${START}\n[![Version](https://img.shields.io/badge/version-${encodeURIComponent(version)}-blue)](package.json)\n${END}`;
const output = source.slice(0, firstStart) + block + source.slice(firstEnd + END.length);
if (check) {
  if (output !== source) process.exitCode = 1;
} else if (output !== source) {
  writeFileSync(file, output);
}
