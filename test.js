/*
WHAT: Checks for bugs, and then benchmarks to check for performance issues
USAGE: npm test; node test.js; open test.html in the browser

HOW TO WRITE TESTS:
  // matches must not get better
  test('APPLES',      'app', 'l', 'E',               null,     'xxx')
  //    target         ...matches...               after null must not match

  testStrict('a bc', 'bc') // must be a strict match
  testSimple('abc', 'bc') // must be a simple match
  testNomatch('abc', 'cba') // must not match
  assert(true, 'my err msg') // must be truthy
*/


// require / setup
const isNode = typeof require !== 'undefined' && typeof window === 'undefined'
if(isNode) var fuzzysort = require('./fuzzysort') // if we're running in the browser we already have these
if(isNode) var testdata = require('./testdata') // if we're running in the browser we already have these

// config
const config = {
  fuzzyoptions: {limit: 100/*limit 100 for browser because our rendering code is too slow to render more..*/},
  benchtime: 2000,
}

// apply config.fuzzyoptions, and load testdata into testdata_prepared, testdata_obj
fuzzysort = fuzzysort.new(config.fuzzyoptions)
let testdata_prepared = {}, testdata_obj = {}
{
  for(const key of Object.keys(testdata)) {
    testdata_prepared[key] = new Array(testdata[key].length)
    for(let i = testdata[key].length-1; i>=0; i-=1) {
      testdata_prepared[key][i] = fuzzysort.prepare(testdata[key][i])
    }
  }
  for(const key of Object.keys(testdata)) {
    testdata_obj[key] = new Array(testdata[key].length)
    for(let i = testdata[key].length-1; i>=0; i-=1) {
      testdata_obj[key][i] = {str: testdata[key][i], prepared: testdata_prepared[key][i]}
    }
  }
}




// main
// main
// main
setTimeout(async function() {
  await tests()

  if(assert.count==0/*no asserts were run*/) console.log('testing is disabled!')
  else if(!assert.failed) console.log('all tests passed')

  if(isNode) await benchmarks() // Only bench on node. Don't want the demo to freeze
})






async function tests() {
  test('APPLES', 'app', 'l', 'E')
  test('C:/users/farzher/dropbox/someotherfolder/pocket rumble refactor/Run.bat', 'po', 'p', 'po ru', 'pr', 'prrun', 'ocket umble')
  test('123abc', '12', '1', 'a', null, 'cc')


  test('Thoug ht', 'ht', 'hh')

  test('az bx cyy y', 'az', 'ab', 'ay', 'ax', 'ayy')
  testSimple('aab x', 'ab') // this could cause a to get pushed forward then strict match ab in the middle
  testSimple('sax saxax', 'sx') // this is caused if isConsec gets messedup
  testSimple('aabb b', 'abb') // this is cause if isConsec gets messedup
  testSimple('aabb b b b', 'abbbb')

  // typos
  testStrict('abc', 'acb')
  testStrict('abcefg', 'acbefg')
  testStrict('a ac acb', 'abc')
  testStrict('MeshRendering.h', 'mrnederh')
  testStrict('MMommOMMommO', 'moom')
  testNomatch('AndroidRuntimeSettings.h', 'nothing')
  testNomatch('atsta', 'atast')

  test('noodle monster', 'nomon', null, 'qrs')
  test('noodle monster '.repeat(100), null, 'a')

  // sorting

  if(false) {
    // this test is currently failing. sorting algo needs changes
    var tmp = fuzzysort.go('zom', testdata_prepared.urls_and_titles)
    assert(tmp[0].target == 'jQuery Zoom', 'zom', tmp[0].target)
  }

  var tmp = fuzzysort.go('cman', testdata_prepared.ue4_filenames).slice(0, 2).map(r=>r.target)
  assert(tmp.includes('CheatManager.h') && tmp.includes('CrowdManager.h'), 'cman', tmp[0])

  // typoPenalty
  assert(fuzzysort.single('abc', 'abc').score > fuzzysort.single('acb', 'abc').score, 'typoPenalty strict')
  assert(fuzzysort.single('abc', 'axbxc').score > fuzzysort.single('acb', 'axbxc').score, 'typoPenalty simple')

  var tmp = fuzzysort.go('a', ['ba', 'bA', 'a', 'bA', 'xx', 'ba'])
  assert(tmp[0].score===0, 'go sorting')
  assert(tmp.length===5, 'go sorting length')
  assert(tmp.total===5, 'go sorting total')

  var tmp = await fuzzysort.goAsync('a', ['ba', 'bA', 'a', 'bA', 'xx', 'ba'])
  assert(tmp[0].score===0, 'goAsync sorting')
  assert(tmp.length===5, 'goAsync sorting length')
  assert(tmp.total===5, 'goAsync sorting total')

  fuzzysort.cleanup()

  assert(fuzzysort.go('a', ['a', 'a']).length===2, 'length')
  var tmpfuzz = fuzzysort.new({limit:1})
  assert(tmpfuzz.go('a', ['a', 'a']).length===1, 'length')

  // checking for infinite loops
  testNomatch('a', '')
  testNomatch('', 'a')
  testNomatch('', '')
  testNomatch('', ' ')
  testNomatch(' ', '')

  var tmpObjs = [{'s.s':'str', arr:[{o:'obj'}]}]
  // key
  var tmp = fuzzysort.go('str', tmpObjs, {key: 's.s'})[0]
  assert(tmp.score===0, 'goKey s.s')
  var tmp = fuzzysort.go('obj', tmpObjs, {key: 'arr.0.o'})[0]
  assert(tmp.score===0, 'goKey arr.0.o')
  var tmp = fuzzysort.go('str', tmpObjs, {key: 'arr.0.o'})[0]
  assert(tmp===undefined, 'goKey')
  var tmp = fuzzysort.go('obj', tmpObjs, {key: ['arr', '0', 'o']})[0]
  assert(tmp.score===0, 'goKey arr.0.o')

  // keys
  var tmp = fuzzysort.go('str', tmpObjs, {keys: ['s.s']})[0]
  assert(tmp.score===0, 'goKeys s.s')
  var tmp = fuzzysort.go('obj', tmpObjs, {keys: ['arr.0.o']})[0]
  assert(tmp.score===0, 'goKeys arr.0.o')
  var tmp = fuzzysort.go('str', tmpObjs, {keys: ['arr.0.o']})[0]
  assert(tmp===undefined, 'goKeys')
  var tmp = fuzzysort.go('obj', tmpObjs, {keys: [ ['arr', '0', 'o'] ]})[0]
  assert(tmp.score===0, 'goKeys arr.0.o')
  var tmp = fuzzysort.go('obj', tmpObjs, {keys: [ 's.s', 'arr.0.o' ]})[0]
  assert(tmp.score===0, 'goKeys s.s || arr.0.o')
  var tmp = fuzzysort.go('obj', tmpObjs, {keys: [ 's.s', 'arr.0.o' ], scoreFn(a){return (a[0]?a[0].score:1) + (a[1]?a[1].score:1)}})[0]
  assert(tmp.score===1, 'goKeys s.s || arr.0.o score')

  // keyAsync
  var tmp = (await fuzzysort.goAsync('str', tmpObjs, {key: 's.s'}))[0]
  assert(tmp.score===0, 'goKey s.s')
  var tmp = (await fuzzysort.goAsync('obj', tmpObjs, {key: 'arr.0.o'}))[0]
  assert(tmp.score===0, 'goKey arr.0.o')
  var tmp = (await fuzzysort.goAsync('str', tmpObjs, {key: 'arr.0.o'}))[0]
  assert(tmp===undefined, 'goKey')
  var tmp = (await fuzzysort.goAsync('obj', tmpObjs, {key: ['arr', '0', 'o']}))[0]
  assert(tmp.score===0, 'goKey arr.0.o')

  // keysAsync
  var tmp = (await fuzzysort.goAsync('str', tmpObjs, {keys: ['s.s']}))[0]
  assert(tmp.score===0, 'goKeys s.s')
  var tmp = (await fuzzysort.goAsync('obj', tmpObjs, {keys: ['arr.0.o']}))[0]
  assert(tmp.score===0, 'goKeys arr.0.o')
  var tmp = (await fuzzysort.goAsync('str', tmpObjs, {keys: ['arr.0.o']}))[0]
  assert(tmp===undefined, 'goKeys')
  var tmp = (await fuzzysort.goAsync('obj', tmpObjs, {keys: [ ['arr', '0', 'o'] ]}))[0]
  assert(tmp.score===0, 'goKeys arr.0.o')
  var tmp = (await fuzzysort.goAsync('obj', tmpObjs, {keys: [ 's.s', 'arr.0.o' ], scoreFn(a){return (a[0]?a[0].score:1) + (a[1]?a[1].score:1)}}))[0]
  assert(tmp.score===1, 'goKeys s.s || arr.0.o score')

  var targets = [
    {name: 'Typography', version: '3.1.0'},
    {name: 'Typography', version: '2.1.0'},
  ]
  var results = fuzzysort.go('typography', targets, {key: 'name'})
  assert(results[0].obj.version != results[1].obj.version, 'key same object bug')
  var results = fuzzysort.go('typography', targets, {keys: ['name']})
  assert(results[0].obj.version != results[1].obj.version, 'keys same object bug')
  var results = (await fuzzysort.goAsync('typography', targets, {key: 'name'}))
  assert(results[0].obj.version != results[1].obj.version, 'key same object bug async')
  var results = (await fuzzysort.goAsync('typography', targets, {keys: ['name']}))
  assert(results[0].obj.version != results[1].obj.version, 'keys same object bug async')

  // missing key
  var targets = [
    {},
    {name: 'Typography'},
  ]
  var results = fuzzysort.go('typography', targets, {key: 'name'})
  var results = fuzzysort.go('typography', targets, {keys: ['name']})
  var results = (await fuzzysort.goAsync('typography', targets, {key: 'name'}))
  var results = (await fuzzysort.goAsync('typography', targets, {keys: ['name']}))

  // key/keys is a Symbol AND the target is a prepared empty string
  var s = Symbol()
  var results = fuzzysort.go('va', ['value', ''].map(v => ({target: v, [s]: fuzzysort.prepare(v)})), {key: s})
  assert(results.length==1)
  var results = fuzzysort.go('va', ['value', ''].map(v => ({target: v, [s]: fuzzysort.prepare(v)})), {keys: [s]})
  assert(results.length==1)

  // make sure we don't deoptimize when run with weird values
  fuzzysort.single('sup', fuzzysort.prepare())
  fuzzysort.go('', ['empty search test'])
  fuzzysort.go('empty target test', [''])
  fuzzysort.go('', [''])

  var results = fuzzysort.go('farzher', [{yes:'farzher', no:'no'}], {keys:['yes', 'no']})
  assert(!!results[0].obj)
}


async function benchmarks() {

  console.log('now benching ...')

  bench('go prepared', function() {
    fuzzysort.go('nnnne', testdata_prepared.ue4_filenames)
    fuzzysort.go('e', testdata_prepared.ue4_filenames)
    fuzzysort.go('mrender.h', testdata_prepared.ue4_filenames)
  }, config)
  bench('go prepared key', function() {
    fuzzysort.go('nnnne', testdata_obj.ue4_filenames, {key: 'prepared'})
    fuzzysort.go('e', testdata_obj.ue4_filenames, {key: 'prepared'})
    fuzzysort.go('mrender.h', testdata_obj.ue4_filenames, {key: 'prepared'})
  }, config)
  bench('go key', function() {
    fuzzysort.go('nnnne', testdata_obj.ue4_filenames, {key: 'str'})
    fuzzysort.go('e', testdata_obj.ue4_filenames, {key: 'str'})
    fuzzysort.go('mrender.h', testdata_obj.ue4_filenames, {key: 'str'})
  }, config)
  bench('go keys', function() {
    fuzzysort.go('nnnne', testdata_obj.ue4_filenames, {keys: ['str']})
    fuzzysort.go('e', testdata_obj.ue4_filenames, {keys: ['str']})
    fuzzysort.go('mrender.h', testdata_obj.ue4_filenames, {keys: ['str']})
  }, config)
  bench('go str', function() {
    fuzzysort.go('nnnne', testdata.ue4_filenames)
    fuzzysort.go('e', testdata.ue4_filenames)
    fuzzysort.go('mrender.h', testdata.ue4_filenames)
  }, config)

  await bench('goAsync', async () => {
    await fuzzysort.goAsync('e', testdata_prepared.ue4_filenames)
    await fuzzysort.goAsync('a', testdata_prepared.ue4_filenames)
    await fuzzysort.goAsync('mrender.h', testdata_prepared.ue4_filenames)
  }, config)

  await bench('goAsync.cancel()', async () => {
    return new Promise((res, rej) => {
      const p = fuzzysort.goAsync('e', testdata_prepared.ue4_filenames)
      p.then(results => res(), ()=>res())
      p.cancel()
    })
  }, config)

  bench('huge nomatch', function() {
    fuzzysort.single('xxx', 'noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster')
  }, config)
  bench('tricky', function() {
    fuzzysort.single('prrun', 'C:/users/farzher/dropbox/someotherfolder/pocket rumble refactor/Run.bat')
  }, config)
  bench('small', function() {
    fuzzysort.single('al', 'alexstrasa')
  }, config)
  bench('somematch', function() {
    fuzzysort.single('texxx', 'template/index')
  }, config)
}




















// helper function nonsense
function assert(b, ...m) {
  if(!b) {
    console.error(/* assert.count,  */'ASSERTION FAILED!', ...m)
    assert.failed = true
  } else {
    // console.log(assert.count, 'test passed')
  }

  assert.count += 1
}
assert.count = 0

function test(target, ...searches) {
  var last_score = Infinity
  var needs_to_fail = false
  for (var i = 0; i < searches.length; i++) {

    var search = searches[i]
    if(search === null) {
      needs_to_fail = true
      continue
    }

    const result = fuzzysort.single(searches[i], target)
    assertResultIntegrity(result)
    var score = undefined
    if(result) score = result.score

    var info = {score, last_score, target, search}
    if(needs_to_fail) {
      assert(score===undefined, info)
    } else {
      assert(score!==undefined, info)
      assert(score<=last_score, info)
      last_score = score
    }
  }
}
function testStrict(target, ...searches) {
  for(const search of searches) {
    const result = fuzzysort.single(search, target)
    assert(result && result.score>-1000, {search, result})
    assertResultIntegrity(result)
  }
}
function testSimple(target, ...searches) {
  for(const search of searches) {
    const result = fuzzysort.single(search, target)
    assert(result && result.score<=-1000, {search, result})
    assertResultIntegrity(result)
  }
}
function testNomatch(target, ...searches) {
  for(const search of searches) {
    const result = fuzzysort.single(search, target)
    assert(result===null, {search, result})
  }
}

// result.indexes must be increasing
function assertResultIntegrity(result) {
  if(result === null) return true
  var lastMatchI = null
  for(const matchI of result.indexes) {
    if(lastMatchI === null) {
      lastMatchI = matchI
    } else {
      if(lastMatchI >= matchI) {
        assert(false, result)
        return false
      }
      lastMatchI = matchI
    }
  }
}



async function bench(name, code, {benchtime=2000}={}) {
  const async = code.constructor.name === 'AsyncFunction'
  const startms = Date.now()

  // quick estimate of how long a single call takes, so we know how many times to loop it
  let singledurationms
  for(let i=0;;i++) {

    for(let j=0;j<10**i;j++) async?await code():code()

    const durationms = Date.now()-startms
    if(durationms > 10) {
      singledurationms = durationms/(10**i)
      break
    }
  }

  const idealsamplecount = 10
  const loopcount = Math.round(benchtime/idealsamplecount/singledurationms)


  const loopmsarr = []
  for(;;) {
    if(Date.now()-startms > benchtime) break

    const loopstartms = Date.now()
    for(let i=0; i<loopcount; i++) async?await code():code()
    loopmsarr.push(Date.now()-loopstartms)
  }


  const fastestloopms = Math.min(...loopmsarr)
  const hz = 1000/(fastestloopms/loopcount)
  console.log(
    cmdyellow(name),
    'x', cmdyellow(hz>1000?(+Math.round(hz)).toLocaleString() : hz.toFixed(2)), 'ops/sec',
    '|', loopmsarr.length.toString(), 'runs sampled'
  )

  function cmdyellow(x) { return `${'\u001b[33m'}${x}${'\u001b[0m'}` }
}
