import {
  cp,
  mkdir,
  readFile,
  readdir,
  rename,
  lstat,
  writeFile,
} from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const source = path.join(root, 'website-upload')
const release = path.join(root, 'FTP-READY')
const destination = path.join(release, 'dist')
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const stage = path.join(root, '.local', `ftp-stage-${stamp}`)
// Never follow a redirected output folder into another project or website.
for (const directory of [
  source,
  release,
  path.join(root, '.local'),
  destination,
]) {
  const info = await lstat(directory).catch((e) => {
    if (e.code !== 'ENOENT') throw e
  })
  if (info && (info.isSymbolicLink() || !info.isDirectory()))
    throw new Error(`Expected an ordinary local directory: ${directory}`)
}
async function files(directory, prefix = '') {
  const result = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink())
      throw new Error('The FTP build must not contain symbolic links.')
    const relative = path.join(prefix, entry.name)
    if (entry.isDirectory())
      result.push(...(await files(path.join(directory, entry.name), relative)))
    else if (entry.isFile()) result.push(relative)
    else throw new Error('The FTP build contains an unsupported file type.')
  }
  return result.sort()
}
const allowed = [
  'assets',
  'favicon.svg',
  'index.html',
  'THIRD-PARTY-NOTICES.txt',
].sort()
const actual = (await readdir(source)).sort()
if (JSON.stringify(actual) !== JSON.stringify(allowed))
  throw new Error(
    'Unexpected FTP build contents. Rebuild with npm run build:website.',
  )
const html = await readFile(path.join(source, 'index.html'), 'utf8')
if (!html.includes('./assets/') || /(?:src|href)="\/assets\//.test(html))
  throw new Error(
    'The FTP build must use relative asset URLs for project subfolders.',
  )
const list = await files(source)
await mkdir(path.dirname(stage), { recursive: true })
await cp(source, stage, { recursive: true, errorOnExist: true, force: false })
const hashes = []
for (const file of list) {
  const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
  const original = hash(await readFile(path.join(source, file)))
  if (original !== hash(await readFile(path.join(stage, file))))
    throw new Error(`FTP copy verification failed: ${file}`)
  hashes.push({ file: file.split(path.sep).join('/'), sha256: original })
}
await mkdir(release, { recursive: true })
let previous
if (
  await lstat(destination).catch((e) => {
    if (e.code !== 'ENOENT') throw e
  })
) {
  previous = path.join(root, '.local', `ftp-previous-${stamp}`)
  await rename(destination, previous)
}
try {
  await rename(stage, destination)
} catch (error) {
  if (previous) await rename(previous, destination)
  throw error
}
await writeFile(
  path.join(release, 'READ-ME-FIRST.txt'),
  `FM API Explorer — created by Alex Seidler\n\nBuilt: ${new Date().toISOString()}\n\nOPEN THE dist FOLDER BESIDE THIS FILE.\nCopy everything INSIDE dist to:\n  [alex.seidler.dev document root]/projects/explorer/\n\nUpload these four items:\n  index.html\n  favicon.svg\n  THIRD-PARTY-NOTICES.txt\n  assets/ (the entire folder)\n\nDo not upload the dist folder itself or this instructions file.\nDo not replace the main website's index.html.\nFind the domain's document root in cPanel > Domains; it may differ from public_html.\n\nThen open https://alex.seidler.dev/projects/explorer/ and press Ctrl+F5.\n\nThis is the browser-only synthetic demo. No server, database, or credentials are needed.\nThe connected application uses a local Node service and is a separate build.\n\nRebuild this exact package from the project folder: npm run build:ftp\nNothing is uploaded automatically.\n`,
)
await writeFile(
  path.join(release, 'BUILD-INFO.json'),
  JSON.stringify(
    {
      builtAt: new Date().toISOString(),
      target: 'https://alex.seidler.dev/projects/explorer/',
      files: hashes,
    },
    null,
    2,
  ),
)
console.log(
  `FTP ready: ${destination}\nVerified ${list.length} files. Upload the CONTENTS of dist to your domain's projects/explorer/ folder.`,
)
