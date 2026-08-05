const fs = require('fs')

const new_version = process.argv[2]
if(!new_version) return console.error('1st cmd arg must be fuzzysort\'s new version number')

{
  const file_path = `${__dirname}/../fuzzysort.min.js`
  const text = fs.readFileSync(file_path, 'utf8')
  const matches = text.match(/v\d+\.\d+\.\d+/)

  if(!matches || matches.length !== 1) return console.error('expected 1 version match, found', matches ? matches.length : 0)

  const version = matches[0]
  console.log('found version:', version)

  fs.writeFileSync(file_path, text.replace(version, `v${new_version}`))
}

{
  const file_path = `${__dirname}/../README.md`
  const text = fs.readFileSync(file_path, 'utf8')
  const matches = text.match(/@\d+\.\d+\.\d+/)

  if(!matches || matches.length !== 1) return console.error('expected 1 version match, found', matches ? matches.length : 0)

  const version = matches[0]
  console.log('found version:', version)

  fs.writeFileSync(file_path, text.replace(version, `@${new_version}`))
}

{
  const file_path = `${__dirname}/../package.json`
  const text = fs.readFileSync(file_path, 'utf8')
  const matches = text.match(/"\d+\.\d+\.\d+"/)

  if(!matches || matches.length !== 1) return console.error('expected 1 version match, found', matches ? matches.length : 0)

  const version = matches[0]
  console.log('found version:', version)

  fs.writeFileSync(file_path, text.replace(version, `"${new_version}"`))
}
