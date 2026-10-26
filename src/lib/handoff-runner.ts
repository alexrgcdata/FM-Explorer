// Kept as a standalone template so exported packages require only Node, not this app.
export const handoffRunner = `import { readFile } from 'node:fs/promises';

const examples = JSON.parse(await readFile(new URL('./api-examples.json', import.meta.url), 'utf8'));
const key = process.argv[2];
if (!key) {
  console.log('Usage: node read.mjs <example-key>');
  console.log(examples.items.map(item => item.key + ' — ' + item.name).join('\\n'));
} else {
  try {
    const item = examples.items.find(item => item.key === key);
    if (!item) throw new Error('Unknown example key. Run without arguments to list examples.');
    if (item.requiresFilterValues || !item.request) throw new Error('Filter values are redacted or the query is invalid. Review values in FM API Explorer and export again. No request was sent.');
    if (!process.env.FM_HOST || !process.env.FM_AUTHORIZATION) throw new Error('Set FM_HOST and FM_AUTHORIZATION locally. See README.md; never put credentials in this package.');
    const host = new URL(process.env.FM_HOST);
    const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(host.hostname);
    if ((host.protocol !== 'https:' && !(examples.lab && loopback && host.protocol === 'http:')) || host.username || host.password || host.pathname !== '/' || host.search || host.hash) throw new Error('FM_HOST must be an HTTPS origin without credentials or paths. Lab packages also permit loopback HTTP.');
    const spec = item.request;
    if (!spec.path.startsWith('/fmi/') || spec.path.startsWith('//') || !['GET','POST'].includes(spec.method) || (spec.method === 'POST' && !spec.path.endsWith('/_find'))) throw new Error('Unsupported read request. Review the package.');
    const response = await fetch(new URL(spec.path, host), {
      method: spec.method, redirect: 'error', signal: AbortSignal.timeout(20000),
      headers: { Accept: 'application/json', Authorization: process.env.FM_AUTHORIZATION, ...(spec.body ? { 'Content-Type': 'application/json' } : {}) },
      ...(spec.body ? {body: JSON.stringify(spec.body)} : {})
    });
    if (!response.ok) throw new Error('Read failed (HTTP ' + response.status + '). Review permissions or authentication locally. Response body omitted.');
    const reader = response.body.getReader(), chunks = []; let size = 0;
    while (true) { const {done,value} = await reader.read(); if (done) break; size += value.byteLength; if (size > 8 * 1024 * 1024) { await reader.cancel(); throw new Error('Response exceeded 8 MiB. Reduce the page size.'); } chunks.push(value); }
    const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) {bytes.set(chunk,offset); offset += chunk.byteLength;}
    const text = new TextDecoder().decode(bytes);
    let parsed; try { parsed = JSON.parse(text); } catch { throw new Error('Response was not valid JSON. Body omitted.'); }
    if (Array.isArray(parsed?.messages) && parsed.messages.some(message => String(message.code) !== '0' && String(message.code) !== '401')) throw new Error('FileMaker reported a native error. Response body omitted.');
    // Print original JSON text to preserve decimal and large-integer literals.
    console.log(text);
  } catch (error) { console.error(error instanceof Error ? error.message : 'Read failed.'); process.exitCode = 1; }
}
`
