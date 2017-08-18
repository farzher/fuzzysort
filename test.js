/*
WHAT: Test and then benchmark
USAGE: Run this file in node

HOW TO WRITE TESTS:
      target         ...matches...               after null must not match
test('APPLES',      'app', 'l', 'E',               null,     'xxx')
               matches must not get better
*/
if(typeof fuzzysort === 'undefined') fuzzysort = require('./fuzzysort')

// Config
  // fuzzysort.highlightMatches = false
  fuzzysort.noMatchLimit = 100
  const benchmark_duration = .1


setTimeout(() => {
  tests()

  if(!assert.failed) { // only if tests passed will we bench
    console.log('all tests passed')

    const isNode = typeof require !== 'undefined' && typeof window === 'undefined'
    // Only bench on node. Don't want the demo to lag
      if(isNode) bench()
  }
})




async function tests() {
  test('APPLES', 'app', 'l', 'E')
  test('C:/users/farzher/dropbox/someotherfolder/pocket rumble refactor/Run.bat', 'po', 'p', 'po ru', 'pr', 'prrun', 'ocket umble')
  test('123abc', '12', '1', 'a', null, 'cc')

  test('az bx cyy y', 'az', 'ab', 'ay', 'ax', 'ayy')
  test('aab x', 'ax', 'ab') // this could cause a to get pushed forward then strict match ab in the middle

  test('Thoug ht', 'ht', 'hh')

  test('noodle monster', 'nomon', null, 'qrs')
  test('noodle monster '.repeat(100), null, 'a')

  var tmp = fuzzysort.go('a', ['ba', 'bA', 'a', 'bA', 'ba'])
  assert(tmp[0].score===0, 'go sorting')

  var tmp = await fuzzysort.goAsync('a', ['ba', 'bA', 'a', 'bA', 'ba'])
  assert(tmp[0].score===0, 'goAsync sorting')
}








function bench() {
  if(typeof Benchmark === 'undefined') Benchmark = require('benchmark')
  Benchmark.options.maxTime = benchmark_duration
  const suite = new Benchmark.Suite

  // random_strings = new Array(100000)
  // for (var i = 0; i < 100000; i++) random_strings[i] = randomString(seededRand(1, 100))
  if(typeof testdata === 'undefined') testdata = require('./testdata')
  random_strings = testdata.ue4_filenames

  // suite.add('loop++', function() {
  //   const len = random_strings.length
  //   const results = []
  //   var currentLen = 0
  //   for (var i = 0; i < len; i++) {
  //     const result = fuzzysort.single('search', random_strings[i])
  //     if(result) results[currentLen++] = result
  //   }
  //   results.sort((a, b) => a.score - b.score)
  // })

  suite.add('loop.push()', function() {
    const len = random_strings.length
    const results = []
    for (var i = 0; i < len; i++) {
      const result = fuzzysort.single('search', random_strings[i])
      if(result) results.push(result)
    }
    results.sort((a, b) => a.score - b.score)
  })

  suite.add('go', function() {
    fuzzysort.go('search', random_strings)
  })

  suite.add('goAsync', function(deferred) {
    fuzzysort.goAsync('search', random_strings).then(()=>{deferred.resolve()})
  }, {defer:true})

  suite.add('goAsync.cancel()', function(deferred) {
    const p = fuzzysort.goAsync('search', random_strings)
    p.then(()=>{deferred.resolve()}, ()=>{deferred.resolve()})
    p.cancel()
  }, {defer:true})

  suite.add('huge', function() {
    fuzzysort.single('a', 'noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster')
  })

  suite.add('tricky', function() {
    fuzzysort.single('prrun', 'C:/users/farzher/dropbox/someotherfolder/pocket rumble refactor/Run.bat')
  })

  suite.add('small', function() {
    fuzzysort.single('al', 'alexstrasa')
  })

  suite.add('nomatch', function() {
    fuzzysort.single('texxx', 'template/index')
  })

  suite.on('cycle', function(e) {
    console.log(String(e.target))
  })

  console.log('now benching')
  suite.run()
}




















// helper function nonsense
function assert(b, m=undefined) {
  if(!b) {
  console.log(assert.count, 'ASSERTION FAILED!!!!!!!', m)
  assert.failed = true
  } else {
  // console.log(assert.count, 'test passed')
  }

  assert.count += 1
}
assert.count = 0

function test(target, ...searches) {
  var last_score = -1
  var needs_to_fail = false

  for (var i = 0; i < searches.length; i++) {

    var search = searches[i]
    if(search === null) {
      needs_to_fail = true
      continue
    }

    const result = fuzzysort.single(searches[i], target)
    var score = undefined
    if(result) score = result.score

    var info = {score, last_score, target, search}
    if(needs_to_fail) {
      assert(score===undefined, info)
    } else {
      assert(score!==undefined, info)
      assert(score>=last_score, info)
      last_score = score
    }
  }
}

// function randomString(len, charSet) {
//     charSet = charSet || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ,./\]["<>?:{}!@#$%^&*()_+=-';
//     var randomString = '';
//     for (var i = 0; i < len; i++) {
//         var randomPoz = Math.floor(seededRand() * charSet.length);
//         randomString += charSet.substring(randomPoz,randomPoz+1);
//     }
//     return randomString;
// }

// function seededRand(max=1, min=0) {
//   if(min) [max,min]=[min,max]
//   seededRand.seed = (seededRand.seed * 9301 + 49297) % 233280
//   var rnd = seededRand.seed / 233280
//   return min + rnd * (max - min)
// }
// seededRand.seed = 0
