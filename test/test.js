/*
WHAT: Checks for bugs, and then benchmarks to check for performance issues
USAGE: npm test / node test.js / npm run test.bat / open test.html in the browser

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
const isNode = typeof window === 'undefined'
if(isNode) {
  var testdata = require('./testdata.js')
  var arg = process.argv[2]
  if(arg == 'min') {
    var fuzzysort = require('../fuzzysort.min.js')
  } else {
    var fuzzysort = require('../fuzzysort.js')
  }
}

// config
const config = {
  fuzzyoptions: {limit: 100/*limit 100 for browser because our rendering code is too slow to render more..*/},
  benchtime: 250,
  // benchtime: 1000,
}

// load testdata into testdata_prepared, testdata_obj
let testdata_prepared = {}; let testdata_obj = {}
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

  { // urls with garbage ids in them match everything too well
    var targets = ['jQuery Zoom', 'aBcDeFgHiJkLmNoPqRsTuVwXyZAbCdEfGhIjKlMnOpQrStUvWxYzaBcDeFgHiJkLmNoPqRsTuVwXyZAbCdEfGhIjKlMnOpQrStUvWxYzaBcDeFgHiJkLmNoPqRsTuVwXyZAbCdEfGhIjKlMnOpQrStUvWxYzaBcDeFgHiJkLmNoPqRsTuVwXyZAbCdEfGhIjKlMnOpQrStUvWxYzaBcDeFgHiJkLmNoPqRsTuVwXyZAbCdEfGhIjKlMnOpQrStUvWxYz']
    var tmp = fuzzysort.go('zom', targets)
    assert(tmp[0].target == 'jQuery Zoom', 'zom', tmp[0].target)
  }

  { // Exponential backtracking https://github.com/farzher/fuzzysort/issues/80
    var startms = Date.now()

    var tmp = fuzzysort.single('aaaaaaaaaaab', 'a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a xb')

    var diff = Date.now() - startms
    assert(diff < 16, 'Exponential backtracking is taking too long')
  }

  { // sorting
    testSorting1('adio', 'Audio.h', 'AsyncTaskDownloadImage.h')
    testSorting1('note', 'node/noTe', 'not one that evening')

    // https://github.com/home-assistant/frontend/discussions/12590#discussioncomment-2694018
    testSorting1('er.life360', 'device-tracker.life360_iphone_6', 'sendor.battery_life360_iphone_6')
  }

  { // spaces destroy the score even when it's an exact substring https://github.com/farzher/fuzzysort/issues/99
    assert(fuzzysort.single('this is exactly the same search and target', 'this is exactly the same search and target').score == 1)
    test('The Amazing Spider-Man', 'The Amazing Spider-Man', 'The Amazing Spider', 'The Amazing', 'The')
  }

  { // order should matter when using spaces
    testSorting1('c man', 'CheatManager.h', 'ManageCheats.h');
    testSorting1('man c', 'ManageCheats.h', 'CheatManager.h');

    testSorting1('man c', 'ThisManagesStuff.c', 'ThisCheatsStuff.m');
    testSorting1('c man', 'ThisCheatsStuff.man', 'ThisManagesStuff.c');
  }

  { // object cache overwriting your results
    var result1 = fuzzysort.single('a', 'pants')
    var result2 = fuzzysort.single('s', 'pants')
    assert(result1.score != result2.score, 'different scores single')

    var result1 = fuzzysort.go('a', ['pants'])[0]
    var result2 = fuzzysort.go('s', ['pants'])[0]
    assert(result1.score != result2.score, 'different scores go')

    var result1 = fuzzysort.go('a', [{title: 'pants'}], {key: 'title'})[0]
    var result2 = fuzzysort.go('s', [{title: 'pants'}], {key: 'title'})[0]
    assert(result1.score != result2.score, 'different scores key')

    var result1 = fuzzysort.go('a', [{title: 'pants'}], {keys: ['title']})[0]
    var result2 = fuzzysort.go('s', [{title: 'pants'}], {keys: ['title']})[0]
    assert(result1.score != result2.score, 'different scores keys')

    var result1 = fuzzysort.go('a', [{title: 'pants'}], {keys: ['title']})[0][0]
    var result2 = fuzzysort.go('s', [{title: 'pants'}], {keys: ['title']})[0][0]
    assert(result1.score != result2.score, 'different scores keys result')
  }

  { // numbers should work
    var result = fuzzysort.single(5, 256)
    assert(!!result, 'numbers should work')
  }

  { // Cannot read properties of undefined (reading '_score') https://github.com/farzher/fuzzysort/issues/130
    // when using keys, and some don't exist on the target, but others match
    var result = fuzzysort.go('a'  , [{pants:'what'}, {apple:'what'}, {x:'a', '1':'idk'}], {keys:['pants', 'x', 'y', 'z', '']})
    var result = fuzzysort.go('a a', [{pants:'what'}, {apple:'what'}, {x:'a', '1':'idk'}], {keys:['pants', 'x', 'y', 'z', '']})
  }


  { // typos
    testNomatch('abc', 'acb')
    testNomatch('abcefg', 'acbefg')
    testNomatch('a ac acb', 'abc')
    testNomatch('MeshRendering.h', 'mrnederh')
    testSimple('MMommOMMommO', 'moom')
    testNomatch('AndroidRuntimeSettings.h', 'nothing')
    testNomatch('atsta', 'atast')
  }

  { // checking for infinite loops
    testNomatch('a', '')
    testNomatch('', 'a')
    testNomatch('', '')
    testNomatch('', ' ')
    testNomatch(' ', '')
  }

  { // options.all
    var tmp = fuzzysort.go('', ['pants', 's', ''], {all: true})
    assert(tmp.length==3, 'all 1')

    var tmp = fuzzysort.go('pants', ['pants', 's', ''], {all: true})
    assert(tmp.length==1, 'all 2')

    var tmp = fuzzysort.go('', ['pants'])
    assert(tmp.length==0, 'all 3')

    var tmp = fuzzysort.go('', [{a:'pants', b:'noodles'}, {a:'suit', b:'tie'}], {keys:['a', 'b'], all: true})
    assert(tmp[1][1].target === 'tie', 'all 5')

    var targets = [{a:1}, {a:2}]
    var tmp = fuzzysort.go('', targets, {key:'a', all: true})
    assert(tmp[0].obj === targets[0], 'options.all with key https://github.com/farzher/fuzzysort/issues/134')

    var tmp = fuzzysort.go('', targets, {keys:['a'], all: true})
    assert(tmp[0].obj === targets[0], 'options.all with keys')
  }


  { // weird characters require strict match to turn into substring
    // https://github.com/farzher/fuzzysort/issues/122 (When searching for a name containing special character, no match is found)
    var targets = ["Änni ÄÄsma"]
    var results = fuzzysort.go('Ääsma', targets)
    assert(results[0] && results[0].highlight('*', '*') === "Änni *ÄÄsma*", "Änni *ÄÄsma*")
    var results = fuzzysort.go('aasma', targets)
    assert(results[0] && results[0].highlight('*', '*') === "Änni *ÄÄsma*", "Änni *ÄÄsma*")
  }

  { // normalize diacritics / accents / ligatures
    var targets = ['Café Society']
    var results = fuzzysort.go('cafe', targets)
    assert(results[0].target == 'Café Society')

    // make sure ジ highlights correctly
    assert(fuzzysort.go('ジ', ['ファイナルファンタジーXIV スターターパック'])[0].highlight() == 'ファイナルファンタ<b>ジ</b>ーXIV スターターパック', 'ジ')

    // make sure this doesn't infinite loop
    assert(fuzzysort.go('w', ['Rich JavaScript Applications – the Seven Frameworks (Throne of JS, 2012) - Steve Sanderson’s blog - As seen on YouTube™']).length != 0)
  }

  { // find good substrings, don't just use theh first one
    var result = fuzzysort.single('cat', 'basecategory cat')
    assert(result.highlight('*', '*') === 'basecategory *cat*', 'basecategory cat')
  }

  { // make sure indexes are correct for search with spaces
    var tmp = fuzzysort.single('pants on the ground', 'electron-uwp-background: Sample explaining how to use')
    assert(tmp.highlight('*', '*') == 'elec*t*r*on*-uw*p*-b*a*ck*ground*: Sample explaining *h*ow *t*o u*se*')
  }

  { // straw berry should match against strawberry well
    var tmp = fuzzysort.single('straw berry', 'strawberry')
    assert(tmp.score > -50, 'straw berry')
  }


  { // random junks tests, idk
    var tmp = fuzzysort.go('cman', testdata_prepared.ue4_files).slice(0, 2).map(r=>r.target)
    assert(tmp.includes('CheatManager.h') && tmp.includes('CrowdManager.h'), 'cman', tmp[0])

    var tmp = fuzzysort.go('a', ['ba', 'bA', 'a', 'bA', 'xx', 'ba'])
    assert(tmp[0].score===1, 'go sorting')
    assert(tmp.length===5, 'go sorting length')
    assert(tmp.total===5, 'go sorting total')

    fuzzysort.cleanup()

    assert(fuzzysort.go('a', ['a', 'a']).length===2, 'length')
    assert(fuzzysort.go('a', ['a', 'a'], {limit: 1}).length===1, 'length')


    test('noodle monster', 'nomon', null, 'qrs')
    test('noodle monster '.repeat(100), null, 'a')
    test('APPLES', 'app', 'l', 'E')
    test('C:/users/farzher/dropbox/someotherfolder/pocket rumble refactor/Run.bat', 'po', 'po ru', 'pr', 'prrun', 'ocket umble')
    test('123abc', '12', '1', 'a', null, 'cc')
    test('Thoug ht', 'ht', 'hh')
    test('az bx cyy y', 'az', 'ab', 'ay', 'ax', 'ayy')
    testSimple('sax saxax', 'sx') // this is caused if isConsec gets messedup
    testSimple('aabb b b b', 'abbbb')
    test('aab x', 'ab') // this could cause a to get pushed forward then strict match ab in the middle
    test('aabb b', 'abb') // this is cause if isConsec gets messedup

    var tmpObjs = [{'s.s':'str', arr:[{o:'obj'}]}]
    // key
    var tmp = fuzzysort.go('str', tmpObjs, {key: 's.s'})[0]
    assert(tmp.score===1, 'goKey s.s')
    var tmp = fuzzysort.go('obj', tmpObjs, {key: 'arr.0.o'})[0]
    assert(tmp.score===1, 'goKey arr.0.o')
    var tmp = fuzzysort.go('str', tmpObjs, {key: 'arr.0.o'})[0]
    assert(tmp===undefined, 'goKey')
    var tmp = fuzzysort.go('obj', tmpObjs, {key: ['arr', '0', 'o']})[0]
    assert(tmp.score===1, 'goKey arr.0.o')

    // keys
    var tmp = fuzzysort.go('str', tmpObjs, {keys: ['s.s']})[0]
    assert(tmp.score===1, 'goKeys s.s')
    var tmp = fuzzysort.go('obj', tmpObjs, {keys: ['arr.0.o']})[0]
    assert(tmp.score===1, 'goKeys arr.0.o')
    var tmp = fuzzysort.go('str', tmpObjs, {keys: ['arr.0.o']})[0]
    assert(tmp===undefined, 'goKeys')
    var tmp = fuzzysort.go('obj', tmpObjs, {keys: [ ['arr', '0', 'o'] ]})[0]
    assert(tmp.score===1, 'goKeys arr.0.o')
    var tmp = fuzzysort.go('obj', tmpObjs, {keys: [ 's.s', 'arr.0.o' ]})[0]
    assert(tmp.score===1, 'goKeys s.s || arr.0.o')

    var targets = [
      {name: 'Typography', version: '3.1.0'},
      {name: 'Typography', version: '2.1.0'},
    ]
    var results = fuzzysort.go('typography', targets, {key: 'name'})
    assert(results[0].obj.version != results[1].obj.version, 'key same object bug')
    var results = fuzzysort.go('typography', targets, {keys: ['name']})
    assert(results[0].obj.version != results[1].obj.version, 'keys same object bug')

    // missing key / weird key
    var targets = [
      {},
      {name: {}},
      {name: 'Typography'},
    ]
    var results = fuzzysort.go('typography', targets, {key: 'name'})
    var results = fuzzysort.go('typography', targets, {keys: ['name']})

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

    var results = fuzzysort.go('doesnotexist', [])
    assert(results.length === 0 && results.total === 0, 'no results')

    var results = fuzzysort.go('ryan berry', [
      {title: 'ryan berry',   desc:'berry',     },
      {title: 'ryan',         desc:'berry',     },
      {title: 'ryan berry',   desc:'ryan berrys'},
      {title: 'ryan berry',   desc:'',          },
    ], {keys: ['title', 'desc']})
    for(let i=0; i<results.length; i++) assert(results[i].score === 1, 'ryan berry keys spaces scoring')

    fuzzysort.go('xxxxxxx', [{a:'nomatch x'}], {key: 'a'}) // running key when there's no match but bitflags matches to make sure no error

    var results = fuzzysort.go('a', [{a:'a 2222'}, {a:'a 1'}], {key: 'a', limit:1})
    assert(results.length === 1 && results.total === 2, 'limit & total key')
    assert(results[0].obj.a === 'a 1', 'limit sorting key')

    var results = fuzzysort.go('a', ['a 2222', 'a 1'], {limit:1})
    assert(results.length === 1 && results.total === 2, 'limit & total nokey')
    assert(results[0].target === 'a 1', 'limit sorting nokey')

    var results = fuzzysort.go('sup', [{a:'the wordsup is in here but not well'}], {key:'a', threshold:.5})
    assert(results[0] === undefined, 'threshold low')
    var results = fuzzysort.go('sup', [{a:'the wordsup is in here but not well'}], {key:'a', threshold:.1})
    assert(results[0] !== undefined, 'threshold high')

    assert(fuzzysort.single('soup time ifs', 'time for soup').highlight((m, i) => `*${m}(${i})*`).join('') === '*time(0)* *f(1)*or *soup(2)*', 'highlight callback')

    // indexes getter and setter
    fuzzysort.single('pants ground', 'pants on the ground')
    var result = fuzzysort.single('p', 'pants on the ground')
    assert(result.indexes.length === 1 && result.indexes[0] === 0, 'indexes')
    result.indexes = [0, 1, 2, 3, 4]
    assert(result.highlight() === '<b>pants</b> on the ground', 'indexes setter')
    var result = fuzzysort.single('t o g p', 'pants on the ground')
    assert(result.indexes.length === 4 && result.indexes[0] === 0 && result.indexes[1] === 6 && result.indexes[2] === 9 && result.indexes[3] === 13, 'indexes')

    assert(fuzzysort.single('ui', 'build ui').score === fuzzysort.single('ui', 'b__ld ui').score, 'we should find the better substring and scores here should be the same')

    var results = fuzzysort.go('zzzzzzzzzzzzz', [{a:'no thanksz'}], {keys:['a', 'a']})
    assert(results.length === 0, 'no match on keys')

    fuzzysort.go('pants', [['pants on the ground']], {key: obj => obj[0]})
    fuzzysort.go('pants', [['pants on the ground']], {keys: [obj => obj[0], obj => obj[0]]})
  }
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

function testSorting(search, ...targets) {
  var results = fuzzysort.go(search, targets)
  results.map(r => r.target)
  for(var i=0; i<results.length; i++) {
    var sameorder = results[i] === targets[i]
    assert(sameorder, search)
  }
}
function testSorting1(search, ...targets) {
  var results = fuzzysort.go(search, targets)
  assert(results[0].target===targets[0], search)
}
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
    assert(result && result.score>.5, {search, result})
    assertResultIntegrity(result)
  }
}
function testSimple(target, ...searches) {
  for(const search of searches) {
    const result = fuzzysort.single(search, target)
    assert(result && result.score<=.5, {search, result})
    assertResultIntegrity(result)
  }
}
function testSubstr(target, ...searches) {
  for(const search of searches) {
    const result = fuzzysort.single(search, target)
    assert(result && result.score<-100 && result.score>.5, {search, result})
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
  var indexes = result.indexes
  for(let i=0; i<indexes.length; i++) { const matchI = indexes[i]
  // for(let i=0; i<result.indexes.len; i++) { const matchI = result.indexes[i]
  // for(const matchI of result.indexes) {
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

















async function benchmarks() {

  console.log('now benching ...')

  bench('spaces & keys', function() {
    fuzzysort.go('github react',      testdata_obj.urls_and_titles, {keys: ['str.title', 'str.url'], limit:100})
    fuzzysort.go('zom query',         testdata_obj.urls_and_titles, {keys: ['str.title', 'str.url'], limit:100})
    fuzzysort.go('image video gif',   testdata_obj.urls_and_titles, {keys: ['str.title', 'str.url'], limit:100})
  }, config)

  const results = fuzzysort.go('e', testdata_prepared.ue4_files, {limit:100})
  bench('highlight', function() {
    for(const result of results) result.highlight()
  }, config)
  bench('highlight callback', function() {
    for(const result of results) result.highlight(m => `<sup>${m}</sup>`)
  }, config)

  bench('tricky', function() {
    fuzzysort.single('prrun', 'C:/users/farzher/dropbox/someotherfolder/pocket rumble refactor/Run.bat')
  }, config)
  bench('tricky space', function() {
    fuzzysort.single('pr run', 'C:/users/farzher/dropbox/someotherfolder/pocket rumble refactor/Run.bat')
  }, config)
  bench('tricky lot of space', function() {
    fuzzysort.single('pr run      e     e e e        e      e e ee         e     e', 'C:/users/farzher/dropbox/someotherfolder/pocket rumble refactor/Run.bat')
  }, config)

  bench('go prepared spaces', function() {
    fuzzysort.go('n n  n    n     e', testdata_prepared.ue4_files, {limit:100})
    fuzzysort.go(' e ',               testdata_prepared.ue4_files, {limit:100})
    fuzzysort.go('m render .h',       testdata_prepared.ue4_files, {limit:100})
  }, config)
  bench('go key spaces', function() {
    fuzzysort.go('n n  n    n     e', testdata_obj.ue4_files, {key: 'str', limit:100})
    fuzzysort.go(' e ',               testdata_obj.ue4_files, {key: 'str', limit:100})
    fuzzysort.go('m render .h',       testdata_obj.ue4_files, {key: 'str', limit:100})
  }, config)

  bench('go prepared', function() {
    fuzzysort.go('nnnne', testdata_prepared.ue4_files, {limit:100})
    fuzzysort.go('e', testdata_prepared.ue4_files, {limit:100})
    fuzzysort.go('mrender.h', testdata_prepared.ue4_files, {limit:100})
  }, config)
  bench('go prepared nolimit', function() {
    fuzzysort.go('nnnne', testdata_prepared.ue4_files)
    fuzzysort.go('e', testdata_prepared.ue4_files)
    fuzzysort.go('mrender.h', testdata_prepared.ue4_files)
  }, config)
  bench('go prepared key', function() {
    fuzzysort.go('nnnne', testdata_obj.ue4_files, {key: 'prepared', limit:100})
    fuzzysort.go('e', testdata_obj.ue4_files, {key: 'prepared', limit:100})
    fuzzysort.go('mrender.h', testdata_obj.ue4_files, {key: 'prepared', limit:100})
  }, config)
  bench('go key', function() {
    fuzzysort.go('nnnne', testdata_obj.ue4_files, {key: 'str', limit:100})
    fuzzysort.go('e', testdata_obj.ue4_files, {key: 'str', limit:100})
    fuzzysort.go('mrender.h', testdata_obj.ue4_files, {key: 'str', limit:100})
  }, config)
  bench('go keys', function() {
    fuzzysort.go('nnnne', testdata_obj.ue4_files, {keys: ['str'], limit:100})
    fuzzysort.go('e', testdata_obj.ue4_files, {keys: ['str'], limit:100})
    fuzzysort.go('mrender.h', testdata_obj.ue4_files, {keys: ['str'], limit:100})
  }, config)
  bench('go str', function() {
    fuzzysort.go('nnnne', testdata.ue4_files, {limit:100})
    fuzzysort.go('e', testdata.ue4_files, {limit:100})
    fuzzysort.go('mrender.h', testdata.ue4_files, {limit:100})
  }, config)

  bench('huge nomatch', function() {
    fuzzysort.single('xxx', 'noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster')
  }, config)
  bench('huge nomatch !bitflags', function() {
    fuzzysort.single('xxx', 'x noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster')
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


// function getms() { return isNode ? Number(process.hrtime.bigint() / 10000n) / 100 : Date.now() }
// const getms = Date.now
const getms = () => performance.now()

async function bench(name, code, {benchtime=2000}={}) {
  const async = code.constructor.name === 'AsyncFunction'
  const startms = getms()

  // quick estimate of how long a single call takes, so we know how many times to loop it
  let singledurationms
  for(let i=0;;i++) {

    for(let j=0;j<10**i;j++) async?await code():code()

    const durationms = getms()-startms
    if(durationms > 10) {
      singledurationms = durationms/(10**i)
      break
    }
  }

  const idealsamplecount = 10
  const loopcount = Math.round(benchtime/idealsamplecount/singledurationms) || 1 // don't let loopcount be 0, lol


  const loopmsarr = []
  for(;;) {
    const loopstartms = getms()
    for(let i=0; i<loopcount; i++) async?await code():code()
    loopmsarr.push(getms()-loopstartms)

    if(getms()-startms > benchtime) break // this check goes at the end instead of the beginning, to ensure we get some result
  }

  const fastestloopms = getmin(loopmsarr)
  // const fastestloopms = getavg(loopmsarr)
  const hz = 1000/(fastestloopms/loopcount)

  const speeddiff = typeof bench_speeddiff === 'undefined' ? 0 : bench_speeddiff(name, hz)
  const speeddiffstr = speeddiff==0?'': speeddiff>0 ? cmdgreen(`+${speeddiff}%`) : cmdred(`${speeddiff}%`)

  console.log(
    cmdyellow(name),
    'x', cmdyellow(hz>1000?(+Math.round(hz)).toLocaleString() : hz.toFixed(2)), 'ops/sec',
    `${speeddiffstr?speeddiffstr+' ':''}|`, loopmsarr.length.toString(), 'runs sampled'
  )

  function cmdyellow(x) { return isNode ? `${'\u001b[33m'}${x}${'\u001b[0m'}` : x }
  function cmdred(x)    { return isNode ? `${'\u001b[31m'}${x}${'\u001b[0m'}`: x }
  function cmdgreen(x)  { return isNode ? `${'\u001b[32m'}${x}${'\u001b[0m'}`: x }
  function getmin(a) {let min = Infinity; for(const x of a) if(x<min) min = x; return min }
  function getavg(a) {let sum = 0; for(const x of a) sum += x; return sum/a.length }
}
function bench_speeddiff(name, hz) {
  // fuzzysort 3.0
  var baseline = `
    spaces & keys x 3,082 ops/sec +23.69% | 45 runs sampled
    highlight x 341,797 ops/sec +8.13% | 12 runs sampled
    highlight callback x 183,497 ops/sec +3.83% | 9 runs sampled
    tricky x 5,692,984 ops/sec -12.79% | 14 runs sampled
    tricky space x 1,610,290 ops/sec -6.79% | 9 runs sampled
    tricky lot of space x 1,377,717 ops/sec -4.28% | 8 runs sampled
    go prepared spaces x 302.61 ops/sec -2.97% | 11 runs sampled
    go key spaces x 219.66 ops/sec +1.24% | 49 runs sampled
    go prepared x 657.97 ops/sec -4.12% | 11 runs sampled
    go prepared key x 559.95 ops/sec +2.35% | 11 runs sampled
    go key x 369.29 ops/sec +5.84% | 10 runs sampled
    go keys x 331.96 ops/sec +0.95% | 11 runs sampled
    go str x 419.58 ops/sec +3.49% | 11 runs sampled
    huge nomatch x 134,025,769 ops/sec +40.53% | 52 runs sampled
    huge nomatch !bitflags x 3,208,114 ops/sec -28.81% | 11 runs sampled
    tricky x 5,593,716 ops/sec -14.32% | 13 runs sampled
    small x 18,268,139 ops/sec -0.97% | 22 runs sampled
    somematch x 38,254,024 ops/sec -0.04% | 22 runs sampled
  `

  // // fuzzysort 2.0.2
  // var baseline = `
  //   highlight x 635.22 ops/sec -1.19% | 62 runs sampled
  //   tricky x 3,032,593 ops/sec -18.11% | 13 runs sampled
  //   tricky space x 942,114 ops/sec -35.39% | 14 runs sampled
  //   tricky lot of space x 847,304 ops/sec -18.54% | 13 runs sampled
  //   go prepared spaces x 193.00 ops/sec -4.08% | 9 runs sampled
  //   go key spaces x 136.29 ops/sec -2.45% | 28 runs sampled
  //   go prepared x 404.49 ops/sec +2.29% | 10 runs sampled
  //   go prepared key x 335.53 ops/sec +3.25% | 10 runs sampled
  //   go key x 219.76 ops/sec +7.76% | 9 runs sampled
  //   go keys x 182.24 ops/sec +9.19% | 20 runs sampled
  //   go str x 250.21 ops/sec +8.5% | 8 runs sampled
  //   huge nomatch x 53,612,811 ops/sec +0.1% | 125 runs sampled
  //   tricky x 3,208,152 ops/sec -13.37% | 12 runs sampled
  //   small x 6,237,592 ops/sec +0.22% | 16 runs sampled
  //   somematch x 17,516,025 ops/sec -8.73% | 26 runs sampled
  // `

  // // fuzzysort 2.0
  // var baseline = `
  //   highlight x 642.86 ops/sec | 252 runs sampled
  //   tricky x 3,703,251 ops/sec -9.02% | 17 runs sampled
  //   tricky space x 1,458,090 ops/sec | 17 runs sampled
  //   tricky lot of space x 1,040,051 ops/sec | 14 runs sampled
  //   go prepared spaces x 201.20 ops/sec | 12 runs sampled
  //   go key spaces x 139.70 ops/sec | 40 runs sampled
  //   go prepared x 395.43 ops/sec -6.54% | 12 runs sampled
  //   go prepared key x 324.96 ops/sec -9.21% | 11 runs sampled
  //   go key x 203.92 ops/sec -12.16% | 11 runs sampled
  //   go keys x 166.90 ops/sec -14.17% | 24 runs sampled
  //   go str x 230.60 ops/sec -7.23% | 11 runs sampled
  //   huge nomatch x 53,556,706 ops/sec -5.75% | 127 runs sampled
  //   tricky x 3,737,179 ops/sec -8.18% | 15 runs sampled
  //   small x 6,223,342 ops/sec -6.34% | 17 runs sampled
  //   somematch x 19,191,278 ops/sec +4.4% | 29 runs sampled
  // `

  // // fuzzysort 1.9.0
  // var baseline = `
  //   go prepared x 423.08 ops/sec +19.87% | 25 runs sampled
  //   go prepared key x 357.89 ops/sec +25.72% | 21 runs sampled
  //   go key x 232.14 ops/sec +11.84% | 35 runs sampled
  //   go keys x 194.44 ops/sec +13.89% | 27 runs sampled
  //   go str x 248.55 ops/sec +17.08% | 12 runs sampled
  //   goAsync x 333.33 ops/sec +7.75% | 12 runs sampled
  //   goAsync.cancel() x 722.83 ops/sec -99.85% | 11 runs sampled
  //   huge nomatch x 56,818,187 ops/sec +1128.97% | 120 runs sampled
  //   tricky x 4,070,008 ops/sec -20.74% | 16 runs sampled
  //   small x 6,644,523 ops/sec -65.45% | 23 runs sampled
  //   somematch x 18,382,359 ops/sec +24.99% | 31 runs sampled
  // `

  // // fuzzysort 1.2.1
  // var baseline = `
  //   go prepared x 352.94 ops/sec | 102 runs sampled
  //   go prepared key x 284.67 ops/sec | 15 runs sampled
  //   go key x 207.55 ops/sec | 36 runs sampled
  //   go keys x 170.73 ops/sec | 24 runs sampled
  //   go str x 212.29 ops/sec | 11 runs sampled
  //   goAsync x 309.35 ops/sec | 14 runs sampled
  //   goAsync.cancel() x 462,963 ops/sec | 18 runs sampled
  //   huge nomatch x 4,623,204 ops/sec | 19 runs sampled
  //   tricky x 5,134,789 ops/sec | 21 runs sampled
  //   small x 19,230,769 ops/sec | 31 runs sampled
  //   somematch x 14,705,888 ops/sec | 25 runs sampled
  // `

  const escapeRegex = str => str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
  const re = new RegExp(`${escapeRegex(name)} x ([^\\s]+)`)

  const matches = baseline.match(re)
  if(!matches) return 0
  const baselinehz = parseFloat(matches[1].replace(/[^\d\.]/g, ''))
  return Math.floor((hz/baselinehz-1)*100   *100)/100
}
