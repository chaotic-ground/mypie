#!/usr/bin/env node
// CLI for the proofreading bridge.
//   mypie-ai-bridge serve [--port N]      start the HTTP server
//   mypie-ai-bridge < input.txt           analyze stdin, print feedback JSON
//   mypie-ai-bridge --file path.txt       analyze a file, print feedback JSON

import { readFileSync } from 'node:fs';
import { analyze } from '../src/feedback.mjs';
import { start } from '../src/server.mjs';

const argv = process.argv.slice(2);

const flag = (name) => {
  const i = argv.indexOf(name);
  return i !== -1 ? argv[i + 1] : undefined;
};

const readStdin = () =>
  new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => {
      data += c;
    });
    process.stdin.on('end', () => resolve(data));
  });

const main = async () => {
  if (argv[0] === 'serve') {
    start(flag('--port') ? Number(flag('--port')) : undefined);
    return;
  }

  const file = flag('--file');
  const text = file ? readFileSync(file, 'utf8') : await readStdin();
  const feedback = await analyze(text, { model: flag('--model') });
  process.stdout.write(`${JSON.stringify(feedback, null, 2)}\n`);
};

main().catch((err) => {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});
