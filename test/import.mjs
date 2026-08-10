import fuzzysort, {go} from 'fuzzysort'
import assert from 'node:assert/strict'

assert.equal(typeof fuzzysort.go, 'function')
assert.equal(go, fuzzysort.go)
assert.equal(go('fuzzysort', ['test', 'fuzzysort'])[0].target, 'fuzzysort')

console.log('ES module import passed')
