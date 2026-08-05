import fs from 'node:fs'
import {fileURLToPath} from 'node:url'

const newVersion = process.argv[2]
if(!newVersion) throw new Error('1st cmd arg must be fuzzysort\'s new version number')
if(!/^\d+\.\d+\.\d+$/.test(newVersion)) throw new Error(`invalid version: ${newVersion}`)

const rootUrl = new URL('../', import.meta.url)
const packagePath = fileURLToPath(new URL('package.json', rootUrl))
const oldVersion = JSON.parse(fs.readFileSync(packagePath, 'utf8')).version
const escapedOldVersion = oldVersion.replace(/\./g, '\\.')

function update(relativePath, pattern, replacement, expectedCount = 1) {
  const filePath = fileURLToPath(new URL(relativePath, rootUrl))
  const text = fs.readFileSync(filePath, 'utf8')
  const matches = text.match(pattern)
  const count = matches?.length ?? 0
  if(count !== expectedCount) throw new Error(`${relativePath}: expected ${expectedCount} version matches, found ${count}`)

  console.log(`${relativePath}: ${matches[0]} -> ${replacement}`)
  fs.writeFileSync(filePath, text.replace(pattern, replacement))
}

update('fuzzysort.js', new RegExp(`v${escapedOldVersion}`, 'g'), `v${newVersion}`)
update('fuzzysort.min.js', new RegExp(`v${escapedOldVersion}`, 'g'), `v${newVersion}`)
update('README.md', new RegExp(`@${escapedOldVersion}`, 'g'), `@${newVersion}`)
update('package.json', new RegExp(`"${escapedOldVersion}"`, 'g'), `"${newVersion}"`)
update('package-lock.json', new RegExp(`"version": "${escapedOldVersion}"`, 'g'), `"version": "${newVersion}"`, 2)
