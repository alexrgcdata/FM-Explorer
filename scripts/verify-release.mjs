import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const npm = process.env.npm_execpath
if (!npm) throw new Error('Run this check through npm run verify:release.')
for (const task of ['test', 'build', 'build:ftp']) {
  const result = spawnSync(process.execPath, [npm, 'run', task], {
    cwd: root,
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}
const upload = path.join(root, 'FTP-READY', 'dist')
const manifest = JSON.parse(
  await readFile(path.join(root, 'FTP-READY', 'BUILD-INFO.json'), 'utf8'),
)
async function files(directory, prefix = '') {
  const result = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix + entry.name
    if (entry.isSymbolicLink())
      throw new Error(`Unexpected symbolic link: ${relative}`)
    if (entry.isDirectory())
      result.push(
        ...(await files(path.join(directory, entry.name), relative + '/')),
      )
    else result.push(relative)
  }
  return result
}
const actual = (await files(upload)).sort()
const listed = manifest.files.map((item) => item.file).sort()
if (JSON.stringify(actual) !== JSON.stringify(listed))
  throw new Error('FTP manifest does not match the complete upload folder.')
for (const item of manifest.files) {
  const bytes = await readFile(path.join(upload, item.file))
  if (createHash('sha256').update(bytes).digest('hex') !== item.sha256)
    throw new Error(`FTP hash mismatch: ${item.file}`)
}
const html = await readFile(path.join(upload, 'index.html'), 'utf8')
for (const [, asset] of html.matchAll(
  /(?:src|href)="\.\/([^"?#]+)(?:[?#][^"]*)?"/g,
)) {
  if (!actual.includes(asset))
    throw new Error(`Missing entry-point asset: ${asset}`)
}
console.log(
  `\nLocal release verified: tests, connected build, browser-demo build, and ${actual.length} FTP files.\nNo real FileMaker host was contacted. Browser and hosted-server acceptance are separate checks.`,
)
