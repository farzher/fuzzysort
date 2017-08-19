/*
WHAT: SublimeText-like Fuzzy Search

USAGE:
  require('fuzzysort').single('fs', 'Fuzzy Search')
  // {score: 0.1, highlighted: '<b>F</b>uzzy <b>S</b>earch'}

  require('fuzzysort').single('test', 'test')
  // {score: 0, highlighted}

  require('fuzzysort').single('doesnt exist', 'target')
  // {}
*/

;(function() {
  var fuzzysort = {

    noMatchLimit: 100, // if there's no match for a span this long, give up
    highlightMatches: true,
    highlightOpen: '<b>',
    highlightClose: '</b>',
    limit: null, // don't return more results than this

    single: (search, target) => {
      const result = fuzzysort.info(search.toLowerCase(), target)
      if(result === null) return null

      if(fuzzysort.highlightMatches) {
        result.highlighted = fuzzysort.highlight(result)
      }
      return result
    },

    go: (search, targets) => {
      const lowerSearch = search.toLowerCase()
      var i = targets.length-1
      const results = []
      for(; i>=0; i-=1) {
        const result = fuzzysort.info(lowerSearch, targets[i])
        if(result) results.push(result)
      }

      const len = results.length
      quickSortResults(results, 0, len)

      results.total = len
      if(fuzzysort.limit!=null && len > fuzzysort.limit) {
        results.length = fuzzysort.limit
      }
      if(fuzzysort.highlightMatches) {
        for (i = results.length - 1; i >= 0; i--) {
          const result = results[i]
          result.highlighted = fuzzysort.highlight(result)
        }
      }

      return results
    },

    goAsync: (search, targets) => {
      var canceled = false
      const p = new Promise((resolve, reject) => {
        var i = targets.length-1
        const results = []
        const itemsPerCheck = 1000
        const lowerSearch = search.toLowerCase()
        function step() {
          if(canceled) return reject('canceled')

          const startMs = Date.now()

          for(; i>=0; i-=1) {
            const result = fuzzysort.info(lowerSearch, targets[i])
            if(result) results.push(result)

            if(i%itemsPerCheck===0) {
              if(Date.now() - startMs >= 12) {
                ;(typeof setImmediate !== 'undefined')?setImmediate(step):setTimeout(step)
                return
              }
            }
          }

          const len = results.length
          quickSortResults(results, 0, len)

          results.total = len
          if(fuzzysort.limit!=null && len > fuzzysort.limit) {
            results.length = fuzzysort.limit
          }
          if(fuzzysort.highlightMatches) {
            for (i = results.length - 1; i >= 0; i--) {
              const result = results[i]
              result.highlighted = fuzzysort.highlight(result)
            }
          }

          resolve(results)
        }

        if(typeof setImmediate !== 'undefined') {
          setImmediate(step)
        } else {
          step()
        }
        // step() // This speeds up the browser a lot. setTimeout is slow
        // // ;(typeof setImmediate !== 'undefined')?setImmediate(step):setTimeout(step)
      })
      p.cancel = () => {
        canceled = true
      }
      return p
    },

    info: (lowerSearch, target) => {
      var searchI = 0 // where we at
      var targetI = 0 // where you at

      var noMatchCount = 0 // how long since we've seen a match
      var matches // target indexes

      const lowerTarget = target.toLowerCase()
      const searchLength = lowerSearch.length
      const targetLength = target.length
      var currentSearchCode = lowerSearch.charCodeAt(0)
      var currentTargetCode = lowerTarget.charCodeAt(0)

      // very basic fuzzy match; to remove targets with no match ASAP
      // walk through search and target. find sequential matches.
      // if all chars aren't found then exit
      while(true) {
        const isMatch = currentSearchCode === currentTargetCode

        if(isMatch) {
          if(matches === undefined) {
            matches = [targetI]
          } else {
            matches.push(targetI)
          }

          searchI += 1
          if(searchI === searchLength) break
          currentSearchCode = lowerSearch.charCodeAt(searchI)
          noMatchCount = 0
        } else {
          noMatchCount += 1
          if(noMatchCount >= fuzzysort.noMatchLimit) return null
        }

        targetI += 1
        if(targetI === targetLength) return null
        currentTargetCode = lowerTarget.charCodeAt(targetI)
      }






      // Let's try a more advanced and strict test to improve the score
      // only count it as a match if it's consecutive or a beginning character!
      // we use information about previous matches to skip around here and improve performance

      var strictSuccess = false
      var strictMatches
      const upperTarget = target.toUpperCase()

      var wasUpper = null
      var wasChar = false
      var isConsec = false

      searchI = 0
      noMatchCount = 0

      if(matches[0]>0) {
        // skip and backfill history
        targetI = matches[0]
        wasUpper = target.charCodeAt(targetI-1) === upperTarget.charCodeAt(targetI-1)
        const targetCharCode = lowerTarget.charCodeAt(targetI-1)
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
          const upperCharCode = upperTarget.charCodeAt(targetI-1)
          wasUpper = target.charCodeAt(targetI-1) === upperCharCode
          wasChar = upperCharCode>=48&&upperCharCode<=57 || upperCharCode>=65&&upperCharCode<=90
          continue
        }

        const isUpper = target.charCodeAt(targetI) === upperTarget.charCodeAt(targetI)
        const targetCharCode = lowerTarget.charCodeAt(targetI)
        const isChar = targetCharCode>=48&&targetCharCode<=57 || targetCharCode>=97&&targetCharCode<=122
        const isBeginning = isUpper && !wasUpper || isChar && !wasChar
        wasUpper = isUpper
        wasChar = isChar
        if (!isBeginning && !isConsec) {
          targetI += 1
          continue
        }

        const isMatch = lowerSearch.charCodeAt(searchI) === targetCharCode

        if(isMatch) {
          if(strictMatches === undefined) {
            strictMatches = [targetI]
          } else {
            strictMatches.push(targetI)
          }

          searchI += 1
          if(searchI === searchLength) {
            strictSuccess = true
            break
          }

          targetI += 1
          isConsec = true
          const wouldSkipAhead = matches[searchI] > targetI
          if(wouldSkipAhead) {
            const nextMatchIsNextTarget = matches[searchI] === targetI
            if(!nextMatchIsNextTarget) {
              // skip and backfill history
              targetI = matches[searchI]
              isConsec = false
              const upperCharCode = upperTarget.charCodeAt(targetI-1)
              wasUpper = target.charCodeAt(targetI-1) === upperCharCode
              wasChar = upperCharCode>=48&&upperCharCode<=57 || upperCharCode>=65&&upperCharCode<=90
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

      // tally up the score & keep track of matches for highlighting later
      ret.score = 0
      var lastTargetI = -1
      const theMatches = strictSuccess ? strictMatches : matches
      for(const targetI of theMatches) {
        // score only goes up if they not consecutive
        if(lastTargetI !== targetI - 1) ret.score += targetI

        lastTargetI = targetI
      }
      if(!strictSuccess) ret.score *= 1000
      ret.score += targetLength - searchLength

      if(fuzzysort.highlightMatches) {
        ret.target = target
        ret.theMatches = strictSuccess ? strictMatches : matches
      }

      return ret
    },

    highlight: (result) => {
      var highlighted = ''
      var matchesIndex = 0
      var opened = false
      const target = result.target
      const targetLength = target.length
      const theMatches = result.theMatches
      for(var i=0; i<targetLength; i++) {
        if(theMatches[matchesIndex] === i) {
          matchesIndex += 1
          if(!opened) {
            highlighted += fuzzysort.highlightOpen
            opened = true
          }

          if(matchesIndex === theMatches.length) {
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





  function quickSortPartition(results, left, right) {
    const cmp = results[right-1].score
    var minEnd = left
    var maxEnd = left
    for (; maxEnd < right-1; maxEnd += 1) {
      if (results[maxEnd].score <= cmp) {
        swap(results, maxEnd, minEnd)
        minEnd += 1
      }
    }
    swap(results, minEnd, right-1)
    return minEnd
  }

  function swap(results, i, j) {
    const temp = results[i]
    results[i] = results[j]
    results[j] = temp
  }

  function quickSortResults(results, left, right) {
    if (left < right) {
      var p = quickSortPartition(results, left, right)
      quickSortResults(results, left, p)
      quickSortResults(results, p + 1, right)
    }
  }




  // Export fuzzysort
    if(typeof module !== 'undefined' && module.exports) {
      module.exports = fuzzysort
    } else if(typeof window !== 'undefined') {
      window.fuzzysort = fuzzysort
    }
})()

