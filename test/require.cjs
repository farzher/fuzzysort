const fuzzysort = require('fuzzysort')
const assert = require('node:assert/strict')

assert.equal(typeof fuzzysort.go, 'function')
assert.equal(fuzzysort.default.go, fuzzysort.go)
assert.equal(fuzzysort.go('fuzzysort', ['test', 'fuzzysort'])[0].target, 'fuzzysort')

console.log('CommonJS require passed')
