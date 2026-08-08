/*
WHAT: Checks for bugs, and then benchmarks to check for performance issues
USAGE: npm test / node test/test.js / serve the repo over HTTP and open test/test.html

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
  for(const key of Object.keys(testdata)) {
    const first = testdata[key][0]
    const keys = first && typeof first === 'object' ? Object.keys(first) : null
    testdata_prepared[key] = fuzzysort.snapshot(testdata[key], keys ? {keys} : undefined)
  }
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
  else if(isNode) process.exitCode = 1

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

  { // remap diacritics / accents / ligatures
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

    // custom mappings can add new equivalents and override built-ins
    assert(!fuzzysort.single('x', '☃'), 'custom remap target starts distinct')
    assert(fuzzysort.single('l', 'ł'), 'built-in remap works before override')
    fuzzysort.remap({'☃':'x', 'ł':'x'})
    assert(fuzzysort.single('x', '☃'), 'custom remap invalidates cached target')
    assert(fuzzysort.single('☃', 'x'), 'custom remap invalidates cached search')
    assert(fuzzysort.go('x', ['☃'])[0].highlight() === '<b>☃</b>', 'custom remap works with go')
    assert(fuzzysort.go('x', fuzzysort.snapshot(['☃']))[0].target === '☃', 'custom remap works with prepared targets')
    assert(fuzzysort.single('x', 'ł') && !fuzzysort.single('l', 'ł'), 'custom remap overrides built-in')

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
    var results = fuzzysort.go('va', fuzzysort.snapshot(symbolTargets, {key:s}))
    assert(results.length==1)
    var results = fuzzysort.go('va', fuzzysort.snapshot(symbolTargets, {keys:[s]}))
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
    assert(typeof fuzzysort.snapshot === 'function', 'snapshot is public')
    assert(fuzzysort.index === undefined, 'index is not public')

    var raw = fuzzysort.go('render', ['PreRender/render target'])
    var prepared = fuzzysort.go('render', fuzzysort.snapshot(['PreRender/render target']))
    assert(raw[0]._score === prepared[0]._score, 'raw/prepared score equality')
    assert(JSON.stringify(raw[0].indexes) === JSON.stringify(prepared[0].indexes), 'raw/prepared indexes equality')

    var preparedTarget = fuzzysort.prepare('PreRender/render target')
    assert(preparedTarget.target === 'PreRender/render target', 'prepare one target preserves the string')
    var singlePreparedTarget = fuzzysort.single('render', preparedTarget)
    assert(singlePreparedTarget._score === raw[0]._score, 'single accepts a prepared target')
    assert(JSON.stringify(singlePreparedTarget.indexes) === JSON.stringify(raw[0].indexes), 'prepared target indexes equality')

    var mutableTargets = [fuzzysort.prepare('Apple'), 'Banana']
    mutableTargets.push(fuzzysort.prepare('Cherry'))
    assert(fuzzysort.go('cherry', mutableTargets)[0].target === 'Cherry', 'prepared targets can be added')
    mutableTargets[0] = fuzzysort.prepare('Orange')
    assert(fuzzysort.go('orange', mutableTargets)[0].target === 'Orange', 'prepared targets can be replaced')
    mutableTargets.splice(1, 1)
    assert(fuzzysort.go('banana', mutableTargets).length === 0, 'prepared targets can be removed')

    var mutableObject = {name:'Alpha', preparedName:fuzzysort.prepare('Alpha')}
    assert(fuzzysort.go('alpha', [mutableObject], {key:'preparedName'})[0].obj === mutableObject, 'key accepts a prepared target')
    mutableObject.name = 'Beta'
    mutableObject.preparedName = fuzzysort.prepare(mutableObject.name)
    assert(fuzzysort.go('beta', [mutableObject], {key:'preparedName'})[0].obj === mutableObject, 'prepared object keys can be updated')

    var prepareCalls = 0
    var lazyObjects = Array.from({length:101}, (_, i) => ({name:'item ' + i}))
    var lazyPrepared = fuzzysort.snapshot(lazyObjects, {key: obj => { prepareCalls++; return obj.name }})
    assert(prepareCalls === 0, 'large prepare returns before doing background work')
    assert(fuzzysort.go('item 100', lazyPrepared)[0].obj === lazyObjects[100], 'go finishes pending preparation')
    assert(prepareCalls === lazyObjects.length, 'go finishes every pending target')

    // Prefer a later word beginning over an earlier mid-word character. Every
    // letter in a prepared collection has an independent precomputed entry.
    var singleCharacters = fuzzysort.snapshot(['foobar baz'])
    var result = fuzzysort.go('b', singleCharacters)[0]
    assert(result.indexes[0] === 7, 'single-character beginning match')
    assert(fuzzysort.go('f', singleCharacters)[0].indexes[0] === 0, 'prepared single-character switch')
    assert(fuzzysort.go('b', singleCharacters)[0].indexes[0] === 7, 'prepared single-character switch back')

    // Snapshot caches preserve results and transparently fall back when a
    // request needs more rows than the cached query contains.
    var cachedTargets = ['alpha', 'alphabet', 'alpine', 'beta']
    var cachedSnapshot = fuzzysort.snapshot(cachedTargets)
    var cachedAlpha = fuzzysort.go('al', cachedSnapshot, {limit:1})
    fuzzysort.go('b', cachedSnapshot, {limit:1})
    var cachedAlphaAgain = fuzzysort.go('al', cachedSnapshot, {limit:1})
    assert(cachedAlphaAgain.total === cachedAlpha.total && cachedAlphaAgain[0].target === cachedAlpha[0].target, 'snapshot cached query')
    cachedAlphaAgain[0].indexes = [4]
    assert(fuzzysort.go('al', cachedSnapshot, {limit:1})[0].indexes[0] === 0, 'snapshot cache returns independent results')
    var expandedAlpha = fuzzysort.go('al', cachedSnapshot, {limit:3})
    assert(expandedAlpha.length === 3 && expandedAlpha.total === 3, 'snapshot cache falls back for a larger limit')
    var cachedTies = Array.from({length:150}, (_, id) => ({id, name:'alpha'}))
    var cachedTieSnapshot = fuzzysort.snapshot(cachedTies, {key:'name'})
    fuzzysort.go('a', cachedTieSnapshot, {limit:128})
    // var cachedTieResults = fuzzysort.go('a', cachedTieSnapshot, {limit:10})
    // assert(cachedTieResults.every((result, i) => result.obj.id === i), 'snapshot cached ties preserve input order')

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

    var preparedKey = fuzzysort.snapshot(keyPaths, {key:'nested.value'})
    assert(fuzzysort.go('beta', preparedKey)[0].obj === keyPaths[0], 'prepared key preserves object')
    var preparedKeys = fuzzysort.snapshot(keyPaths, {keys:['direct', 'nested.value']})
    assert(fuzzysort.go('alpha beta', preparedKeys)[0].obj === keyPaths[0], 'prepared keys preserve object')
    assert(fuzzysort.go('', preparedKey, {all:true})[0].obj === keyPaths[0], 'prepared key all')

    var multiKeyTargets = [
      {name:'Elder Scrolls', description:'Fantasy role-playing game'},
      {name:'Portal', description:'First-person puzzle game'},
      {name:'Missing description'},
    ]
    var rawKeys = fuzzysort.go('scrolls fantasy', multiKeyTargets, {keys:['name', 'description']})
    var preparedMultiKeys = fuzzysort.snapshot(multiKeyTargets, {keys:['name', 'description']})
    var preparedKeysResults = fuzzysort.go('scrolls fantasy', preparedMultiKeys)
    assert(preparedKeysResults[0].obj === multiKeyTargets[0], 'prepared multiple keys preserves object')
    assert(preparedKeysResults[0].score === rawKeys[0].score, 'prepared multiple keys preserves score')
    assert(preparedKeysResults[0][0].highlight() === rawKeys[0][0].highlight(), 'prepared multiple keys preserves first key match')
    assert(preparedKeysResults[0][1].highlight() === rawKeys[0][1].highlight(), 'prepared multiple keys preserves second key match')

    // Prepared multi-word matching must preserve raw matching behavior across
    // word joins, backtracking, out-of-order terms, and long targets.
    var packedWordCases = [
      ['straw berry', 'strawberry'],
      ['zz cat', 'xcat--zzcat'],
      ['a bq', 'abx_bq'],
      ['bar foo baz', 'foobarbaz'],
      ['foo bar', 'x '.repeat(25) + 'foobar'],
    ]
    for(var packedWordI = 0; packedWordI < packedWordCases.length; packedWordI++) {
      var packedWordSearch = packedWordCases[packedWordI][0]
      var packedWordTarget = packedWordCases[packedWordI][1]
      var rawPackedWord = fuzzysort.single(packedWordSearch, packedWordTarget)
      var preparedPackedWord = fuzzysort.go(packedWordSearch, fuzzysort.snapshot([packedWordTarget]), {limit:1})[0]
      assert(preparedPackedWord.score === rawPackedWord.score, 'prepared packed multi-word score')
      assert(JSON.stringify(preparedPackedWord.indexes) === JSON.stringify(rawPackedWord.indexes), 'prepared packed multi-word indexes')
      assert(preparedPackedWord.highlight() === rawPackedWord.highlight(), 'prepared packed multi-word highlight')
    }

    var packedWordObject = {value:'strawberry'}
    var rawPackedWordKey = fuzzysort.go('straw berry', [packedWordObject], {key:'value'})[0]
    var preparedPackedWordKey = fuzzysort.go('straw berry', fuzzysort.snapshot([packedWordObject], {key:'value'}), {limit:1})[0]
    assert(preparedPackedWordKey.obj === packedWordObject, 'prepared packed multi-word key object')
    assert(preparedPackedWordKey.score === rawPackedWordKey.score && preparedPackedWordKey.highlight() === rawPackedWordKey.highlight(), 'prepared packed multi-word key result')

    var splitWordTargets = [
      {id:'split-forward', first:'alpha', second:'beta'},
      {id:'split-reversed', first:'beta', second:'alpha'},
      {id:'flags-only', first:'albe', second:'phata'},
    ]
    var rawSplitWords = fuzzysort.go('alpha beta', splitWordTargets, {keys:['first', 'second']})
    var preparedSplitWords = fuzzysort.go('alpha beta', fuzzysort.snapshot(splitWordTargets, {keys:['first', 'second']}), {limit:2})
    assert(rawSplitWords.length === 2 && preparedSplitWords.length === 2, 'prepared word rejection keeps cross-key matches and rejects flags-only rows')
    assert(preparedSplitWords[0].obj === rawSplitWords[0].obj && preparedSplitWords[1].obj === rawSplitWords[1].obj, 'prepared split words preserve ordering')
    assert(preparedSplitWords[0].score === rawSplitWords[0].score && preparedSplitWords[1].score === rawSplitWords[1].score, 'prepared split words preserve scores')

    var splitCharacterTargets = [
      {id:'split-characters', first:'a', second:'b'},
      {id:'whole-query', first:'ab', second:'other'},
      {id:'out-of-order', first:'ba', second:'other'},
    ]
    var rawSplitCharacters = fuzzysort.go('ab', splitCharacterTargets, {keys:['first', 'second']})
    var preparedSplitCharacters = fuzzysort.go('ab', fuzzysort.snapshot(splitCharacterTargets, {keys:['first', 'second']}))
    assert(rawSplitCharacters.length === 1 && rawSplitCharacters[0].obj.id === 'whole-query', 'multiple keys reject characters split across keys')
    assert(preparedSplitCharacters.length === 1 && preparedSplitCharacters[0].obj === rawSplitCharacters[0].obj, 'prepared multiple keys preserve per-key character rejection')
    assert(preparedSplitCharacters[0].score === rawSplitCharacters[0].score && preparedSplitCharacters[0][0].highlight() === rawSplitCharacters[0][0].highlight(), 'prepared per-key rejection preserves scores and highlighting')

    var preparedStrideTargets = [
      {id:'first-row', first:'alpha', second:'other', third:'value'},
      {id:'missing-middle', first:'other', third:'needle'},
      {id:'last-row', first:'other', second:'value', third:'omega'},
    ]
    var preparedStrides = fuzzysort.snapshot(preparedStrideTargets, {keys:['first', 'second', 'third']})
    var preparedStrideResult = fuzzysort.go('needle', preparedStrides)
    assert(preparedStrideResult.length === 1 && preparedStrideResult[0].obj === preparedStrideTargets[1], 'prepared flattened keys preserve row identity and key stride')
    assert(preparedStrideResult[0][0].target === '' && preparedStrideResult[0][1].target === '' && preparedStrideResult[0][2].target === 'needle', 'prepared flattened keys preserve unmatched, missing, and trailing values')
    var preparedStrideAll = fuzzysort.go('', preparedStrides, {all:true})
    assert(preparedStrideAll.total === 3 && preparedStrideAll[2].obj === preparedStrideTargets[2] && preparedStrideAll[2][2].target === 'omega', 'prepared flattened keys preserve empty-search rows')
    var preparedNoKeys = fuzzysort.snapshot(preparedStrideTargets, {keys:[]})
    var preparedNoKeysAll = fuzzysort.go('', preparedNoKeys, {all:true, limit:2})
    assert(preparedNoKeysAll.length === 2 && preparedNoKeysAll.total === 3 && preparedNoKeysAll[0].length === 0 && preparedNoKeysAll[1].obj === preparedStrideTargets[1], 'prepared empty key lists preserve all results')

    var preparedShortKeys = fuzzysort.snapshot([{name:'foobar baz', description:'other value'}], {keys:['name', 'description']})
    assert(fuzzysort.go('b', preparedShortKeys)[0][0].indexes[0] === 7, 'prepared multiple keys one-character optimization')
    var twoCharacterResult = fuzzysort.go('ba', preparedShortKeys)[0][0]
    assert(twoCharacterResult.indexes[0] === 7 && twoCharacterResult.indexes[1] === 8, 'prepared multiple keys two-character optimization')

    // Targets at this boundary skip Uint16 indexes and use the regular matcher.
    var uint16BoundaryTarget = 'a'.repeat(65535)
    var rawBoundaryResult = fuzzysort.go('aaaa', [uint16BoundaryTarget], {limit:1})[0]
    var preparedBoundaryResult = fuzzysort.go('aaaa', fuzzysort.snapshot([uint16BoundaryTarget]), {limit:1})[0]
    assert(preparedBoundaryResult.score === rawBoundaryResult.score, 'prepared long value score at Uint16 boundary')
    assert(JSON.stringify(preparedBoundaryResult.indexes) === JSON.stringify(rawBoundaryResult.indexes), 'prepared long value indexes at Uint16 boundary')

    var uint16BoundaryWords = 'a'.repeat(65532) + 'bbb'
    var rawBoundaryWords = fuzzysort.single('aaaa bbb', uint16BoundaryWords)
    var preparedBoundaryWords = fuzzysort.go('aaaa bbb', fuzzysort.snapshot([uint16BoundaryWords]), {limit:1})[0]
    assert(preparedBoundaryWords.score === rawBoundaryWords.score, 'prepared long multi-word score at Uint16 boundary')
    assert(JSON.stringify(preparedBoundaryWords.indexes) === JSON.stringify(rawBoundaryWords.indexes), 'prepared long multi-word indexes at Uint16 boundary')

    var boundaryObjects = [{name:uint16BoundaryTarget, description:'other'}]
    var rawBoundaryKeys = fuzzysort.go('aaaa', boundaryObjects, {keys:['name', 'description'], limit:1})[0]
    var preparedBoundaryKeys = fuzzysort.go('aaaa', fuzzysort.snapshot(boundaryObjects, {keys:['name', 'description']}), {limit:1})[0]
    assert(preparedBoundaryKeys.score === rawBoundaryKeys.score, 'prepared long keys score at Uint16 boundary')
    assert(JSON.stringify(preparedBoundaryKeys[0].indexes) === JSON.stringify(rawBoundaryKeys[0].indexes), 'prepared long keys indexes at Uint16 boundary')

    // Limited prepared multi-key searches compute with internal matches, but
    // only materialize candidates that can enter the result heap.
    var limitedKeyTargets = [
      {id:'weak', name:'a----b'},
      {id:'best-first', name:'ab'},
      {id:'best-later', name:'ab'},
      {id:'best-other-key', description:'ab'},
    ]
    var limitedKeyOptions = {keys:['name', 'description'], limit:1}
    var rawLimitedKeys = fuzzysort.go('ab', limitedKeyTargets, limitedKeyOptions)
    var preparedLimitedKeys = fuzzysort.go('ab', fuzzysort.snapshot(limitedKeyTargets, limitedKeyOptions), {limit:1})
    assert(preparedLimitedKeys.length === 1 && preparedLimitedKeys.total === 4, 'prepared keys limit preserves total')
    assert(preparedLimitedKeys[0].obj === limitedKeyTargets[1], 'prepared keys limit replaces weak result and keeps first best tie')
    assert(preparedLimitedKeys[0][0].highlight() === '<b>ab</b>', 'prepared keys limit preserves highlighting')
    assert(preparedLimitedKeys[0].score === rawLimitedKeys[0].score, 'prepared keys limit preserves score')

    var bestThreshold = rawLimitedKeys[0].score * .999
    var rawThresholdKeys = fuzzysort.go('ab', limitedKeyTargets, {keys:['name', 'description'], limit:2, threshold:bestThreshold})
    var preparedThresholdKeys = fuzzysort.go('ab', fuzzysort.snapshot(limitedKeyTargets, limitedKeyOptions), {limit:2, threshold:bestThreshold})
    assert(preparedThresholdKeys.total === rawThresholdKeys.total, 'prepared keys threshold preserves total')
    assert(preparedThresholdKeys.length === rawThresholdKeys.length, 'prepared keys threshold preserves limit')
    for(var thresholdI = 0; thresholdI < rawThresholdKeys.length; thresholdI++) {
      assert(preparedThresholdKeys[thresholdI].obj === rawThresholdKeys[thresholdI].obj, 'prepared keys threshold preserves ordering')
      assert(preparedThresholdKeys[thresholdI].score === rawThresholdKeys[thresholdI].score, 'prepared keys threshold preserves score')
      for(var thresholdK = 0; thresholdK < 2; thresholdK++) {
        assert(preparedThresholdKeys[thresholdI][thresholdK].target === rawThresholdKeys[thresholdI][thresholdK].target, 'prepared keys threshold preserves key target')
        assert(JSON.stringify(preparedThresholdKeys[thresholdI][thresholdK].indexes) === JSON.stringify(rawThresholdKeys[thresholdI][thresholdK].indexes), 'prepared keys threshold preserves key indexes')
      }
    }

    var limitedScoreFnCalls = []
    var preparedLimitedScored = fuzzysort.snapshot([
      {name:'a', rank:2},
      {name:'a', rank:0},
      {name:'a', rank:5},
    ], {keys:['name']})
    var limitedScoreFnResults = fuzzysort.go('a', preparedLimitedScored, {
      limit:1,
      threshold:2,
      scoreFn: result => {
        limitedScoreFnCalls.push(result)
        assert(result[0].indexes[0] === 0 && result[0].highlight() === '<b>a</b>', 'prepared keys scoreFn sees materialized key result')
        return result.obj.rank
      },
    })
    assert(limitedScoreFnCalls.length === 3, 'prepared keys scoreFn runs before limit and threshold')
    assert(limitedScoreFnCalls[0] !== limitedScoreFnCalls[1] && limitedScoreFnCalls[1] !== limitedScoreFnCalls[2], 'prepared keys scoreFn receives distinct results')
    assert(limitedScoreFnResults.length === 1 && limitedScoreFnResults.total === 2, 'prepared keys scoreFn limit preserves total')
    assert(limitedScoreFnResults[0].obj.rank === 5, 'prepared keys scoreFn limit preserves ordering')
    multiKeyTargets[0].name = 'Changed after prepare'
    assert(fuzzysort.go('elder', preparedMultiKeys).length === 1, 'prepared multiple keys is a searchable snapshot')
    assert(fuzzysort.go('elder', multiKeyTargets, {keys:['name', 'description']}).length === 0, 'raw multiple keys reflects changes')

    var scoreFnCalls = 0
    var scored = fuzzysort.go('a', [{name:'a', rank:2}, {name:'a', rank:3}, {name:'a', rank:0}], {
      keys: ['name'],
      scoreFn: result => { ++scoreFnCalls; return result.obj.rank },
    })
    assert(scoreFnCalls === 3, 'scoreFn called for every matching object')
    assert(scored.length === 2 && scored[0].obj.rank === 3 && scored[1].obj.rank === 2, 'scoreFn ordering and zero filtering')

    var stringScoreFnCalls = 0
    var scoredStrings = fuzzysort.go('a', ['a', 'ba', 'ca'], {
      limit: 1,
      threshold: 2,
      scoreFn: result => {
        ++stringScoreFnCalls
        assert(result.indexes.length === 1, 'string scoreFn sees a materialized result')
        return result.target === 'ba' ? 5 : result.target === 'ca' ? 0 : 2
      },
    })
    assert(stringScoreFnCalls === 3, 'string scoreFn runs before limit and threshold')
    assert(scoredStrings.length === 1 && scoredStrings.total === 2 && scoredStrings[0].target === 'ba', 'string scoreFn orders, filters, and preserves total')

    var preparedStringScoreFnCalls = 0
    var preparedScoredStrings = fuzzysort.go('a', fuzzysort.snapshot(['a', 'ba']), {
      scoreFn: result => { ++preparedStringScoreFnCalls; return result.target === 'ba' ? 2 : 1 },
    })
    assert(preparedStringScoreFnCalls === 2 && preparedScoredStrings[0].target === 'ba', 'prepared string scoreFn')

    var keyScoreTargets = [{name:'a', rank:2}, {name:'a', rank:3}, {name:'a', rank:0}]
    var keyScored = fuzzysort.go('a', keyScoreTargets, {
      key: 'name',
      scoreFn: result => result.obj.rank,
    })
    assert(keyScored.length === 2 && keyScored[0].obj.rank === 3, 'key scoreFn ordering and zero filtering')

    var preparedKeyScored = fuzzysort.go('a', fuzzysort.snapshot(keyScoreTargets, {key:'name'}), {
      scoreFn: result => result.obj.rank,
    })
    assert(preparedKeyScored.length === 2 && preparedKeyScored[0].obj.rank === 3, 'prepared key scoreFn')

    scoreFnCalls = 0
    var preparedScored = fuzzysort.snapshot([{name:'a', rank:2}, {name:'a', rank:3}], {keys:['name']})
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
  bench('snapshot + go ascii target', function() {
    var prepared = fuzzysort.snapshot(['C:/Project/Renderer/RenderTarget.cpp'])
    fuzzysort.go('', prepared, {all:true, limit:1})
  }, config)
  bench('snapshot + go unicode target', function() {
    var prepared = fuzzysort.snapshot(['Café/レンダラー/RenderTarget.cpp'])
    fuzzysort.go('', prepared, {all:true, limit:1})
  }, config)

  const focusedPrepared = testdata_prepared.ue4_files
  const focusedRaw = testdata.ue4_files
  const focusedObjects = testdata_obj.ue4_files
  const focusedNestedObjects = focusedRaw.map(str => ({nested:{str}}))
  const steamPrepared = testdata_prepared.steam_games
  const steamRaw = testdata.steam_games

  // Data-cold latency is hidden by the throughput benchmarks because their first
  // call prepares and warms the targets for every subsequent loop iteration.
  benchCold('snapshot all UE4 targets', function() {
    return focusedRaw
  }, function(targets) {
    var prepared = fuzzysort.snapshot(targets)
    fuzzysort.go('', prepared, {all:true, limit:1})
  })
  benchCold('first go raw UE4 targets', function() {
    fuzzysort.cleanup()
    return focusedRaw
  }, function(targets) {
    fuzzysort.go('render', targets, {limit:10})
  })
  benchCold('first go prepared UE4 targets', function() {
    fuzzysort.cleanup()
    return fuzzysort.snapshot(focusedRaw)
  }, function(targets) {
    fuzzysort.go('render', targets, {limit:10})
  })
  benchCold('second go prepared UE4 targets', function() {
    fuzzysort.cleanup()
    var targets = fuzzysort.snapshot(focusedRaw)
    fuzzysort.go('render', targets, {limit:10})
    return targets
  }, function(targets) {
    fuzzysort.go('render', targets, {limit:10})
  })

  // Steam is large enough to expose first-keystroke costs which are difficult to
  // see in the smaller UE4 set. Setup remains outside the measured interval.
  benchCold('snapshot all Steam targets', function() {
    return steamRaw
  }, function(targets) {
    var prepared = fuzzysort.snapshot(targets)
    fuzzysort.go('', prepared, {all:true, limit:1})
  }, {samplecount:15})
  benchCold('first "e" raw Steam targets', function() {
    fuzzysort.cleanup()
    return steamRaw
  }, function(targets) {
    fuzzysort.go('e', targets, {limit:10})
  }, {samplecount:15})
  benchCold('first "e" prepared Steam targets', function() {
    fuzzysort.cleanup()
    return fuzzysort.snapshot(steamRaw)
  }, function(targets) {
    fuzzysort.go('e', targets, {limit:10})
  }, {samplecount:15})
  benchCold('second "e" prepared Steam targets', function() {
    fuzzysort.cleanup()
    var targets = fuzzysort.snapshot(steamRaw)
    fuzzysort.go('e', targets, {limit:10})
    return targets
  }, function(targets) {
    fuzzysort.go('e', targets, {limit:10})
  }, {samplecount:15})

  // Realistic cold interactions: a user types a one-, two-, then three-letter
  // query over the full 183k-row collection. Every sample gets fresh data/query
  // state; snapshot preparation is excluded only for the explicitly "ready"
  // cases, which model an application that indexed before accepting input.
  const typeShortQuery = targets => {
    fuzzysort.go('e', targets, {limit:10})
    fuzzysort.go('el', targets, {limit:10})
    fuzzysort.go('eld', targets, {limit:10})
  }
  const finishSnapshot = targets => {
    fuzzysort.go('', targets, {all:true, limit:1})
    return targets
  }
  const coldSamples = {samplecount:7}
  for(const query of ['e', 'el', 'eld']) {
    benchCold(`cold first "${query}" ready Steam snapshot`, function() {
      fuzzysort.cleanup()
      return finishSnapshot(fuzzysort.snapshot(steamRaw))
    }, function(targets) {
      fuzzysort.go(query, targets, {limit:10})
    }, coldSamples)
  }
  benchCold('cold type "eld" raw Steam strings', function() {
    fuzzysort.cleanup()
    return steamRaw
  }, typeShortQuery, coldSamples)
  benchCold('cold type "eld" new Steam snapshot', function() {
    fuzzysort.cleanup()
    return fuzzysort.snapshot(steamRaw)
  }, typeShortQuery, coldSamples)
  benchCold('cold type "eld" ready Steam snapshot', function() {
    fuzzysort.cleanup()
    return finishSnapshot(fuzzysort.snapshot(steamRaw))
  }, typeShortQuery, coldSamples)
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

  bench('go Steam "el" unlimited', function() {
    fuzzysort.go('el', steamPrepared, {limit:10})
  }, config)

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
  const preparedObjects = fuzzysort.snapshot(testdata_obj.ue4_files, {key:'str'})
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
    single raw cached target x 11,189,295 ops/sec -2.94% | 19 runs sampled
    single successful non-substring x 7,264,297 ops/sec +0.72% | 15 runs sampled
    single unsuccessful bitflags x 95,570,997 ops/sec -8.08% | 20 runs sampled
    single unsuccessful scan x 20,601,262 ops/sec +6.51% | 11 runs sampled
    single character x 38,984,620 ops/sec -3.87% | 15 runs sampled
    prepare ascii target x 2,222,390 ops/sec +18.77% | 31 runs sampled
    prepare unicode target x 393,097 ops/sec -1.17% | 11 runs sampled
    prepare all UE4 targets | 4.95 ms | 202 ops/sec +6.03% | 25 cold samples
    first go raw UE4 targets | 4.29 ms | 233 ops/sec +7.75% | 25 cold samples
    first go prepared UE4 targets | 0.79 ms | 1,265 ops/sec +2.47% | 25 cold samples
    second go prepared UE4 targets | 0.58 ms | 1,724 ops/sec -3.45% | 25 cold samples
    prepare all Steam targets | 144.03 ms | 7 ops/sec +2.35% | 15 cold samples
    first "e" raw Steam targets | 182.47 ms | 5 ops/sec +0.21% | 15 cold samples
    first "e" prepared Steam targets | 15.15 ms | 66 ops/sec +2.07% | 15 cold samples
    second "e" prepared Steam targets | 6.30 ms | 159 ops/sec +3.52% | 15 cold samples
    go prepared limit 1 x 3,023 ops/sec +3.22% | 10 runs sampled
    go prepared limit 10 x 2,995 ops/sec -0.32% | 10 runs sampled
    go prepared limit 100 focused x 2,706 ops/sec +3.32% | 9 runs sampled
    go prepared unlimited focused x 2,378 ops/sec +2.86% | 10 runs sampled
    go prepared threshold x 3,015 ops/sec +2.96% | 10 runs sampled
    go Steam "e" limit 10 x 150.81 ops/sec -0.28% | 18 runs sampled
    go Steam "e" limit 100 x 148.34 ops/sec +0.39% | 9 runs sampled
    go Steam "e" unlimited x 12.49 ops/sec +1.04% | 2 runs sampled
    type "elder" prepared Steam targets | 62.18 ms | 16 ops/sec -5.12% | 15 cold samples
    go Steam "el" unlimited x 51.09 ops/sec | 12 runs sampled
    go raw cached limit 10 x 1,498 ops/sec +9.17% | 17 runs sampled
    go raw cold cache limit 10 x 158.64 ops/sec +2.28% | 8 runs sampled
    go key direct x 1,300 ops/sec +5.28% | 8 runs sampled
    go key dotted x 939.06 ops/sec +5.84% | 12 runs sampled
    go key array x 997.15 ops/sec +2.83% | 11 runs sampled
    go key function x 1,337 ops/sec -1.53% | 8 runs sampled
    go keys focused x 675.36 ops/sec +1.65% | 13 runs sampled
    go keys scoreFn x 731.64 ops/sec -0.72% | 11 runs sampled
    go results unread x 3,000 ops/sec +2.88% | 10 runs sampled
    go results score read x 2,961 ops/sec +6.54% | 10 runs sampled
    go results indexes read x 2,998 ops/sec +5.55% | 10 runs sampled
    spaces & keys x 4,093 ops/sec +9.47% | 12 runs sampled
    highlight x 212,020 ops/sec -6.88% | 23 runs sampled
    highlight callback x 124,148 ops/sec -8.3% | 16 runs sampled
    tricky x 6,990,769 ops/sec -0.75% | 12 runs sampled
    tricky space x 2,164,427 ops/sec +0.45% | 10 runs sampled
    tricky lot of space x 1,664,719 ops/sec +0.43% | 9 runs sampled
    go prepared spaces x 389.74 ops/sec +0.07% | 12 runs sampled
    go key spaces x 228.79 ops/sec -1.48% | 11 runs sampled
    go prepared x 901.59 ops/sec +3.19% | 13 runs sampled
    go prepared nolimit x 232.49 ops/sec +1.88% | 10 runs sampled
    go prepared key x 781.32 ops/sec -0.72% | 13 runs sampled
    go key x 356.27 ops/sec -2.9% | 11 runs sampled
    go keys x 298.11 ops/sec -5.11% | 10 runs sampled
    go str x 403.03 ops/sec -1.92% | 10 runs sampled
    huge nomatch x 92,778,433 ops/sec -1.48% | 20 runs sampled
    huge nomatch !bitflags x 3,115,093 ops/sec +2.63% | 11 runs sampled
    tricky x 7,156,432 ops/sec +1.6% | 13 runs sampled
    small x 24,724,164 ops/sec -8.22% | 12 runs sampled
    somematch x 33,894,630 ops/sec +3.48% | 14 runs sampled
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
