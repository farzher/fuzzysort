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

// UMD (Universal Module Definition) for fuzzysort
;(function(root, UMD) {
  if (typeof define === 'function' && define.amd) define([], UMD)
  else if (typeof module === 'object' && module.exports) module.exports = UMD()
  else root.fuzzysort = UMD()
})(this, function UMD() { function fuzzysortNew() {

  var fuzzysort = {

    noMatchLimit: 100, // If there's no match for a span this long, give up (lower is faster for long search targets)
    highlightMatches: true, // Turn this off if you don't care about `highlighted` (faster)
    highlightOpen: '<b>',
    highlightClose: '</b>',
    threshold: null, // Don't return matches worse than this (lower is faster) (irrelevant for `single`)
    limit: null, // Don't return more results than this (faster) (irrelevant for `single`)
    allowTypo: true, // Allwos a snigle transpoes in yuor serach (faster when off)

    single: function(search, target) {
      if(typeof search !== 'object') {
        var preparedSearch = preparedSearchCache.get(search)
        if(preparedSearch !== undefined) search = preparedSearch
        else preparedSearchCache.set(search, search = fuzzysort.prepareSearch(search))
      }

      if(typeof target !== 'object') {
        var targetPrepared = preparedCache.get(target)
        if(targetPrepared !== undefined) target = targetPrepared
        else preparedCache.set(target, target = fuzzysort.prepareFast(target))
      }

      var result = fuzzysort.infoPrepared(search, target, search[0])
      if(result === null) return null
      if(fuzzysort.highlightMatches) result.highlighted = fuzzysort.highlight(result)
      return result
    },

    go: function(search, targets) {
      if(search === '') return noResults
      if(typeof search !== 'object') {
        var preparedSearch = preparedSearchCache.get(search)
        if(preparedSearch !== undefined) search = preparedSearch
        else preparedSearchCache.set(search, search = fuzzysort.prepareSearch(search))
      }
      var resultsLen = 0; var limitedCount = 0
      for(var i = targets.length-1; i>=0; i-=1) { var target = targets[i]
        if(typeof target !== 'object') {
          var targetPrepared = preparedCache.get(target)
          if(targetPrepared !== undefined) target = targetPrepared
          else preparedCache.set(target, target = fuzzysort.prepareFast(target))
        }
        var result = fuzzysort.infoPrepared(search, target, search[0])
        if(result === null) continue
        if(fuzzysort.threshold!==null && result.score > fuzzysort.threshold) continue
        if(!fuzzysort.limit || resultsLen<fuzzysort.limit) {
          q.add(result); resultsLen += 1
        } else {
          limitedCount += 1
          if(result.score < q.peek().score) q.replaceTop(result)
        }
      }
      if(resultsLen === 0) return noResults
      var results = new Array(resultsLen)
      for (var i = resultsLen - 1; i >= 0; i--) results[i] = q.poll()
      results.total = resultsLen + limitedCount

      if(fuzzysort.highlightMatches) {
        for (var i = results.length - 1; i >= 0; i--) { var result = results[i]
          result.highlighted = fuzzysort.highlight(result)
        }
      }

      return results
    },

    goAsync: function(search, targets) {
      var canceled = false
      var p = new Promise(function(resolve, reject) {
        if(search === '') return resolve(noResults)
        if(typeof search !== 'object') {
          var preparedSearch = preparedSearchCache.get(search)
          if(preparedSearch !== undefined) search = preparedSearch
          else preparedSearchCache.set(search, search = fuzzysort.prepareSearch(search))
        }
        var itemsPerCheck = 1000
        var q = fastpriorityqueue()
        var iCurrent = targets.length-1
        var resultsLen = 0; var limitedCount = 0
        function step() {
          if(canceled) return reject('canceled')

          var startMs = Date.now()

          for(; iCurrent>=0; iCurrent-=1) { var target = targets[iCurrent]
            if(typeof target !== 'object') {
              var targetPrepared = preparedCache.get(target)
              if(targetPrepared !== undefined) target = targetPrepared
              else preparedCache.set(target, target = fuzzysort.prepareFast(target))
            }
            var result = fuzzysort.infoPrepared(search, target, search[0])
            if(result === null) continue
            if(fuzzysort.threshold!==null && result.score > fuzzysort.threshold) continue
            if(!fuzzysort.limit || resultsLen<fuzzysort.limit) {
              q.add(result); resultsLen += 1
            } else {
              limitedCount += 1
              if(result.score < q.peek().score) q.replaceTop(result)
            }

            if(iCurrent%itemsPerCheck===0) {
              if(Date.now() - startMs >= 32) {
                isNode?setImmediate(step):setTimeout(step)
                return
              }
            }
          }
          if(resultsLen === 0) return resolve(noResults)
          var results = new Array(resultsLen)
          for (var i = resultsLen - 1; i >= 0; i--) results[i] = q.poll()
          results.total = resultsLen + limitedCount

          if(fuzzysort.highlightMatches) {
            for (var i = results.length - 1; i >= 0; i--) { var result = results[i]
              result.highlighted = fuzzysort.highlight(result)
            }
          }

          resolve(results)
        }

        isNode?setImmediate(step):step()
      })
      p.cancel = function() { canceled = true }
      return p
    },



    // Below this point is only internal code
    // Below this point is only internal code
    // Below this point is only internal code
    // Below this point is only internal code



    infoPrepared: function(searchLowerCodes, prepared, searchLowerCode) {
      // var targetLower = prepared._targetLower
      var targetLowerCodes = prepared._targetLowerCodes
      var searchLen = searchLowerCodes.length
      var targetLen = targetLowerCodes.length
      var searchI = 0 // where we at
      var targetI = 0 // where you at
      var typoSimpleI = 0
      var noMatchCount = 0 // how long since we've seen a match
      var matchesSimple; var matchesSimpleLen = 1 // target indexes

      // very basic fuzzy match; to remove non-matching targets ASAP!
      // walk through target. find sequential matches.
      // if all chars aren't found then exit
      while(true) {
        var isMatch = searchLowerCode === targetLowerCodes[targetI]
        if(isMatch) {
          matchesSimple===undefined ? matchesSimple = [targetI] : matchesSimple[matchesSimpleLen++] = targetI
          searchI += 1; if(searchI === searchLen) break
          searchLowerCode = searchLowerCodes[typoSimpleI===0?searchI : (typoSimpleI===searchI?searchI+1 : (typoSimpleI===searchI-1?searchI-1 : searchI))]
          noMatchCount = 0
        } else {
          noMatchCount += 1; if(noMatchCount >= fuzzysort.noMatchLimit) return null
        }

        targetI += 1; if(targetI === targetLen) { // Failed to find searchI
          if(!fuzzysort.allowTypo) return null

          // Check for typo or exit
          // we go as far as possible before trying to transpose
          // then we transpose backwards until we reach the beginning
          do {
            if(searchI <= 1) return null // not allowed to transpose first char
            if(typoSimpleI === 0) { // we haven't tried to transpose yet
              searchI -= 1
              var searchLowerCodeNew = searchLowerCodes[searchI]
              if(searchLowerCode === searchLowerCodeNew) continue // doesn't make sense to transpose a repeat char
              typoSimpleI = searchI
              matchesSimpleLen = searchI
              targetI = matchesSimple[matchesSimpleLen - 1] + 1
            } else {
              if(typoSimpleI===1) return null // reached the end of the line for transposing
              typoSimpleI -= 1
              searchI = typoSimpleI
              searchLowerCode = searchLowerCodes[searchI+1]
              var searchLowerCodeNew = searchLowerCodes[searchI]
              if(searchLowerCode === searchLowerCodeNew) continue // doesn't make sense to transpose a repeat char
              matchesSimpleLen = searchI
              targetI = matchesSimple[matchesSimpleLen - 1] + 1
            }
            break
          } while(true)
        }
      }

      var searchI = 0
      var typoStrictI = 0
      var successStrict = false
      var matchesStrict; var matchesStrictLen = 1 // target indexes

      if(prepared._nextBeginningIndexes === null) prepared._nextBeginningIndexes = fuzzysort.prepareNextBeginningIndexes(prepared._target)
      var nextBeginningIndexes = prepared._nextBeginningIndexes
      var beginning = targetI = matchesSimple[0]===0 ? 0 : nextBeginningIndexes[matchesSimple[0]-1]
      // if(prepared._beginningIndexes === null) prepared._beginningIndexes = fuzzysort.prepareBeginningIndexes(prepared._target)
      // var beginningIndexes = prepared._beginningIndexes
      // var beginning = targetI = matchesSimple[0]===0 ? 0 : binarySearchMinGreater(beginningIndexes, matchesSimple[0]-1)||targetLen

      // Our target string successfully matched all characters in sequence!
      // Let's try a more advanced and strict test to improve the score
      // only count it as a match if it's consecutive or a beginning character!
      // we use information about previous matches to skip around here and improve performance
      if(targetI!==targetLen) while(true) {
        if (targetI >= targetLen) {
          // We failed to find a good spot for this search char, go back to the previous search char and force it forward
          if (searchI <= 0) { // We failed to push chars forward for a better match
            if(!fuzzysort.allowTypo) break

            typoStrictI += 1; if(typoStrictI > searchLen-2) break
            if(searchLowerCodes[typoStrictI] === searchLowerCodes[typoStrictI+1]) continue // doesn't make sense to transpose a repeat char
            targetI = beginning
            continue
          }

          searchI -= 1
          var lastMatch = matchesStrict[--matchesStrictLen]
          targetI = nextBeginningIndexes[lastMatch]
          // targetI = binarySearchMinGreater(beginningIndexes, lastMatch)||targetLen

        } else {
          var isMatch = searchLowerCodes[typoStrictI===0?searchI : (typoStrictI===searchI?searchI+1 : (typoStrictI===searchI-1?searchI-1 : searchI))] === targetLowerCodes[targetI]
          if(isMatch) {
            matchesStrict===undefined ? matchesStrict = [targetI] : matchesStrict[matchesStrictLen++] = targetI
            searchI += 1; if(searchI === searchLen) { successStrict = true; break }
            targetI += 1
          } else {
            targetI = nextBeginningIndexes[targetI]
            // targetI = binarySearchMinGreater(beginningIndexes, targetI)||targetLen
          }
        }
      }

      { // tally up the score & keep track of matches for highlighting later
        var matchesBest = successStrict ? matchesStrict : matchesSimple
        var score = 0
        var lastTargetI = -1
        for (var i = 0; i < searchLen; i++) {
          targetI = matchesBest[i]
          // score only goes up if they're not consecutive
          if(lastTargetI !== targetI - 1) score += targetI
          lastTargetI = targetI
        }
        if(!successStrict) {
          score *= 1000
          if(typoSimpleI!==0) score += typoPenalty
        } else {
          if(typoStrictI!==0) score += typoPenalty
        }
        score += targetLen - searchLen
        prepared.score = score
        prepared.indexes = matchesBest

        return prepared
      }
    },

    highlight: function(result) {
      var highlighted = ''
      var matchesIndex = 0
      var opened = false
      var target = result._target
      var targetLen = target.length
      var matchesBest = result.indexes
      for(var i=0; i<targetLen; i++) { var char = target[i]
        if(matchesBest[matchesIndex] === i) {
          matchesIndex += 1
          if(!opened) {
            highlighted += fuzzysort.highlightOpen
            opened = true
          }

          if(matchesIndex === matchesBest.length) {
            highlighted += char + fuzzysort.highlightClose + target.substr(i+1)
            break
          }
        } else {
          if(opened) {
            highlighted += fuzzysort.highlightClose
            opened = false
          }
        }
        highlighted += char
      }

      return highlighted
    },

    // prepare: function(target) { return {_target:target, _targetLower:target.toLowerCase(), _beginningIndexes:fuzzysort.prepareBeginningIndexes(target)} },
    // prepareFast: function(target) { return {_target:target, _targetLower:target.toLowerCase(), _beginningIndexes:null} },
    prepare: function(target) {
      return {_target:target, _targetLowerCodes:fuzzysort.prepareLowerCodes(target), _nextBeginningIndexes:fuzzysort.prepareNextBeginningIndexes(target)}
    },
    prepareFast: function(target) {
      return {_target:target, _targetLowerCodes:fuzzysort.prepareLowerCodes(target), _nextBeginningIndexes:null}
    },
    prepareSearch: function(search) {
      return fuzzysort.prepareLowerCodes(search)
    },
    prepareLowerCodes: function(str) {
      var lowerCodes = new Array(str.length)
      var lower = str.toLowerCase()
      for (var i = str.length - 1; i >= 0; i--) lowerCodes[i] = lower.charCodeAt(i)
      return lowerCodes
    },
    prepareBeginningIndexes: function(target) {
      var targetLen = target.length
      var beginningIndexes = []; var beginningIndexesLen = 0
      var wasUpper = false
      var wasAlphanum = false
      for (var i = 0; i < targetLen; i++) {
        var targetCode = target.charCodeAt(i)
        var isUpper = targetCode>=65&&targetCode<=90
        var isAlphanum = isUpper || targetCode>=97&&targetCode<=122 || targetCode>=48&&targetCode<=57
        var isBeginning = isUpper && !wasUpper || !wasAlphanum || !isAlphanum
        wasUpper = isUpper
        wasAlphanum = isAlphanum
        if(isBeginning) beginningIndexes[beginningIndexesLen++] = i
      }
      return beginningIndexes
    },
    prepareNextBeginningIndexes: function(target) {
      var targetLen = target.length
      var beginningIndexes = fuzzysort.prepareBeginningIndexes(target)
      var nextBeginningIndexes = new Array(targetLen)
      var lastIsBeginning = beginningIndexes[0]
      var lastIsBeginningI = 0
      for (var i = 0; i < targetLen; i++) {
        if(lastIsBeginning>i) {
          nextBeginningIndexes[i] = lastIsBeginning
        } else {
          lastIsBeginning = beginningIndexes[++lastIsBeginningI]
          nextBeginningIndexes[i] = lastIsBeginning===undefined ? targetLen : lastIsBeginning
        }
      }
      return nextBeginningIndexes
    },
    cleanup: function() { cleanup() },
    new: fuzzysortNew,
  }
  return fuzzysort
} // fuzzysortNew

// This stuff is outside fuzzysortNew, because it's shared with instances of fuzzysort.new()
// Slightly hacked version of https://github.com/lemire/FastPriorityQueue.js
var fastpriorityqueue=function(){function t(){function t(){for(var t=0,a=r[t],s=1;s<i;){var o=s+1;t=s,o<i&&r[o].score>r[s].score&&(t=o),r[t-1>>1]=r[t],s=1+(t<<1)}for(var n=t-1>>1;t>0&&a.score>r[n].score;t=n,n=t-1>>1)r[t]=r[n];r[t]=a}var r=[],i=0,a=Object.assign({});return a.add=function(t){var a=i;r[i++]=t;for(var s=a-1>>1;a>0&&t.score>r[s].score;a=s,s=a-1>>1)r[a]=r[s];r[a]=t},a.poll=function(){var a=r[0];return r[0]=r[--i],t(),a},a.peek=function(t){return r[0]},a.replaceTop=function(i){r[0]=i,t()},a}return t}()
var q = fastpriorityqueue()
// function binarySearchMinGreater(a,v){for(var e,c=0,d=a.length;c!=d;)e=0|(c+d)/2,a[e]<=v?c=e+1:d=e;return a[c]}
var isNode = typeof require !== 'undefined' && typeof window === 'undefined'
var typoPenalty = 20
// var preparedCache
// function cleanup() {
//   preparedCache = {}; preparedCache['-'] = true; delete preparedCache['-'] // Force the object into hash mode now, instead of at runtime
// }
// cleanup()
var preparedCache = new Map()
var preparedSearchCache = new Map()
var noResults = []; noResults.total = 0
function cleanup() { preparedCache.clear(); preparedSearchCache.clear() }
return fuzzysortNew()
}) // UMD

// TODO: (performance) preparedCache is a memory leak

// TODO: (performance) is it important to make sure `highlighted` property always exists for hidden class optimization?

// TODO: (like sublime) backslash === forwardslash

// TODO: (performance) i have no idea how well optizmied the allowing typos algorithm is (or if it even works)

// TODO: (performance) search could assume to be lowercase?
