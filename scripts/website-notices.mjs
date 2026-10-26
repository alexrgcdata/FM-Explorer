import { readFile, readdir, writeFile } from 'node:fs/promises'
const lock = JSON.parse(
  await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'),
)
let notices =
  'FM API Explorer — created by Alex Seidler, RGC Data Solutions\nhttps://rgcdata.com/\n\nThird-party dependencies and their installed license notices follow. Server dependencies are listed for completeness; the website preview does not run a server.\n'
for (const [path, info] of Object.entries(lock.packages)) {
  if (!path.startsWith('node_modules/') || info.dev) continue
  const dir = new URL(`../${path}/`, import.meta.url)
  const files = await readdir(dir).catch(() => [])
  notices += `\n\n--- ${path.replace('node_modules/', '')} ${info.version} (${info.license ?? 'see package'}) ---\n`
  for (const name of files.filter((n) =>
    /^(license|licence|copying|ofl)(\.|$)/i.test(n),
  )) {
    notices += await readFile(new URL(name, dir), 'utf8').catch(() => '')
  }
}
await writeFile(
  new URL('../website-upload/THIRD-PARTY-NOTICES.txt', import.meta.url),
  notices,
)
