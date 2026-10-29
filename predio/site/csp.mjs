import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir } from 'node:fs/promises';

const hashes = new Set();
for (const name of (await readdir(new URL('./public/', import.meta.url))).filter(n => n.endsWith('.html')).sort()) {
  const html = await readFile(new URL(`./public/${name}`, import.meta.url), 'utf8');
  const importmaps = [...html.matchAll(/<script\b[^>]*\btype=["']importmap["'][^>]*>([\s\S]*?)<\/script\s*>/gi)];
  // O parser HTML normaliza CRLF/CR para LF antes da verificação da CSP.
  for (const map of importmaps) hashes.add(createHash('sha256').update(map[1].replace(/\r\n?/g, '\n'), 'utf8').digest('base64'));
}
if (!hashes.size) throw new Error('Nenhum importmap encontrado.');
const sources = [...hashes].map(hash => `'sha256-${hash}'`).join(' ');
const path = new URL('./vercel.json', import.meta.url);
const config = JSON.parse(await readFile(path, 'utf8'));
let updated = 0;
for (const rule of config.headers ?? []) {
  for (const header of rule.headers ?? []) {
    if (header.key.toLowerCase() !== 'content-security-policy') continue;
    if (!/(?:^|;)\s*script-src\s+[^;]*/.test(header.value)) {
      throw new Error('Diretiva script-src ausente.');
    }
    header.value = header.value.replace(/(^|;)(\s*)script-src\s+[^;]*/, `$1$2script-src 'self' https://cdn.jsdelivr.net ${sources}`);
    updated++;
  }
}
if (!updated) throw new Error('Cabeçalho CSP ausente.');
await writeFile(path, JSON.stringify(config, null, 2) + '\n');
console.log(`CSP atualizada: ${hashes.size} hash(es), todos os importmaps de public/*.html.`);
