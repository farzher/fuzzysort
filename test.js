/*
WHAT: Test and then benchmark
USAGE: Run this file in node

HOW TO WRITE TESTS:
      target         ...matches...               after null must not match
test('APPLES',      'app', 'l', 'E',               null,     'xxx')
               matches must not get better
*/
if(typeof fuzzysort === 'undefined') fuzzysort = require('./fuzzysort')
if(typeof testdata === 'undefined') testdata = require('./testdata')
seededRand.seed = 0

// fuzzysort.highlightMatches = false
fuzzysort.noMatchLimit = 100
const benchmark_duration = .1




// tests
  test('APPLES', 'app', 'l', 'E')
  test('C:/users/farzher/dropbox/someotherfolder/pocket rumble refactor/Run.bat', 'po', 'p', 'po ru', 'pr', 'prrun', 'ocket umble')
  test('123abc', '12', '1', 'a', null, 'cc')

  test('az bx cyy y', 'az', 'ab', 'ay', 'ax', 'ayy')
  test('aab x', 'ax', 'ab') // this could cause a to get pushed forward then strict match ab in the middle

  test('Thoug ht', 'ht', 'hh')

  test('noodle monster', 'nomon', null, 'qrs')
  test('noodle monster '.repeat(100), null, 'a')




if(!assert.failed) { // only if tests passed will we bench
  console.log('all tests passed')

  setTimeout(() => {
    const isNode = typeof require !== 'undefined' && typeof window === 'undefined'
    // const isWorker = typeof require === 'undefined' && typeof window === 'undefined'
    // const isBrowser = typeof window !== 'undefined'
    if(typeof Benchmark === 'undefined') Benchmark = require('benchmark')
    Benchmark.options.maxTime = benchmark_duration
    const suite = new Benchmark.Suite

    // random_strings = new Array(100000)
    // for (var i = 0; i < 100000; i++) random_strings[i] = randomString(seededRand(1, 100))
    random_strings = testdata.ue4_filenames

    // benches
      suite

    //   // .add('a', function() {
    //   //     const a=[]
    //   //     for (var i = 0; i < 1000; i++) {
    //   //         a.push(i)
    //   //     }
    //   // })
    //   // .add('b', function() {
    //   //     const a=[]
    //   //     for (var i = 0; i < 1000; i++) {
    //   //         a[i] = i
    //   //     }
    //   // })
    //   // .add('c', function() {
    //   //     const a=[];let count=0
    //   //     for (var i = 0; i < 1000; i++) {
    //   //         a[count++] = i
    //   //     }
    //   // })
    //   // .add('d', function() {
    //   //     const a=[]
    //   //     for (var i = 0; i < 1000; i++) {
    //   //         a[a.length] = i
    //   //     }
    //   // })

    //   // .add('loop++', function() {
    //   //   const len = random_strings.length
    //   //   const results = []
    //   //   let currentLen = 0
    //   //   for (var i = 0; i < len; i++) {
    //   //     const result = fuzzysort.single('search', random_strings[i])
    //   //     if(result) results[currentLen++] = result
    //   //   }
    //   //   results.sort((a, b) => a.score - b.score)
    //   // })

      .add('loop.push()', function() {
        const len = random_strings.length
        const results = []
        for (var i = 0; i < len; i++) {
          const result = fuzzysort.single('search', random_strings[i])
          if(result) results.push(result)
        }
        results.sort((a, b) => a.score - b.score)
      })

      .add('go', function() {
        fuzzysort.go('search', random_strings)
      })

      .add('goAsync', function(deferred) {
        fuzzysort.goAsync('search', random_strings).then(()=>{deferred.resolve()})
      }, {defer:true})

      .add('goAsync.cancel()', function(deferred) {
        const p = fuzzysort.goAsync('search', random_strings)
        p.then(()=>{deferred.resolve()}, ()=>{deferred.resolve()})
        p.cancel()
      }, {defer:true})

      .add('huge', function() {
        fuzzysort.single('a', 'noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster noodle monster')
      })

      .add('tricky', function() {
        fuzzysort.single('prrun', 'C:/users/farzher/dropbox/someotherfolder/pocket rumble refactor/Run.bat')
      })

      .add('small', function() {
        fuzzysort.single('al', 'alexstrasa')
      })

      .add('nomatch', function() {
        fuzzysort.single('texxx', 'template/index')
      })


      .on('cycle', function(e) {
        console.log(String(e.target))
      })


      if(isNode) {
        console.log('now benching')
        suite.run()
      }
  })
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
  let last_score = -1
  let needs_to_fail = false

  for (var i = 0; i < searches.length; i++) {

    let search = searches[i]
    if(search === null) {
      needs_to_fail = true
      continue
    }

    const result = fuzzysort.single(searches[i], target)
    let score = undefined
    if(result) score = result.score

    let info = {score, last_score, target, search}
    if(needs_to_fail) {
      assert(score===undefined, info)
    } else {
      assert(score!==undefined, info)
      assert(score>=last_score, info)
      last_score = score
    }
  }
}

function randomString(len, charSet) {
    charSet = charSet || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ,./\]["<>?:{}!@#$%^&*()_+=-';
    var randomString = '';
    for (var i = 0; i < len; i++) {
        var randomPoz = Math.floor(seededRand() * charSet.length);
        randomString += charSet.substring(randomPoz,randomPoz+1);
    }
    return randomString;
}

function seededRand(max=1, min=0) {
  if(min) [max,min]=[min,max]
  seededRand.seed = (seededRand.seed * 9301 + 49297) % 233280
  var rnd = seededRand.seed / 233280
  return min + rnd * (max - min)
}
