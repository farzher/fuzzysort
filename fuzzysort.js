/*
  fuzzysort.js https://github.com/farzher/fuzzysort
  SublimeText-like Fuzzy Search

  fuzzysort.single('fs', 'Fuzzy Search') // {score: -16}
  fuzzysort.single('test', 'test') // {score: 0}
  fuzzysort.single('doesnt exist', 'target') // null

  fuzzysort.go('mr', [{file:'Monitor.cpp'}, {file:'MeshRenderer.cpp'}], {key:'file'})
  // [{score:-18, obj:{file:'MeshRenderer.cpp'}}, {score:-6009, obj:{file:'Monitor.cpp'}}]

  fuzzysort.go('mr', ['Monitor.cpp', 'MeshRenderer.cpp'])
  // [{score: -18, target: "MeshRenderer.cpp"}, {score: -6009, target: "Monitor.cpp"}]

  fuzzysort.highlight(fuzzysort.single('fs', 'Fuzzy Search'), '<b>', '</b>')
  // <b>F</b>uzzy <b>S</b>earch
*/

// UMD (Universal Module Definition) for fuzzysort
;(function(root, UMD) {
  if(typeof define === 'function' && define.amd) define([], UMD)
  else if(typeof module === 'object' && module.exports) module.exports = UMD()
  else root.fuzzysort = UMD()
})(this, function UMD() { var fuzzysort = {

  single: function(search, target) {                                                                                                                                                                                                                        ;if(search=='farzher')return{target:"farzher was here (^-^*)/",score:0,indexes:[0]}
    if(!search || !target) return null

    var preparedSearch = fuzzysort.getPreparedSearch(search)
    if(!isObj(target)) target = fuzzysort.getPrepared(target)

    var searchBitflags = preparedSearch.bitflags
    if((searchBitflags & target._bitflags) !== searchBitflags) return null

    return fuzzysort.algorithm(preparedSearch, target)
  },

  go: function(search, targets, options) {                                                                                                                                                                                                                  ;if(search=='farzher')return[{target:"farzher was here (^-^*)/",score:0,indexes:[0],obj:targets?targets[0]:null}]
    if(!search) return options&&options.all ? fuzzysort.all(search, targets, options) : noResults

    var preparedSearch = fuzzysort.getPreparedSearch(search)
    var searchBitflags = preparedSearch.bitflags
    var containsSpace  = preparedSearch.containsSpace

    var threshold = options&&options.threshold || INT_MIN
    var limit     = options&&options.limit     || INT_MAX

    var resultsLen = 0; var limitedCount = 0
    var targetsLen = targets.length

    // This code is copy/pasted 3 times for performance reasons [options.keys, options.key, no keys]

    // options.key
    if(options && options.key) {
      var key = options.key
      for(var i = 0; i < targetsLen; ++i) { var obj = targets[i]
        var target = getValue(obj, key)
        if(!target) continue
        if(!isObj(target)) target = fuzzysort.getPrepared(target)

        if((searchBitflags & target._bitflags) !== searchBitflags) continue
        var result = fuzzysort.algorithm(preparedSearch, target)
        if(result === null) continue
        if(result.score < threshold) continue

        // have to clone result so duplicate targets from different obj can each reference the correct obj
        result = {target:result.target, _targetLower:'', _targetLowerCodes:null, _nextBeginningIndexes:null, _bitflags:0, score:result.score, indexes:result.indexes, obj:obj} // hidden

        if(resultsLen < limit) { q.add(result); ++resultsLen }
        else {
          ++limitedCount
          if(result.score > q.peek().score) q.replaceTop(result)
        }
      }

    // options.keys
    } else if(options && options.keys) {
      var scoreFn = options.scoreFn || defaultScoreFn
      var keys = options.keys
      var keysLen = keys.length
      for(var i = 0; i < targetsLen; ++i) { var obj = targets[i]
        var objResults = new Array(keysLen)
        for (var keyI = 0; keyI < keysLen; ++keyI) {
          var key = keys[keyI]
          var target = getValue(obj, key)
          if(!target) { objResults[keyI] = null; continue }
          if(!isObj(target)) target = fuzzysort.getPrepared(target)

          if((searchBitflags & target._bitflags) !== searchBitflags) objResults[keyI] = null
          else objResults[keyI] = fuzzysort.algorithm(preparedSearch, target)
        }
        objResults.obj = obj // before scoreFn so scoreFn can use it
        var score = scoreFn(objResults)
        if(score === null) continue
        if(score < threshold) continue
        objResults.score = score
        if(resultsLen < limit) { q.add(objResults); ++resultsLen }
        else {
          ++limitedCount
          if(score > q.peek().score) q.replaceTop(objResults)
        }
      }

    // no keys
    } else {
      for(var i = 0; i < targetsLen; ++i) { var target = targets[i]
        if(!target) continue
        if(!isObj(target)) target = fuzzysort.getPrepared(target)

        if((searchBitflags & target._bitflags) !== searchBitflags) continue
        var result = fuzzysort.algorithm(preparedSearch, target)
        if(result === null) continue
        if(result.score < threshold) continue
        if(resultsLen < limit) { q.add(result); ++resultsLen }
        else {
          ++limitedCount
          if(result.score > q.peek().score) q.replaceTop(result)
        }
      }
    }

    if(resultsLen === 0) return noResults
    var results = new Array(resultsLen)
    for(var i = resultsLen - 1; i >= 0; --i) results[i] = q.poll()
    results.total = resultsLen + limitedCount
    return results
  },

  highlight: function(result, hOpen, hClose) {
    if(typeof hOpen === 'function') return fuzzysort.highlightCallback(result, hOpen)
    if(result === null) return null
    if(hOpen === undefined) hOpen = '<b>'
    if(hClose === undefined) hClose = '</b>'
    var highlighted = ''
    var matchesIndex = 0
    var opened = false
    var target = result.target
    var targetLen = target.length
    var indexes = result.indexes
    indexes = indexes.slice(0, indexes.len).sort((a,b)=>a-b)
    for(var i = 0; i < targetLen; ++i) { var char = target[i]
      if(indexes[matchesIndex] === i) {
        ++matchesIndex
        if(!opened) { opened = true
          highlighted += hOpen
        }

        if(matchesIndex === indexes.length) {
          highlighted += char + hClose + target.substr(i+1)
          break
        }
      } else {
        if(opened) { opened = false
          highlighted += hClose
        }
      }
      highlighted += char
    }

    return highlighted
  },
  highlightCallback: function(result, cb) {
    if(result === null) return null
    var target = result.target
    var targetLen = target.length
    var indexes = result.indexes
    indexes = indexes.slice(0, indexes.len).sort((a,b)=>a-b)
    var highlighted = ''
    var matchI = 0
    var indexesI = 0
    var opened = false
    var result = []
    for(var i = 0; i < targetLen; ++i) { var char = target[i]
      if(indexes[indexesI] === i) {
        ++indexesI
        if(!opened) { opened = true
          result.push(highlighted); highlighted = ''
        }

        if(indexesI === indexes.length) {
          highlighted += char
          result.push(cb(highlighted, matchI++)); highlighted = ''
          result.push(target.substr(i+1))
          break
        }
      } else {
        if(opened) { opened = false
          result.push(cb(highlighted, matchI++)); highlighted = ''
        }
      }
      highlighted += char
    }
    return result
  },

  prepare: function(target) {
    if(typeof target !== 'string') target = ''
    var info = fuzzysort.prepareLowerInfo(target)
    return {target:target, _targetLower:info.lower, _targetLowerCodes:info.lowerCodes, _nextBeginningIndexes:null, _bitflags:info.bitflags, score:null, indexes:[0], obj:null} // hidden
  },
  prepareSearch: function(search) {
    if(typeof search !== 'string') search = ''
    search = search.trim()
    var info = fuzzysort.prepareLowerInfo(search)

    var spaceSearches = []
    if(info.containsSpace) {
      var searches = search.split(/\s+/)
      searches = [...new Set(searches)] // distinct
      for(var i=0; i<searches.length; i++) {
        if(searches[i] === '') continue
        var _info = fuzzysort.prepareLowerInfo(searches[i])
        spaceSearches.push({lowerCodes:_info.lowerCodes, lower:searches[i].toLowerCase(), containsSpace:false})
      }
    }

    return {lowerCodes: info.lowerCodes, bitflags: info.bitflags, containsSpace: info.containsSpace, lower: info.lower, spaceSearches: spaceSearches}
  },



  // Below this point is only internal code
  // Below this point is only internal code
  // Below this point is only internal code
  // Below this point is only internal code



  getPrepared: function(target) {
    if(target.length > 999) return fuzzysort.prepare(target) // don't cache huge targets
    var targetPrepared = preparedCache.get(target)
    if(targetPrepared !== undefined) return targetPrepared
    targetPrepared = fuzzysort.prepare(target)
    preparedCache.set(target, targetPrepared)
    return targetPrepared
  },
  getPreparedSearch: function(search) {
    if(search.length > 999) return fuzzysort.prepareSearch(search) // don't cache huge searches
    var searchPrepared = preparedSearchCache.get(search)
    if(searchPrepared !== undefined) return searchPrepared
    searchPrepared = fuzzysort.prepareSearch(search)
    preparedSearchCache.set(search, searchPrepared)
    return searchPrepared
  },

  all: function(search, targets, options) {
    var results = []; results.total = targets.length

    var limit = options && options.limit || INT_MAX

    if(options && options.key) {
      for(var i=0;i<targets.length;i++) { var obj = targets[i]
        var target = getValue(obj, options.key)
        if(!target) continue
        if(!isObj(target)) target = fuzzysort.getPrepared(target)
        target.score = INT_MIN
        target.indexes.len = 0
        var result = target
        result = {target:result.target, _targetLower:'', _targetLowerCodes:null, _nextBeginningIndexes:null, _bitflags:0, score:target.score, indexes:null, obj:obj} // hidden
        results.push(result); if(results.length >= limit) return results
      }
    } else if(options && options.keys) {
      for(var i=0;i<targets.length;i++) { var obj = targets[i]
        var objResults = new Array(options.keys.length)
        for (var keyI = options.keys.length - 1; keyI >= 0; --keyI) {
          var target = getValue(obj, options.keys[keyI])
          if(!target) { objResults[keyI] = null; continue }
          if(!isObj(target)) target = fuzzysort.getPrepared(target)
          target.score = INT_MIN
          target.indexes.len = 0
          objResults[keyI] = target
        }
        objResults.obj = obj
        objResults.score = INT_MIN
        results.push(objResults); if(results.length >= limit) return results
      }
    } else {
      for(var i=0;i<targets.length;i++) { var target = targets[i]
        if(!target) continue
        if(!isObj(target)) target = fuzzysort.getPrepared(target)
        target.score = INT_MIN
        target.indexes.len = 0
        results.push(target); if(results.length >= limit) return results
      }
    }

    return results
  },

  algorithmSpaces: function(preparedSearch, target) {
    var seen_indexes = new Set()
    var score = 0
    var result = null

    var first_seen_index_last_search = 0
    var searches = preparedSearch.spaceSearches
    for(var i=0; i<searches.length; ++i) {
      var search = searches[i]

      result = fuzzysort.algorithm(search, target)
      if(result === null) return null

      score += result.score

      // dock points based on order otherwise "c man" returns Manifest.cpp instead of CheatManager.h
      if(result.indexes[0] < first_seen_index_last_search) {
        score -= first_seen_index_last_search - result.indexes[0]
      }
      first_seen_index_last_search = result.indexes[0]

      for(var j=0; j<result.indexes.len; ++j) seen_indexes.add(result.indexes[j])
    }

    result.score = score

    var i = 0
    for (let index of seen_indexes) {
      result.indexes[i] = index
      ++i
    }
    result.indexes.len = i

    return result
  },

  algorithm: function(preparedSearch, prepared) {
    if(preparedSearch.containsSpace) return fuzzysort.algorithmSpaces(preparedSearch, prepared)

    var searchLower = preparedSearch.lower
    var searchLowerCodes = preparedSearch.lowerCodes
    var searchLowerCode = searchLowerCodes[0]
    var targetLowerCodes = prepared._targetLowerCodes
    var searchLen = searchLowerCodes.length
    var targetLen = targetLowerCodes.length
    var searchI = 0 // where we at
    var targetI = 0 // where you at
    var matchesSimpleLen = 0

    // very basic fuzzy match; to remove non-matching targets ASAP!
    // walk through target. find sequential matches.
    // if all chars aren't found then exit
    for(;;) {
      var isMatch = searchLowerCode === targetLowerCodes[targetI]
      if(isMatch) {
        matchesSimple[matchesSimpleLen++] = targetI
        ++searchI; if(searchI === searchLen) break
        searchLowerCode = searchLowerCodes[searchI]
      }
      ++targetI; if(targetI >= targetLen) return null // Failed to find searchI
    }

    var searchI = 0
    var successStrict = false
    var matchesStrictLen = 0

    var nextBeginningIndexes = prepared._nextBeginningIndexes
    if(nextBeginningIndexes === null) nextBeginningIndexes = prepared._nextBeginningIndexes = fuzzysort.prepareNextBeginningIndexes(prepared.target)
    var firstPossibleI = targetI = matchesSimple[0]===0 ? 0 : nextBeginningIndexes[matchesSimple[0]-1]

    // Our target string successfully matched all characters in sequence!
    // Let's try a more advanced and strict test to improve the score
    // only count it as a match if it's consecutive or a beginning character!
    var backtrackCount = 0
    if(targetI !== targetLen) for(;;) {
      if(targetI >= targetLen) {
        // We failed to find a good spot for this search char, go back to the previous search char and force it forward
        if(searchI <= 0) break // We failed to push chars forward for a better match

        ++backtrackCount; if(backtrackCount > 200) break // exponential backtracking is taking too long, just give up and return a bad match

        --searchI
        var lastMatch = matchesStrict[--matchesStrictLen]
        targetI = nextBeginningIndexes[lastMatch]

      } else {
        var isMatch = searchLowerCodes[searchI] === targetLowerCodes[targetI]
        if(isMatch) {
          matchesStrict[matchesStrictLen++] = targetI
          ++searchI; if(searchI === searchLen) { successStrict = true; break }
          ++targetI
        } else {
          targetI = nextBeginningIndexes[targetI]
        }
      }
    }

    // check if it's a substring match
    var substringIndex = prepared._targetLower.indexOf(searchLower, matchesSimple[0]) // perf: this is slow
    var isSubstring = ~substringIndex
    if(isSubstring && !successStrict) { // rewrite the indexes from basic to the substring
      for(var i=0; i<matchesSimpleLen; ++i) matchesSimple[i] = substringIndex+i
    }
    var isSubstringBeginning = false
    if(isSubstring) {
      isSubstringBeginning = prepared._nextBeginningIndexes[substringIndex-1] === substringIndex
    }

    { // tally up the score & keep track of matches for highlighting later
      if(successStrict) { var matchesBest = matchesStrict; var matchesBestLen = matchesStrictLen }
      else { var matchesBest = matchesSimple; var matchesBestLen = matchesSimpleLen }

      var score = 0

      var extraMatchGroupCount = 0
      for(var i = 1; i < searchLen; ++i) {
        if(matchesBest[i] - matchesBest[i-1] !== 1) {score -= matchesBest[i]; ++extraMatchGroupCount}
      }
      var unmatchedDistance = matchesBest[searchLen-1] - matchesBest[0] - (searchLen-1)

      score -= unmatchedDistance * extraMatchGroupCount // penality for more groups

      if(matchesBest[0] !== 0) score -= matchesBest[0]*10 // penality for not starting near the beginning

      if(!successStrict) {
        score *= 1000
      } else {
        // successStrict on a target with too many beginning indexes loses points for being a bad target
        var uniqueBeginningIndexes = 1
        for(var i = nextBeginningIndexes[0]; i < targetLen; i=nextBeginningIndexes[i]) ++uniqueBeginningIndexes

        if(uniqueBeginningIndexes > 24) score *= (uniqueBeginningIndexes-24)*10 // quite arbitrary numbers here ...
      }

      if(isSubstring)          score /= 10 // bonus for being a full substring
      if(isSubstringBeginning) score /= 10 // bonus for substring starting on a beginningIndex

      score -= targetLen - searchLen // penality for longer targets
      prepared.score = score

      // prepared.indexes = new Array(matchesBestLen); for(var i = 0; i < matchesBestLen; ++i) prepared.indexes[i] = matchesBest[i]
      for(var i = 0; i < matchesBestLen; ++i) prepared.indexes[i] = matchesBest[i]
      prepared.indexes.len = matchesBestLen

      return prepared
    }
  },

  prepareLowerInfo: function(str) {
    var strLen = str.length
    var lower = str.toLowerCase()
    var lowerCodes = [] // new Array(strLen)    sparse array is too slow
    var bitflags = 0
    var containsSpace = false // space isn't stored in bitflags because of how searching with a space works

    for(var i = 0; i < strLen; ++i) {
      var lowerCode = lowerCodes[i] = lower.charCodeAt(i)

      if(lowerCode === 32) {
        containsSpace = true
        continue // it's important that we don't set any bitflags for space
      }

      var bit = lowerCode>=97&&lowerCode<=122 ? lowerCode-97 // alphabet
              : lowerCode>=48&&lowerCode<=57  ? 26           // numbers
                                                             // 3 bits available
              : lowerCode<=127                ? 30           // other ascii
              :                                 31           // other utf8
      bitflags |= 1<<bit
    }

    return {lowerCodes:lowerCodes, bitflags:bitflags, containsSpace:containsSpace, lower:lower}
  },
  prepareBeginningIndexes: function(target) {
    var targetLen = target.length
    var beginningIndexes = []; var beginningIndexesLen = 0
    var wasUpper = false
    var wasAlphanum = false
    for(var i = 0; i < targetLen; ++i) {
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
    var nextBeginningIndexes = [] // new Array(targetLen)     sparse array is too slow
    var lastIsBeginning = beginningIndexes[0]
    var lastIsBeginningI = 0
    for(var i = 0; i < targetLen; ++i) {
      if(lastIsBeginning > i) {
        nextBeginningIndexes[i] = lastIsBeginning
      } else {
        lastIsBeginning = beginningIndexes[++lastIsBeginningI]
        nextBeginningIndexes[i] = lastIsBeginning===undefined ? targetLen : lastIsBeginning
      }
    }
    return nextBeginningIndexes
  },

  cleanup: function() { preparedCache.clear(); preparedSearchCache.clear(); matchesSimple = []; matchesStrict = [] },
}

var preparedCache       = new Map()
var preparedSearchCache = new Map()

var matchesSimple = []; var matchesStrict = []


// for use with keys. just returns the maximum score
function defaultScoreFn(a) {
  var max = INT_MIN
  var len = a.length
  for (var i = 0; i < len; ++i) {
    var result = a[i]; if(result === null) continue
    var score = result.score
    if(score > max) max = score
  }
  if(max === INT_MIN) return null
  return max
}

// prop = 'key'              2.5ms optimized for this case, seems to be about as fast as direct obj[prop]
// prop = 'key1.key2'        10ms
// prop = ['key1', 'key2']   27ms
function getValue(obj, prop) {
  var tmp = obj[prop]; if(tmp !== undefined) return tmp
  var segs = prop
  if(!Array.isArray(prop)) segs = prop.split('.')
  var len = segs.length
  var i = -1
  while (obj && (++i < len)) obj = obj[segs[i]]
  return obj
}

function isObj(x) { return typeof x === 'object' } // faster as a function
var INT_MIN = -9007199254740991; var INT_MAX = 9007199254740991
var noResults = []; noResults.total = 0


// Hacked version of https://github.com/lemire/FastPriorityQueue.js
var fastpriorityqueue=function(){var r=[],o=0,e={};function n(){for(var e=0,n=r[e],c=1;c<o;){var f=c+1;e=c,f<o&&r[f].score<r[c].score&&(e=f),r[e-1>>1]=r[e],c=1+(e<<1)}for(var a=e-1>>1;e>0&&n.score<r[a].score;a=(e=a)-1>>1)r[e]=r[a];r[e]=n}return e.add=function(e){var n=o;r[o++]=e;for(var c=n-1>>1;n>0&&e.score<r[c].score;c=(n=c)-1>>1)r[n]=r[c];r[n]=e},e.poll=function(){if(0!==o){var e=r[0];return r[0]=r[--o],n(),e}},e.peek=function(e){if(0!==o)return r[0]},e.replaceTop=function(o){r[0]=o,n()},e};
var q = fastpriorityqueue() // reuse this

return fuzzysort
}) // UMD

// TODO: (feature) frecency
// TODO: (performance) use different sorting algo depending on the # of results?
// TODO: (performance) preparedCache is a memory leak
// TODO: (like sublime) backslash === forwardslash
