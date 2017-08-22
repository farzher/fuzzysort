// function f1(a, o=null) {
//   if(o===null) o = {b:false}
//   return o.b
// }
// function f12(a, o={}) {
//   if(o.b===undefined) o.b=false
//   return o.b
// }
// function f13(a, o=null) {
//   return o&&o.b
// }
// function f2(a, {b}={b:false}) {
//   return b
// }
// function f3(a, b=false) {
//   return b
// }


// if(typeof Benchmark === 'undefined') Benchmark = require('benchmark')
// Benchmark.options.maxTime = 1
// const suite = new Benchmark.Suite
// suite.add('f1', function() {
//   return f1(1, {b:false})
// })
// suite.add('f12', function() {
//   return f12(1, {b:false})
// })
// suite.add('f13', function() {
//   return f13(1, {b:false})
// })
// suite.add('f2', function() {
//   return f2(1, {b:false})
// })
// suite.add('f3', function() {
//   return f3(1, false)
// })
// suite.add('f1 null', function() {
//   return f1(1)
// })
// suite.add('f12 null', function() {
//   return f12(1)
// })
// suite.add('f13 null', function() {
//   return f13(1)
// })
// suite.add('f2 null', function() {
//   return f2(1)
// })
// suite.add('f3 null', function() {
//   return f3(1)
// })
// suite.on('cycle', function(e) {
//   console.log(String(e.target))
// })
// suite.run()
// process.exit()




/*
WHAT: Test and then benchmark
USAGE: Run this file in node

HOW TO WRITE TESTS:
      target         ...matches...               after null must not match
test('APPLES',      'app', 'l', 'E',               null,     'xxx')
               matches must not get better
*/
const isNode = typeof require !== 'undefined' && typeof window === 'undefined'
if(isNode) fuzzysort = require('./fuzzysort')

// Config
  // fuzzysort.highlightMatches = false
  // fuzzysort.noMatchLimit = 100
  fuzzysort.noMatchLimit = 50
  fuzzysort.limit = 100
  // fuzzysort.threshold = 999
  const benchmark_duration = 1
  const enable_tests = true


if(isNode) testdata = require('./testdata')
// random_strings = new Array(100000)
// for (var i = 0; i < 100000; i++) random_strings[i] = randomString(seededRand(1, 100))

for(var key of Object.keys(testdata)) {
  for(var i = testdata[key].length-1; i>=0; i-=1) {
    const lower = testdata[key][i].toLowerCase()
    testdata[key][i] = {
      _target: testdata[key][i],
      _targetLower: lower,
      // len: lower.length,
      // firstCharCode: lower.charCodeAt(0)
    }
  }
}

random_strings = testdata.ue4_filenames


setTimeout(async function() {
  if(enable_tests) await tests()

  if(!assert.failed) { // only if tests passed will we bench
    if(assert.count>0) console.log('all tests passed')
    else console.log('testing is disabled!')

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

  test('sax saxax y', 'y', 'sx') // this is caused if isConsec gets messedup

  test('noodle monster', 'nomon', null, 'qrs')
  test('noodle monster '.repeat(100), null, 'a')

  var tmp = fuzzysort.go('a', ['ba', 'bA', 'a', 'bA', 'xx', 'ba'])
  assert(tmp[0].score===0, 'go sorting')
  assert(tmp.length===5, 'go sorting length')
  assert(tmp.total===5, 'go sorting length')

  var tmp = await fuzzysort.goAsync('a', ['ba', 'bA', 'a', 'bA', 'xx', 'ba'])
  assert(tmp[0].score===0, 'goAsync sorting')
  assert(tmp.length===5, 'goAsync sorting length')
  assert(tmp.total===5, 'goAsync sorting length')
}








function bench() {
  if(isNode) Benchmark = require('benchmark')
  Benchmark.options.maxTime = benchmark_duration
  const suite = new Benchmark.Suite

  // suite.add('single', function() {
  //   const len = random_strings.length
  //   const results = []
  //   for (var i = 0; i < len; i++) {
  //     const result = fuzzysort.single('a', random_strings[i])
  //     if(result) results.push(result)
  //   }
  //   results.sort((a, b) => a.score - b.score)
  // })

  suite.add('go', function() {
    fuzzysort.go('e', random_strings)
    fuzzysort.go('a', random_strings)
    fuzzysort.go('mrender.h', random_strings)
  })

  suite.add('goAsync', function(deferred) {
    var count = 0
    fuzzysort.goAsync('e', random_strings).then(()=>{count+=1; if(count===3)deferred.resolve()})
    fuzzysort.goAsync('a', random_strings).then(()=>{count+=1; if(count===3)deferred.resolve()})
    fuzzysort.goAsync('mrender.h', random_strings).then(()=>{count+=1; if(count===3)deferred.resolve()})
  }, {defer:true})

  suite.add('goAsync.cancel()', function(deferred) {
    const p = fuzzysort.goAsync('e', random_strings)
    p.then(()=>{deferred.resolve()}, ()=>{deferred.resolve()})
    p.cancel()
  }, {defer:true})

  suite.add('huge nomatch', function() {
    fuzzysort.single('xxx', 'noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster')
  })

  suite.add('tricky', function() {
    fuzzysort.single('prrun', 'C:/users/farzher/dropbox/someotherfolder/pocket rumble refactor/Run.bat')
  })

  suite.add('small', function() {
    fuzzysort.single('al', 'alexstrasa')
  })

  suite.add('somematch', function() {
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
