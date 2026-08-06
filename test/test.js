/*
WHAT: Checks for bugs, and then benchmarks to check for performance issues
USAGE: npm test / node test.js / npm run test.bat / serve the repo over HTTP and open test/test.html

HOW TO WRITE TESTS:
  // matches must not get better
  test('APPLES',      'app', 'l', 'E',               null,     'xxx')
  //    target         ...matches...               after null must not match

  testStrict('a bc', 'bc') // must be a strict match
  testSimple('abc', 'bc') // must be a simple match
  testNomatch('abc', 'cba') // must not match
  assert(true, 'my err msg') // must be truthy
*/

// import / setup
import testdata from './testdata.js'

const isNode = typeof window === 'undefined'
const useMinified = isNode && process.argv[2] === 'min'
const {default: fuzzysort} = await import(useMinified ? '../fuzzysort.min.js' : '../fuzzysort.js')

// config
const config = {
  fuzzyoptions: {limit: 100/*limit 100 for browser because our rendering code is too slow to render more..*/},
  benchtime: 250,
  // benchtime: 1000,
}

// load testdata into prepared collections and objects
let testdata_prepared = {}; let testdata_obj = {}
{
  for(const key of Object.keys(testdata)) testdata_prepared[key] = fuzzysort.prepare(testdata[key])
  for(const key of Object.keys(testdata)) {
    testdata_obj[key] = new Array(testdata[key].length)
    for(let i = testdata[key].length-1; i>=0; i-=1) testdata_obj[key][i] = {str: testdata[key][i], alt: testdata[key][i]}
  }
}

if(!isNode) Object.assign(globalThis, {fuzzysort, testdata, testdata_prepared})



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

    // visually equivalent and Unicode compatibility characters
    for(const [search, target] of [
      ['o', 'ø'],
    ]) {
      var result = fuzzysort.single(search, target)
      assert(result && result.indexes[0] === 0, `${search} matches ${target}`)
      assert(fuzzysort.single(target, search), `${target} matches ${search}`)
    }

    // common punctuation variants
    for(const quote of ['"', '`', '‘', '’', '“']) {
      assert(fuzzysort.single("'", quote), `' matches ${quote}`)
      assert(fuzzysort.single(quote, "'"), `${quote} matches '`)
    }
    assert(fuzzysort.single('/', '\\'), '/ matches \\')
    assert(fuzzysort.single('\\', '/'), '\\ matches /')
    assert(fuzzysort.single('.', '…'), '. matches …')
    assert(fuzzysort.single('…', '.'), '… matches .')

    // semantic, context-dependent symbols remain distinct
    assert(!fuzzysort.single('+', '&'), '+ does not match &')
    assert(!fuzzysort.single('.', ','), '. does not match ,')

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

    // key/keys can be a Symbol and targets can contain empty strings
    var s = Symbol()
    var symbolTargets = ['value', ''].map(v => ({target: v, [s]: v}))
    var results = fuzzysort.go('va', fuzzysort.prepare(symbolTargets, {key:s}))
    assert(results.length==1)
    var results = fuzzysort.go('va', fuzzysort.prepare(symbolTargets, {keys:[s]}))
    assert(results.length==1)

    // make sure we don't deoptimize when run with weird values
    fuzzysort.single('sup', undefined)
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

    // Top-level helpers work with live and structured-cloned Worker results.
    var result = fuzzysort.single('fb', 'foo bar')
    assert(fuzzysort.highlight(result, '*', '*') === '*f*oo *b*ar', 'top-level highlight')
    assert(fuzzysort.score(result) === result.score, 'top-level score')
    if(typeof structuredClone === 'function') {
      var clonedResult = structuredClone(result)
      assert(clonedResult.highlight === undefined && clonedResult.score === undefined, 'structured clone removes result prototype')
      assert(fuzzysort.highlight(clonedResult, '*', '*') === '*f*oo *b*ar', 'structured-cloned highlight')
      assert(fuzzysort.highlight(clonedResult, (m, i) => `${i}:${m}`).join('|') === '|0:f|oo |1:b|ar', 'structured-cloned highlight callback')
      assert(fuzzysort.score(clonedResult) === result.score, 'structured-cloned score')

      var keysResult = fuzzysort.go('fo', [{name:'foo', description:'bar'}], {keys:['name', 'description']})[0]
      var clonedKeysResult = structuredClone(keysResult)
      assert(fuzzysort.score(clonedKeysResult) === keysResult.score, 'structured-cloned keys score')
      assert(fuzzysort.highlight(clonedKeysResult[0]) === '<b>fo</b>o', 'structured-cloned nested highlight')
    }

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

  { // common API paths and option combinations
    assert(typeof fuzzysort.prepare === 'function', 'prepare is public')
    assert(fuzzysort.index === undefined, 'index is not public')

    var raw = fuzzysort.go('render', ['PreRender/render target'])
    var prepared = fuzzysort.go('render', fuzzysort.prepare(['PreRender/render target']))
    assert(raw[0]._score === prepared[0]._score, 'raw/prepared score equality')
    assert(JSON.stringify(raw[0].indexes) === JSON.stringify(prepared[0].indexes), 'raw/prepared indexes equality')

    // Prefer a later word beginning over an earlier mid-word character. Every
    // letter in a prepared collection has an independent precomputed entry.
    var singleCharacters = fuzzysort.prepare(['foobar baz'])
    var result = fuzzysort.go('b', singleCharacters)[0]
    assert(result.indexes[0] === 7, 'single-character beginning match')
    assert(fuzzysort.go('f', singleCharacters)[0].indexes[0] === 0, 'prepared single-character switch')
    assert(fuzzysort.go('b', singleCharacters)[0].indexes[0] === 7, 'prepared single-character switch back')

    // Duplicate whitespace-separated terms are intentionally deduplicated.
    var oneTerm = fuzzysort.single('foo', 'foo bar')
    var duplicateTerms = fuzzysort.single('  foo   foo  ', 'foo bar')
    assert(oneTerm._score === duplicateTerms._score, 'duplicate space searches score')
    assert(JSON.stringify(oneTerm.indexes) === JSON.stringify(duplicateTerms.indexes), 'duplicate space searches indexes')

    var tied = [{id: 1, name: 'alpha'}, {id: 2, name: 'alpha'}, {id: 3, name: 'beta'}]
    var limited = fuzzysort.go('alpha', tied, {key: 'name', limit: 1})
    assert(limited.length === 1 && limited.total === 2, 'limit 1 total')
    assert(limited[0].obj === tied[0], 'limit 1 keeps first equal score')

    var keyPaths = [{direct:'alpha', nested:{value:'beta'}, array:['gamma']}]
    assert(fuzzysort.go('alpha', keyPaths, {key:'direct'}).length === 1, 'direct key path')
    assert(fuzzysort.go('beta', keyPaths, {key:'nested.value'}).length === 1, 'dotted key path')
    assert(fuzzysort.go('gamma', keyPaths, {key:['array', 0]}).length === 1, 'array key path')
    assert(fuzzysort.go('beta', keyPaths, {key:obj=>obj.nested.value}).length === 1, 'function key path')

    var preparedKey = fuzzysort.prepare(keyPaths, {key:'nested.value'})
    assert(fuzzysort.go('beta', preparedKey)[0].obj === keyPaths[0], 'prepared key preserves object')
    var preparedKeys = fuzzysort.prepare(keyPaths, {keys:['direct', 'nested.value']})
    assert(fuzzysort.go('alpha beta', preparedKeys)[0].obj === keyPaths[0], 'prepared keys preserve object')
    assert(fuzzysort.go('', preparedKey, {all:true})[0].obj === keyPaths[0], 'prepared key all')

    var scoreFnCalls = 0
    var scored = fuzzysort.go('a', [{name:'a', rank:2}, {name:'a', rank:3}, {name:'a', rank:0}], {
      keys: ['name'],
      scoreFn: result => { ++scoreFnCalls; return result.obj.rank },
    })
    assert(scoreFnCalls === 3, 'scoreFn called for every matching object')
    assert(scored.length === 2 && scored[0].obj.rank === 3 && scored[1].obj.rank === 2, 'scoreFn ordering and zero filtering')

    scoreFnCalls = 0
    var preparedScored = fuzzysort.prepare([{name:'a', rank:2}, {name:'a', rank:3}], {keys:['name']})
    var preparedScoreResults = fuzzysort.go('a', preparedScored, {
      scoreFn: result => { ++scoreFnCalls; return result.obj.rank },
    })
    assert(scoreFnCalls === 2 && preparedScoreResults[0].obj.rank === 3, 'prepared keys scoreFn')

    var unread = fuzzysort.go('render', ['PreRender/render target'], {limit:1})[0]
    var rawScore = unread._score
    var rawIndexes = unread._indexes
    unread.score; unread.indexes; unread.highlight()
    assert(unread._score === rawScore && unread._indexes === rawIndexes, 'reading public fields does not mutate raw result')
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

  // Focused common paths. Keep these separate so a regression in one workload
  // is not hidden by faster operations bundled into the same benchmark.
  const focusedSingleTarget = 'C:/Project/Renderer/RenderTarget.cpp'
  bench('single raw cached target', function() {
    fuzzysort.single('render', focusedSingleTarget)
  }, config)
  bench('single successful non-substring', function() {
    fuzzysort.single('rtrgt', 'C:/Project/Renderer/RenderTarget.cpp')
  }, config)
  bench('single unsuccessful bitflags', function() {
    fuzzysort.single('qz', 'C:/Project/Renderer/RenderTarget.cpp')
  }, config)
  bench('single unsuccessful scan', function() {
    fuzzysort.single('zcr', 'C:/Project/Renderer/RenderTarget.cppz')
  }, config)
  bench('single character', function() {
    fuzzysort.single('r', 'C:/Project/Renderer/RenderTarget.cpp')
  }, config)
  bench('prepare ascii target', function() {
    fuzzysort.prepare(['C:/Project/Renderer/RenderTarget.cpp'])
  }, config)
  bench('prepare unicode target', function() {
    fuzzysort.prepare(['Café/レンダラー/RenderTarget.cpp'])
  }, config)

  const focusedPrepared = testdata_prepared.ue4_files
  const focusedRaw = testdata.ue4_files
  const focusedObjects = testdata_obj.ue4_files
  const focusedNestedObjects = focusedRaw.map(str => ({nested:{str}}))
  const steamPrepared = testdata_prepared.steam_games
  const steamRaw = testdata.steam_games

  // Data-cold latency is hidden by the throughput benchmarks because their first
  // call prepares and warms the targets for every subsequent loop iteration.
  benchCold('prepare all UE4 targets', function() {
    return focusedRaw
  }, function(targets) {
    fuzzysort.prepare(targets)
  })
  benchCold('first go raw UE4 targets', function() {
    fuzzysort.cleanup()
    return focusedRaw
  }, function(targets) {
    fuzzysort.go('render', targets, {limit:10})
  })
  benchCold('first go prepared UE4 targets', function() {
    fuzzysort.cleanup()
    return fuzzysort.prepare(focusedRaw)
  }, function(targets) {
    fuzzysort.go('render', targets, {limit:10})
  })
  benchCold('second go prepared UE4 targets', function() {
    fuzzysort.cleanup()
    var targets = fuzzysort.prepare(focusedRaw)
    fuzzysort.go('render', targets, {limit:10})
    return targets
  }, function(targets) {
    fuzzysort.go('render', targets, {limit:10})
  })

  // Steam is large enough to expose first-keystroke costs which are difficult to
  // see in the smaller UE4 set. Setup remains outside the measured interval.
  benchCold('prepare all Steam targets', function() {
    return steamRaw
  }, function(targets) {
    fuzzysort.prepare(targets)
  }, {samplecount:15})
  benchCold('first "e" raw Steam targets', function() {
    fuzzysort.cleanup()
    return steamRaw
  }, function(targets) {
    fuzzysort.go('e', targets, {limit:10})
  }, {samplecount:15})
  benchCold('first "e" prepared Steam targets', function() {
    fuzzysort.cleanup()
    return fuzzysort.prepare(steamRaw)
  }, function(targets) {
    fuzzysort.go('e', targets, {limit:10})
  }, {samplecount:15})
  benchCold('second "e" prepared Steam targets', function() {
    fuzzysort.cleanup()
    var targets = fuzzysort.prepare(steamRaw)
    fuzzysort.go('e', targets, {limit:10})
    return targets
  }, function(targets) {
    fuzzysort.go('e', targets, {limit:10})
  }, {samplecount:15})

  bench('go prepared limit 1', function() {
    fuzzysort.go('render', focusedPrepared, {limit:1})
  }, config)
  bench('go prepared limit 10', function() {
    fuzzysort.go('render', focusedPrepared, {limit:10})
  }, config)
  bench('go prepared limit 100 focused', function() {
    fuzzysort.go('render', focusedPrepared, {limit:100})
  }, config)
  bench('go prepared unlimited focused', function() {
    fuzzysort.go('render', focusedPrepared)
  }, config)
  bench('go prepared threshold', function() {
    fuzzysort.go('render', focusedPrepared, {limit:10, threshold:.5})
  }, config)

  bench('go Steam "e" limit 10', function() {
    fuzzysort.go('e', steamPrepared, {limit:10})
  }, config)
  bench('go Steam "e" limit 100', function() {
    fuzzysort.go('e', steamPrepared, {limit:100})
  }, config)
  bench('go Steam "e" unlimited', function() {
    fuzzysort.go('e', steamPrepared)
  }, config)

  // Measure one real interaction, including every search issued while typing.
  // cleanup() is outside the timed region, but makes the first keystroke cold.
  benchCold('type "elder" prepared Steam targets', function() {
    fuzzysort.cleanup()
    return steamPrepared
  }, function(targets) {
    fuzzysort.go('e', targets, {limit:10})
    fuzzysort.go('el', targets, {limit:10})
    fuzzysort.go('eld', targets, {limit:10})
    fuzzysort.go('elde', targets, {limit:10})
    fuzzysort.go('elder', targets, {limit:10})
  }, {samplecount:15})

  bench('go raw cached limit 10', function() {
    fuzzysort.go('render', focusedRaw, {limit:10})
  }, config)
  bench('go raw cold cache limit 10', function() {
    fuzzysort.cleanup()
    fuzzysort.go('render', focusedRaw, {limit:10})
  }, config)

  bench('go key direct', function() {
    fuzzysort.go('render', focusedObjects, {key:'str', limit:10})
  }, config)
  bench('go key dotted', function() {
    fuzzysort.go('render', focusedNestedObjects, {key:'nested.str', limit:10})
  }, config)
  bench('go key array', function() {
    fuzzysort.go('render', focusedNestedObjects, {key:['nested', 'str'], limit:10})
  }, config)
  bench('go key function', function() {
    fuzzysort.go('render', focusedObjects, {key:obj=>obj.str, limit:10})
  }, config)
  bench('go keys focused', function() {
    fuzzysort.go('render', focusedObjects, {keys:['str', 'alt'], limit:10})
  }, config)
  bench('go keys scoreFn', function() {
    fuzzysort.go('render', focusedObjects, {keys:['str', 'alt'], limit:10, scoreFn:results=>results.score})
  }, config)

  bench('go results unread', function() {
    fuzzysort.go('render', focusedPrepared, {limit:10})
  }, config)
  bench('go results score read', function() {
    var results = fuzzysort.go('render', focusedPrepared, {limit:10})
    for(var i=0; i<results.length; ++i) results[i].score
  }, config)
  bench('go results indexes read', function() {
    var results = fuzzysort.go('render', focusedPrepared, {limit:10})
    for(var i=0; i<results.length; ++i) results[i].indexes
  }, config)

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
  const preparedObjects = fuzzysort.prepare(testdata_obj.ue4_files, {key:'str'})
  bench('go prepared key', function() {
    fuzzysort.go('nnnne', preparedObjects, {limit:100})
    fuzzysort.go('e', preparedObjects, {limit:100})
    fuzzysort.go('mrender.h', preparedObjects, {limit:100})
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

function benchCold(name, setup, code, {samplecount=25}={}) {
  const samples = new Array(samplecount)
  for(let i=0; i<samplecount; ++i) {
    const state = setup() // Deliberately outside the timed region.
    const startms = getms()
    code(state)
    samples[i] = getms() - startms
  }
  samples.sort((a,b) => a-b)
  const medianms = samples[samplecount >> 1]
  const hz = 1000 / medianms
  const speeddiff = bench_speeddiff(name, hz)
  const speeddiffstr = speeddiff==0?'': speeddiff>0
    ? `\u001b[32m+${speeddiff}%\u001b[0m`
    : `\u001b[31m${speeddiff}%\u001b[0m`
  console.log(
    `\u001b[36m${name}\u001b[0m`,
    '|', `\u001b[36m${medianms.toFixed(2)} ms\u001b[0m`,
    '|', `${Math.round(hz).toLocaleString()} ops/sec`,
    `${speeddiffstr?speeddiffstr+' ':''}|`, samplecount, 'cold samples'
  )
}

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

  const medianloopms = getmedian(loopmsarr)
  const hz = 1000/(medianloopms/loopcount)

  // Compare the median throughput with the matching baseline below.
  const speeddiff = bench_speeddiff(name, hz)
  const speeddiffstr = speeddiff==0?'': speeddiff>0 ? cmdgreen(`+${speeddiff}%`) : cmdred(`${speeddiff}%`)

  console.log(
    cmdyellow(name),
    'x', cmdyellow(hz>1000?(+Math.round(hz)).toLocaleString() : hz.toFixed(2)), 'ops/sec',
    `${speeddiffstr?speeddiffstr+' ':''}|`, loopmsarr.length.toString(), 'runs sampled'
  )

  function cmdyellow(x) { return isNode ? `${'\u001b[33m'}${x}${'\u001b[0m'}` : x }
  function cmdred(x)    { return isNode ? `${'\u001b[31m'}${x}${'\u001b[0m'}`: x }
  function cmdgreen(x)  { return isNode ? `${'\u001b[32m'}${x}${'\u001b[0m'}`: x }
  function getmedian(a) {
    a.sort((x,y)=>x-y)
    const middle = a.length >> 1
    return a.length % 2 ? a[middle] : (a[middle-1] + a[middle]) / 2
  }
}
function bench_speeddiff(name, hz) {
  // fuzzysort 3.0
  var baseline = `
    single raw cached target x 11,527,279 ops/sec | 18 runs sampled
    single successful non-substring x 7,211,750 ops/sec | 14 runs sampled
    single unsuccessful bitflags x 103,964,606 ops/sec | 21 runs sampled
    single unsuccessful scan x 19,342,006 ops/sec | 11 runs sampled
    single character x 40,550,989 ops/sec | 17 runs sampled
    prepare ascii target x 1,871,045 ops/sec | 28 runs sampled
    prepare unicode target x 397,721 ops/sec | 11 runs sampled
    prepare all UE4 targets | 5.25 ms | 191 ops/sec | 25 cold samples
    first go raw UE4 targets | 4.62 ms | 216 ops/sec | 25 cold samples
    first go prepared UE4 targets | 0.81 ms | 1,238 ops/sec | 25 cold samples
    second go prepared UE4 targets | 0.56 ms | 1,791 ops/sec | 25 cold samples
    prepare all Steam targets | 147.42 ms | 7 ops/sec | 15 cold samples
    first "e" raw Steam targets | 182.87 ms | 5 ops/sec | 15 cold samples
    first "e" prepared Steam targets | 15.46 ms | 65 ops/sec | 15 cold samples
    second "e" prepared Steam targets | 6.52 ms | 153 ops/sec | 15 cold samples
    go prepared limit 1 x 2,929 ops/sec | 10 runs sampled
    go prepared limit 10 x 3,004 ops/sec | 10 runs sampled
    go prepared limit 100 focused x 2,619 ops/sec | 9 runs sampled
    go prepared unlimited focused x 2,312 ops/sec | 10 runs sampled
    go prepared threshold x 2,928 ops/sec | 10 runs sampled
    go Steam "e" limit 10 x 151.23 ops/sec | 18 runs sampled
    go Steam "e" limit 100 x 147.75 ops/sec | 9 runs sampled
    go Steam "e" unlimited x 12.36 ops/sec | 2 runs sampled
    type "elder" prepared Steam targets | 59.00 ms | 17 ops/sec | 15 cold samples
    go raw cached limit 10 x 1,372 ops/sec | 16 runs sampled
    go raw cold cache limit 10 x 155.10 ops/sec | 8 runs sampled
    go key direct x 1,235 ops/sec | 7 runs sampled
    go key dotted x 887.21 ops/sec | 12 runs sampled
    go key array x 969.68 ops/sec | 11 runs sampled
    go key function x 1,358 ops/sec | 8 runs sampled
    go keys focused x 664.38 ops/sec | 13 runs sampled
    go keys scoreFn x 736.94 ops/sec | 14 runs sampled
    go results unread x 2,916 ops/sec | 10 runs sampled
    go results score read x 2,779 ops/sec | 10 runs sampled
    go results indexes read x 2,840 ops/sec | 10 runs sampled
    spaces & keys x 3,739 ops/sec | 11 runs sampled
    highlight x 227,685 ops/sec | 10 runs sampled
    highlight callback x 135,385 ops/sec | 14 runs sampled
    tricky x 7,043,466 ops/sec | 13 runs sampled
    tricky space x 2,154,577 ops/sec | 10 runs sampled
    tricky lot of space x 1,657,492 ops/sec | 9 runs sampled
    go prepared spaces x 389.43 ops/sec | 12 runs sampled
    go key spaces x 232.21 ops/sec | 10 runs sampled
    go prepared x 873.66 ops/sec | 12 runs sampled
    go prepared nolimit x 228.20 ops/sec | 10 runs sampled
    go prepared key x 786.91 ops/sec | 15 runs sampled
    go key x 366.87 ops/sec | 10 runs sampled
    go keys x 314.15 ops/sec | 10 runs sampled
    go str x 410.90 ops/sec | 11 runs sampled
    huge nomatch x 94,163,036 ops/sec | 19 runs sampled
    huge nomatch !bitflags x 3,035,058 ops/sec | 10 runs sampled
    tricky x 7,021,840 ops/sec | 12 runs sampled
    small x 26,935,857 ops/sec | 12 runs sampled
    somematch x 32,752,331 ops/sec | 12 runs sampled
  `
  const escapeRegex = str => str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
  // Normal benchmarks store throughput after "x". Cold benchmarks store the
  // more precise latency, so derive their baseline throughput from milliseconds.
  const re = new RegExp(`^\\s*${escapeRegex(name)}(?: x ([^\\s]+)| \\| ([^\\s]+) ms \\|)`, 'm')

  const matches = baseline.match(re)
  if(!matches) return 0
  const baselinehz = matches[1]
    ? parseFloat(matches[1].replace(/[^\d\.]/g, ''))
    : 1000 / parseFloat(matches[2].replace(/[^\d\.]/g, ''))
  return Math.floor((hz/baselinehz-1)*100   *100)/100
}
