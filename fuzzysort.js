/*
WHAT: SublimeText-like Fuzzy Search

USAGE:
  require('fuzzysort').go('fs', 'Fuzzy Search')
  // {score: 0.1, highlighted: '<b>F</b>uzzy <b>S</b>earch'}

  require('fuzzysort').go('test', 'test')
  // {score: 0, highlighted}

  require('fuzzysort').go('doesnt exist', 'target')
  // {}

HOW: todo
*/

// const isNode = typeof require !== 'undefined' && typeof window === 'undefined'
// const isWorker = typeof require === 'undefined' && typeof window === 'undefined'
// const isBrowser = typeof window !== 'undefined'

let fuzzysort = {

  noMatchLimit: 100, // if there's no match for a span this long, give up
  highlightMatches: true,
  highlightOpen: '<b>',
  highlightClose: '</b>',

  go: (search, target) => {
    let searchI = 0 // where we at
    let targetI = 0 // where you at

    let noMatchCount = 0 // how long since we've seen a match
    const matches = [] // target indexes

    const lowerSearch = search.toLowerCase()
    const lowerTarget = target.toLowerCase()
    const searchLength = search.length
    const targetLength = target.length

    // very basic fuzzy match; to remove targets with no match ASAP
    // walk through search and target. find sequential matches.
    // if all chars aren't found then exit
    while(true) {
      const isMatch = lowerSearch[searchI] === lowerTarget[targetI]

      if(isMatch) {
        matches.push(targetI)

        searchI += 1
        if(searchI === searchLength) break
        noMatchCount = 0
      } else {
        noMatchCount += 1
        if(noMatchCount >= fuzzysort.noMatchLimit) return null
      }

      targetI += 1
      if(targetI === targetLength) return null
    }






    // Let's try a more advanced and strict test to improve the score
    // only count it as a match if it's consecutive or a beginning character!
    // we use information about previous matches to skip around here and improve performance

    let strictSuccess = false
    const strictMatches = []
    const upperTarget = target.toUpperCase()

    let wasUpper = null
    let wasChar = false
    let isConsec = false

    searchI = 0
    noMatchCount = 0

    if(matches[0]>0) {
      // skip and backfill history
      targetI = matches[0]
      wasUpper = target[targetI-1] === upperTarget[targetI-1]
      const targetCharCode = lowerTarget[targetI-1].charCodeAt(0)
      wasChar = targetCharCode>=48&&targetCharCode<=57 || targetCharCode>=97&&targetCharCode<=122
    } else {
      targetI = 0
    }


    while(true) {

      if (targetI >= targetLength) {
        // We failed to find a good spot for the search char, go back to the previous search char and force it forward
        if (searchI <= 0) break
        searchI -= 1

        const lastMatch = strictMatches.pop()
        targetI = lastMatch + 1

        isConsec = false
        // backfill history
        wasUpper = target[targetI-1] === upperTarget[targetI-1]
        const targetCharCode = lowerTarget[targetI-1].charCodeAt(0)
        wasChar = targetCharCode>=48&&targetCharCode<=57 || targetCharCode>=97&&targetCharCode<=122
        continue
      }

      const isUpper = target[targetI] === upperTarget[targetI]
      const targetChar = lowerTarget[targetI]
      const targetCharCode = targetChar.charCodeAt(0)
      const isChar = targetCharCode>=48&&targetCharCode<=57 || targetCharCode>=97&&targetCharCode<=122
      const isBeginning = isUpper && !wasUpper || isChar && !wasChar
      wasUpper = isUpper
      wasChar = isChar
      if (!isBeginning && !isConsec) {
        targetI += 1
        continue
      }

      const isMatch = lowerSearch[searchI] === targetChar

      if(isMatch) {
        strictMatches.push(targetI)

        searchI += 1
        if(searchI === searchLength) {
          strictSuccess = true
          break
        }

        targetI += 1
        isConsec = true
        const wouldSkipAhead = matches[searchI] > targetI
        if(wouldSkipAhead) {
          const nextMatchIsNextTarget = matches[searchI] == targetI
          if(!nextMatchIsNextTarget) {
            // skip and backfill history
            targetI = matches[searchI]
            isConsec = false
            wasUpper = target[targetI-1] === upperTarget[targetI-1]
            const targetCharCode = lowerTarget[targetI-1].charCodeAt(0)
            wasChar = targetCharCode>=48&&targetCharCode<=57 || targetCharCode>=97&&targetCharCode<=122
          }
        }

        noMatchCount = 0
      } else {
        noMatchCount += 1
        if(noMatchCount >= fuzzysort.noMatchLimit) break
        isConsec = false
        targetI += 1
      }

    }

    const ret = {}

    // tally up the score
    ret.score = 0
    let lastTargetI = -1
    let theMatches = strictSuccess ? strictMatches : matches
    for(const targetI of theMatches) {
      // score only goes up if they not consecutive
      if(lastTargetI !== targetI - 1) {
        ret.score += targetI
      }

      lastTargetI = targetI
    }
    if(strictSuccess) ret.score /= 1000
    ret.score += targetLength/1000 - searchLength/1000

    // highlight matches
    if(fuzzysort.highlightMatches) {
      ret.highlighted = ''
      let matchesIndex = 0
      let opened = false
      for(let i=0; i<targetLength; i++) {
        if(theMatches[matchesIndex] === i) {
          matchesIndex += 1
          if(!opened) {
            ret.highlighted += fuzzysort.highlightOpen
            opened = true
          }

          if(matchesIndex === theMatches.length) {
            ret.highlighted += `${target[i]}${fuzzysort.highlightClose}${target.substr(i+1)}`
            break
          }
        } else {
          if(opened) {
            ret.highlighted += fuzzysort.highlightClose
            opened = false
          }
        }
        ret.highlighted += target[i]
      }
    }

    return ret
  },

  goArray: (search, targets) => {
    const len = targets.length
    const results = []
    for (var i = 0; i < len; i++) {
      const result = fuzzysort.go(search, targets[i])
      if(result) results.push(result)
    }
    results.sort((a, b) => a.score - b.score)
    return results
  },

  // goArrayWorkers: (search, targets) => {
  //   return new Promise((resolve, reject) => {

  //     if(isBrowser) {
  //       const len = targets.length
  //       const encoder = new TextEncoder()
  //       // const threads = navigator.hardwareConcurrency
  //       const threads = 2
  //       const perThreadSize = Math.round(len/threads)
  //       let combinedResults = []
  //       let responseCount = 0
  //       for (var i = 0; i < threads; i++) {
  //         console.log('creating worker',Date.now())
  //         const myWorker = new Worker('./fuzzysort.js')

  //         let diff = 0
  //         if(i===threads-1) {
  //           // last iteration might have more or less than perThreadSize because rounding
  //           diff = len - (threads*perThreadSize)
  //         }

  //         const slice = targets.slice(perThreadSize*i, perThreadSize*(i+1)+diff)
  //         const encodedSlice = encoder.encode(slice.join(String.fromCharCode(0)))
  //         myWorker.postMessage({search, targets:encodedSlice.buffer}, [encodedSlice.buffer])
  //         myWorker.onmessage = function(e) {
  //           console.log('worker done',Date.now())
  //           combinedResults = combinedResults.concat(e.data)
  //           responseCount += 1
  //           if(responseCount === threads) {
  //             // combinedResults.sort((a, b) => a.score - b.score)
  //             resolve(combinedResults)
  //           }
  //         }
  //       }
  //     } else {
  //       // TODO: do a fake timeout async
  //       reject('multithreaded async only supported in browsers')
  //     }
  //   })
  // },

  goArrayAsync: (search, targets) => {
    let canceled = false
    const p = new Promise((resolve, reject) => {
      let i = targets.length
      const results = []
      const itemsPerCheck = 1000
      function step() {
        if(canceled) return reject('canceled')

        const startMs = Date.now()

        while(i > 0) {
          i -= 1
          const result = fuzzysort.go(search, targets[i])
          if(result) results.push(result)

          if(i%itemsPerCheck===0) {
            if(Date.now() - startMs >= 16) {
              // console.log('break',i,Date.now() - startMs)
              ;(typeof setImmediate !== 'undefined')?setImmediate(step):setTimeout(step)
              return
            }
          }
        }

        results.sort((a, b) => a.score - b.score)
        resolve(results)
      }

      // step()
      ;(typeof setImmediate !== 'undefined')?setImmediate(step):setTimeout(step)
    })
    p.cancel = () => {
      canceled = true
    }
    return p
  }



}

if(typeof module!=='undefined' && module.exports) module.exports = fuzzysort

// if(isWorker) {
//   onmessage = function(e) {
//     console.log('worker starting', Date.now())
//     const results = fuzzysort.goArray(e.data.search, e.data.targets)
//     postMessage(results)
//     close()
//   }
// }
