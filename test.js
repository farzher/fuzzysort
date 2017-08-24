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
  testNomatch('AndroidRuntimeSettings.h', 'nothing')

  test('noodle monster', 'nomon', null, 'qrs')
  test('noodle monster '.repeat(100), null, 'a')

  // typoPenalty
  assert(fuzzysort.single('acb', 'abc').score===20, 'typoPenalty strict')
  assert(fuzzysort.single('acb', 'axbxc').score===6022, 'typoPenalty simple')

  var tmp = fuzzysort.go('a', ['ba', 'bA', 'a', 'bA', 'xx', 'ba'])
  assert(tmp[0].score===0, 'go sorting')
  assert(tmp.length===5, 'go sorting length')
  assert(tmp.total===5, 'go sorting total')

  var tmp = await fuzzysort.goAsync('a', ['ba', 'bA', 'a', 'bA', 'xx', 'ba'])
  assert(tmp[0].score===0, 'goAsync sorting')
  assert(tmp.length===5, 'goAsync sorting length')
  assert(tmp.total===5, 'goAsync sorting total')
}







const isNode = typeof require !== 'undefined' && typeof window === 'undefined'
if(isNode) fuzzysort = require('./fuzzysort')

// Config
  // fuzzysort.highlightMatches = false
  // fuzzysort.noMatchLimit = 100
  fuzzysort.noMatchLimit = 50
  fuzzysort.limit = 100
  // fuzzysort.allowTypo = false
  // fuzzysort.threshold = 999
  const benchmark_duration = 2
  var enable_tests
  enable_tests = true


if(isNode) testdata = require('./testdata')
var testdata_rawstring = testdata; testdata = {}
for(var key of Object.keys(testdata_rawstring)) {
  testdata[key] = new Array(testdata_rawstring[key].length)
  for(var i = testdata_rawstring[key].length-1; i>=0; i-=1) {
    testdata[key][i] = {
      _target: testdata_rawstring[key][i],
      _targetLower: testdata_rawstring[key][i].toLowerCase(),
      // _targetLowerLen: lower.length,
      // firstCharCode: lower.charCodeAt(0)
    }
  }
}


setTimeout(async function() {
  if(enable_tests) await tests()

  if(!assert.failed) { // only if tests passed will we bench
    if(assert.count>0) console.log('all tests passed')
    else console.log('testing is disabled!')

    // Only bench on node. Don't want the demo to lag
      if(isNode) bench()
  }
})













function bench() {
  if(isNode) Benchmark = require('benchmark')
  Benchmark.options.maxTime = benchmark_duration
  const suite = new Benchmark.Suite

  suite.add('go indexed', function() {
    fuzzysort.go('e', testdata.ue4_filenames)
    fuzzysort.go('a', testdata.ue4_filenames)
    fuzzysort.go('mrender.h', testdata.ue4_filenames)
  })
  suite.add('go str', function() {
    fuzzysort.go('e', testdata_rawstring.ue4_filenames)
    fuzzysort.go('a', testdata_rawstring.ue4_filenames)
    fuzzysort.go('mrender.h', testdata_rawstring.ue4_filenames)
  })

  // suite.add('goKey', function() {
  //   fuzzysort.go('e', objects, {key:'target'})
  //   fuzzysort.go('a', objects, {key:'target'})
  //   fuzzysort.go('mrender.h', objects, {key:'target'})

  //   // objs = [{str:'naytunfwuyt', str2:'nautfn'}, {str:'pant', str2:'tunntuftf889323'}, {str:'tame', str2:'n&*(*&o'}]
  //   // fuzzysort.go('t', objs, {keys:['str', 'str2'], scoreFn:metas=> (metas[0]&&metas[0].score||1000) + (metas[1]&&metas[1].score||1000) })
  // })

  // suite.add('goKeys', function() {
  //   fuzzysort.go('e', objects, {key:['target']})
  //   fuzzysort.go('a', objects, {key:['target']})
  //   fuzzysort.go('mrender.h', objects, {key:['target']})

  //   // objs = [{str:'naytunfwuyt', str2:'nautfn'}, {str:'pant', str2:'tunntuftf889323'}, {str:'tame', str2:'n&*(*&o'}]
  //   // fuzzysort.go('t', objs, {keys:['str', 'str2'], scoreFn:metas=> (metas[0]&&metas[0].score||1000) + (metas[1]&&metas[1].score||1000) })
  // })

  suite.add('goAsync', function(deferred) {
    var count = 0
    fuzzysort.goAsync('e', testdata.ue4_filenames).then(()=>{count+=1; if(count===3)deferred.resolve()})
    fuzzysort.goAsync('a', testdata.ue4_filenames).then(()=>{count+=1; if(count===3)deferred.resolve()})
    fuzzysort.goAsync('mrender.h', testdata.ue4_filenames).then(()=>{count+=1; if(count===3)deferred.resolve()})
  }, {defer:true})

  // suite.add('goAsync.cancel()', function(deferred) {
  //   const p = fuzzysort.goAsync('e', testdata.ue4_filenames)
  //   p.then(()=>{deferred.resolve()}, ()=>{deferred.resolve()})
  //   p.cancel()
  // }, {defer:true})

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
function testStrict(target, ...searches) {
  for(const search of searches) {
    const result = fuzzysort.single(search, target)
    assert(result && result.score<1000, {search, result})
  }
}
function testSimple(target, ...searches) {
  for(const search of searches) {
    const result = fuzzysort.single(search, target)
    assert(result && result.score>=1000, {search, result})
  }
}
function testNomatch(target, ...searches) {
  for(const search of searches) {
    const result = fuzzysort.single(search, target)
    assert(result===null, {search, result})
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
