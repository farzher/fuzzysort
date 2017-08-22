/*
WHAT: SublimeText-like Fuzzy Search

USAGE:
  require('fuzzysort').single('fs', 'Fuzzy Search')
  // {score: 16, highlighted: '<b>F</b>uzzy <b>S</b>earch'}

  require('fuzzysort').single('test', 'test')
  // {score: 0, highlighted: '<b>test</b>'}

  require('fuzzysort').single('doesnt exist', 'target')
  // null
*/

;(function() {
  const isNode = typeof require !== 'undefined' && typeof window === 'undefined'
  var isCallToSingle // global instead of passed as argument for peformance

  const fuzzysort = {

    noMatchLimit: 100, // If there's no match for a span this long, give up (improves performance of long search targets)
    highlightMatches: true, // Turn this off if you don't care about `highlighted` (improves performance)
    highlightOpen: '<b>',
    highlightClose: '</b>',
    threshold: null, // Don't return matches worse than this (improves performance) (irrelevant for `single`)
    limit: null, // Don't return more results than this (improves performance if `highlightMatches` is on) (irrelevant for `single`)

    single: (search, target) => {
      const searchLower = search.toLowerCase()
      const searchLen = searchLower.length
      const searchCode = searchLower.charCodeAt(0)
      const isObj = typeof target === 'object'
      const infoFunc = isObj ? fuzzysort.infoObj : fuzzysort.info
      isCallToSingle = true
      const result = infoFunc(searchLower, searchLen, searchCode, target)
      if(result === null) return null
      if(fuzzysort.highlightMatches) result.highlighted = fuzzysort.highlight(result)
      return result
    },

    go: (search, targets) => {
      if(search === '') { const a=[]; a.total=0; return a }
      const isObj = typeof targets[0] === 'object'
      const infoFunc = isObj ? fuzzysort.infoObj : fuzzysort.info
      isCallToSingle = false
      const searchLower = search.toLowerCase()
      const searchLen = searchLower.length
      const searchCode = searchLower.charCodeAt(0)
      const results = []
      var resultsLen = 0
      results.thresholdCount = 0
      for(var i = targets.length-1; i>=0; i-=1) {
        const result = infoFunc(searchLower, searchLen, searchCode, targets[i])
        if(result === null) continue
        if(result === 'threshold') { results.thresholdCount += 1; continue }
        results[resultsLen++] = result
      }

      results.sort(compareResults)

      results.total = resultsLen
      if(fuzzysort.limit!==null && resultsLen > fuzzysort.limit) results.length = fuzzysort.limit
      if(fuzzysort.highlightMatches) {
        for (var i = results.length - 1; i >= 0; i--) {
          const result = results[i]
          result.highlighted = fuzzysort.highlight(result)
        }
      }

      return results
    },

    goAsync: (search, targets) => {
      var canceled = false
      const p = new Promise((resolve, reject) => {
        if(search === '') { const a=[]; a.total=0; return resolve(a) }
        const isObj = typeof targets[0] === 'object'
        const infoFunc = isObj ? fuzzysort.infoObj : fuzzysort.info
        const itemsPerCheck = 1000
        const searchLower = search.toLowerCase()
        const searchLen = searchLower.length
        const searchCode = searchLower.charCodeAt(0)
        const results = []
        var resultsLen = 0
        var i = targets.length-1
        results.thresholdCount = 0
        function step() {
          if(canceled) return reject('canceled')

          const startMs = Date.now()

          isCallToSingle = false

          for(; i>=0; i-=1) {
            const result = infoFunc(searchLower, searchLen, searchCode, targets[i])
            if(result === null) continue
            if(result === 'threshold') { results.thresholdCount += 1; continue }
            results[resultsLen++] = result

            if(i%itemsPerCheck===0) {
              if(Date.now() - startMs >= 32) {
                isNode?setImmediate(step):setTimeout(step)
                return
              }
            }
          }

          results.sort(compareResults)

          results.total = resultsLen
          if(fuzzysort.limit!==null && resultsLen > fuzzysort.limit) results.length = fuzzysort.limit
          if(fuzzysort.highlightMatches) {
            for (i = results.length - 1; i >= 0; i--) {
              const result = results[i]
              result.highlighted = fuzzysort.highlight(result)
            }
          }

          resolve(results)
        }

        isNode?setImmediate(step):step()
      })
      p.cancel = () => { canceled = true }
      return p
    },



    // Below this point is only internal code
    // Below this point is only internal code
    // Below this point is only internal code
    // Below this point is only internal code


    // very basic fuzzy match; to remove targets with no match ASAP!
    // walk through target. find sequential matches.
    // if all chars aren't found then exit
    info: (searchLower, searchLen, searchCode, target) => {
      const targetLower = target.toLowerCase()
      const targetLen = targetLower.length
      var targetCode = targetLower.charCodeAt(0)

      var searchI = 0 // where we at
      var targetI = 0 // where you at

      var noMatchCount = 0 // how long since we've seen a match
      var matchesSimple // target indexes
      var matchesSimpleLen = 1

      while(true) {
        const isMatch = searchCode === targetCode

        if(isMatch) {
          if(matchesSimple === undefined) {
            matchesSimple = [targetI]
          } else {
            matchesSimple[matchesSimpleLen++] = targetI
          }

          searchI += 1
          if(searchI === searchLen) break
          searchCode = searchLower.charCodeAt(searchI)
          noMatchCount = 0
        } else {
          noMatchCount += 1
          if(noMatchCount >= fuzzysort.noMatchLimit) return null
        }

        targetI += 1
        if(targetI === targetLen) return null
        targetCode = targetLower.charCodeAt(targetI)
      }

      { // This obj creation needs to be scoped for performance
        const obj = {_target:target, _targetLower:targetLower, _matchesSimple:matchesSimple}
        return fuzzysort.infoStrict(searchLower, searchLen, searchCode, obj)
      }
    },


    // This code is basically a copy/paste of `info` for performance reasons :(
    infoObj: (searchLower, searchLen, searchCode, obj) => {
      // if(obj._targetLower === undefined) obj._targetLower = obj._target.toLowerCase()
      const targetLower = obj._targetLower
      const targetLen = targetLower.length

      var targetCode = targetLower.charCodeAt(0)
      var searchI = 0 // where we at
      var targetI = 0 // where you at

      var noMatchCount = 0 // how long since we've seen a match
      var matchesSimple // target indexes
      var matchesSimpleLen = 1

      while(true) {
        const isMatch = searchCode === targetCode

        if(isMatch) {
          if(matchesSimple === undefined) {
            matchesSimple = [targetI]
          } else {
            matchesSimple[matchesSimpleLen++] = targetI
          }

          searchI += 1
          if(searchI === searchLen) break
          searchCode = searchLower.charCodeAt(searchI)
          noMatchCount = 0
        } else {
          noMatchCount += 1
          if(noMatchCount >= fuzzysort.noMatchLimit) return null
        }

        targetI += 1
        if(targetI === targetLen) return null
        targetCode = targetLower.charCodeAt(targetI)
      }

      obj._matchesSimple = matchesSimple
      return fuzzysort.infoStrict(searchLower, searchLen, searchCode, obj)
    },

    // Our target string successfully matched all characters in sequence!
    // Let's try a more advanced and strict test to improve the score
    // only count it as a match if it's consecutive or a beginning character!
    // we use information about previous matches to skip around here and improve performance
    infoStrict: (searchLower, searchLen, searchCode, obj) => {
      const matchesSimple = obj._matchesSimple
      const targetLower = obj._targetLower
      const targetLen = targetLower.length
      const target = obj._target

      var wasUpper = null
      var wasAlphanum = false
      var isConsec = false

      var searchI = 0
      var noMatchCount = 0

      var strictSuccess = false
      var matchesStrict
      var matchesStrictLen = 1

      if(matchesSimple[0] > 0) {
        // skip and backfill history
        targetI = matchesSimple[0]
        const targetCode = target.charCodeAt(targetI-1)
        wasUpper = targetCode>=65&&targetCode<=90
        wasAlphanum = wasUpper || targetCode>=97&&targetCode<=122 || targetCode>=48&&targetCode<=57
      } else {
        targetI = 0
      }

      while(true) {

        if (targetI >= targetLen) {
          // We failed to find a good spot for the search char, go back to the previous search char and force it forward
          if (searchI <= 0) break
          searchI -= 1

          const lastMatch = matchesStrict[--matchesStrictLen]
          targetI = lastMatch + 1

          isConsec = false // TODO: removing this doesn't break tests
          // backfill history
          const targetCode = target.charCodeAt(targetI-1)
          wasUpper = targetCode>=65&&targetCode<=90
          wasAlphanum = wasUpper || targetCode>=97&&targetCode<=122 || targetCode>=48&&targetCode<=57

        } else {
          const lowerTargetCode = targetLower.charCodeAt(targetI)
          if(!isConsec) {
            const targetCode = target.charCodeAt(targetI)
            const isUpper = targetCode>=65&&targetCode<=90
            const isAlphanum = lowerTargetCode>=97&&lowerTargetCode<=122 || lowerTargetCode>=48&&lowerTargetCode<=57
            const isBeginning = isUpper && !wasUpper || !wasAlphanum || !isAlphanum
            wasUpper = isUpper
            wasAlphanum = isAlphanum
            if (!isBeginning) {
              targetI += 1
              continue
            }
          }

          const isMatch = searchLower.charCodeAt(searchI) === lowerTargetCode
          if(isMatch) {
            if(matchesStrict === undefined) {
              matchesStrict = [targetI]
            } else {
              matchesStrict[matchesStrictLen++] = targetI
            }

            searchI += 1
            if(searchI === searchLen) {
              strictSuccess = true
              break
            }

            targetI += 1
            isConsec = true
            const wouldSkipAhead = matchesSimple[searchI] > targetI
            if(wouldSkipAhead) {
              const nextMatchIsNextTarget = matchesSimple[searchI] === targetI
              if(!nextMatchIsNextTarget) {
                // skip and backfill history
                targetI = matchesSimple[searchI]
                isConsec = false
                const targetCode = target.charCodeAt(targetI-1)
                wasUpper = targetCode>=65&&targetCode<=90
                wasAlphanum = wasUpper || targetCode>=97&&targetCode<=122 || targetCode>=48&&targetCode<=57
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
      }

      { // tally up the score & keep track of matches for highlighting later
        obj._matchesBest = strictSuccess ? matchesStrict : matchesSimple
        obj.score = 0
        var lastTargetI = -1
        for(const targetI of obj._matchesBest) {
          // score only goes up if they're not consecutive
          if(lastTargetI !== targetI - 1) obj.score += targetI

          lastTargetI = targetI
        }
        if(!strictSuccess) obj.score *= 1000
        obj.score += targetLen - searchLen

        if(!isCallToSingle) {
          if(fuzzysort.threshold !== null) {
            if(obj.score > fuzzysort.threshold) {
              return 'threshold'
            }
          }
        }

        return obj
      }
    },

    highlight: (result) => {
      var highlighted = ''
      var matchesIndex = 0
      var opened = false
      const target = result._target
      const targetLen = target.length
      const matchesBest = result._matchesBest
      for(var i=0; i<targetLen; i++) {
        if(matchesBest[matchesIndex] === i) {
          matchesIndex += 1
          if(!opened) {
            highlighted += fuzzysort.highlightOpen
            opened = true
          }

          if(matchesIndex === matchesBest.length) {
            highlighted += `${target[i]}${fuzzysort.highlightClose}${target.substr(i+1)}`
            break
          }
        } else {
          if(opened) {
            highlighted += fuzzysort.highlightClose
            opened = false
          }
        }
        highlighted += target[i]
      }

      return highlighted
    }
  }

  function compareResults(a, b) { return a.score - b.score }

  // Export fuzzysort
    if(isNode) module.exports = fuzzysort
    else window.fuzzysort = fuzzysort
})()

// TODO: is it important to make sure highlighted property always exists for hidden class optimization?
