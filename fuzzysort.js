// https://github.com/farzher/fuzzysort v3.0.2

// UMD (Universal Module Definition) for fuzzysort
;((root, UMD) => {
  if(typeof define === 'function' && define.amd) define([], UMD)
  else if(typeof module === 'object' && module.exports) module.exports = UMD()
  else root['fuzzysort'] = UMD()
})(this, _ => {
  'use strict'

  var single = (search, target) => {
    if(!search || !target) return NULL

    var preparedSearch = getPreparedSearch(search)
    if(!isPrepared(target)) target = getPrepared(target)

    var searchBitflags = preparedSearch.bitflags
    if((searchBitflags & target._bitflags) !== searchBitflags) return NULL

    var result = algorithm(preparedSearch, target)
    return result === NULL ? NULL : materialize(result)
  }

  var go = (search, targets, options) => {
    if(targets instanceof PreparedTargets) return goPrepared(search, targets, options)
    if(!search) return options?.all ? all(targets, options) : noResults

    var preparedSearch = getPreparedSearch(search)
    var searchBitflags = preparedSearch.bitflags
    var containsSpace  = preparedSearch.containsSpace

    var threshold = denormalizeScore( options?.threshold || 0 )
    var limit     = options?.limit || INFINITY

    var resultsLen = 0; var limitedCount = 0
    var targetsLen = targets.length
    function push_result(result) {
      if(resultsLen < limit) { q.add(result); ++resultsLen }
      else {
        ++limitedCount
        if(result._score > q.peek()._score) q.replaceTop(result)
      }
    }
    // Most searches match far more targets than their limit. Delay allocating the
    // public Result until a candidate actually enters the result heap.
    function push_prepared(prepared, obj) {
      if(resultsLen < limit) {
        q.add(materialize(prepared, obj)); ++resultsLen
      } else {
        ++limitedCount
        if(prepared._score > q.peek()._score) q.replaceTop(materialize(prepared, obj))
      }
    }

    // This code is copy/pasted 3 times for performance reasons [options.key, options.keys, no keys]

    // options.key
    if(options?.key) {
      var key = options.key
      var keyGetter = makeGetter(key)
      for(var i = 0; i < targetsLen; ++i) { var obj = targets[i]
        var target = keyGetter === NULL ? getValue(obj, key) : keyGetter(obj)
        if(!target) continue
        if(!isPrepared(target)) target = getPrepared(target)

        if((searchBitflags & target._bitflags) !== searchBitflags) continue
        var result = algorithm(preparedSearch, target)
        if(result === NULL) continue
        if(result._score < threshold) continue

        push_prepared(result, obj)
      }

    // options.keys
    } else if(options?.keys) {
      var keys = options.keys
      var keysLen = keys.length
      var keyGetters = new Array(keysLen)
      for(var keyI = 0; keyI < keysLen; ++keyI) keyGetters[keyI] = makeGetter(keys[keyI])

      outer: for(var i = 0; i < targetsLen; ++i) { var obj = targets[i]

        { // early out based on bitflags
          var keysBitflags = 0
          for (var keyI = 0; keyI < keysLen; ++keyI) {
            var keyGetter = keyGetters[keyI]
            var target = keyGetter === NULL ? getValue(obj, keys[keyI]) : keyGetter(obj)
            if(!target) { tmpTargets[keyI] = noTarget; continue }
            if(!isPrepared(target)) target = getPrepared(target)
            tmpTargets[keyI] = target

            keysBitflags |= target._bitflags
          }

          if((searchBitflags & keysBitflags) !== searchBitflags) continue
        }

        if(containsSpace) for(let i=0; i<preparedSearch.spaceSearches.length; i++) keysSpacesBestScores[i] = NEGATIVE_INFINITY

        for (var keyI = 0; keyI < keysLen; ++keyI) {
          target = tmpTargets[keyI]
          if(target === noTarget) { tmpResults[keyI] = noTarget; continue }

          var keyResult = algorithm(preparedSearch, target, /*allowSpaces=*/false, /*allowPartialMatch=*/containsSpace)
          if(keyResult === NULL) { tmpResults[keyI] = noTarget; continue }
          tmpResults[keyI] = materialize(keyResult)

          // todo: this seems weird and wrong. like what if our first match wasn't good. this should just replace it instead of averaging with it
          // if our second match isn't good we ignore it instead of averaging with it
          if(containsSpace) for(let i=0; i<preparedSearch.spaceSearches.length; i++) {
            if(allowPartialMatchScores[i] > -1000) {
              if(keysSpacesBestScores[i] > NEGATIVE_INFINITY) {
                var tmp = (keysSpacesBestScores[i] + allowPartialMatchScores[i]) / 4/*bonus score for having multiple matches*/
                if(tmp > keysSpacesBestScores[i]) keysSpacesBestScores[i] = tmp
              }
            }
            if(allowPartialMatchScores[i] > keysSpacesBestScores[i]) keysSpacesBestScores[i] = allowPartialMatchScores[i]
          }
        }

        if(containsSpace) {
          for(let i=0; i<preparedSearch.spaceSearches.length; i++) { if(keysSpacesBestScores[i] === NEGATIVE_INFINITY) continue outer }
        } else {
          var hasAtLeast1Match = false
          for(let i=0; i < keysLen; i++) { if(tmpResults[i]._score !== NEGATIVE_INFINITY) { hasAtLeast1Match = true; break } }
          if(!hasAtLeast1Match) continue
        }

        var objResults = new KeysResult(keysLen)
        for(let i=0; i < keysLen; i++) { objResults[i] = tmpResults[i] }

        if(containsSpace) {
          var score = 0
          for(let i=0; i<preparedSearch.spaceSearches.length; i++) score += keysSpacesBestScores[i]
        } else {
          // todo could rewrite this scoring to be more similar to when there's spaces
          // if we match multiple keys give us bonus points
          var score = NEGATIVE_INFINITY
          for(let i=0; i<keysLen; i++) {
            var result = objResults[i]
            if(result._score > -1000) {
              if(score > NEGATIVE_INFINITY) {
                var tmp = (score + result._score) / 4/*bonus score for having multiple matches*/
                if(tmp > score) score = tmp
              }
            }
            if(result._score > score) score = result._score
          }
        }

        objResults.obj = obj
        objResults._score = score
        if(options?.['scoreFn']) {
          score = options['scoreFn'](objResults)
          if(!score) continue
          score = denormalizeScore(score)
          objResults._score = score
        }

        if(score < threshold) continue
        push_result(objResults)
      }

    // no keys
    } else {
      for(var i = 0; i < targetsLen; ++i) { var target = targets[i]
        if(!target) continue
        if(!isPrepared(target)) target = getPrepared(target)

        if((searchBitflags & target._bitflags) !== searchBitflags) continue
        var result = algorithm(preparedSearch, target)
        if(result === NULL) continue
        if(result._score < threshold) continue

        push_prepared(result)
      }
    }

    if(resultsLen === 0) return noResults
    var results = new Array(resultsLen)
    for(var i = resultsLen - 1; i >= 0; --i) results[i] = q.poll()
    results.total = resultsLen + limitedCount
    return results
  }


  // this is written as 1 function instead of 2 for minification. perf seems fine ...
  // except when minified. the perf is very slow
  var highlight = (result, open='<b>', close='</b>') => {
    var callback = typeof open === 'function' ? open : undefined

    var target      = result.target
    var targetLen   = target.length
    var rawIndexes  = result['_indexes']
    var indexes     = rawIndexes === undefined
      ? result.indexes
      : rawIndexes.slice(0, rawIndexes['len'] ?? rawIndexes.length).sort((a,b)=>a-b)
    var highlighted = ''
    var matchI      = 0
    var indexesI    = 0
    var opened      = false
    var parts       = []

    for(var i = 0; i < targetLen; ++i) { var char = target[i]
      if(indexes[indexesI] === i) {
        ++indexesI
        if(!opened) { opened = true
          if(callback) {
            parts.push(highlighted); highlighted = ''
          } else {
            highlighted += open
          }
        }

        if(indexesI === indexes.length) {
          if(callback) {
            highlighted += char
            parts.push(callback(highlighted, matchI++)); highlighted = ''
            parts.push(target.substr(i+1))
          } else {
            highlighted += char + close + target.substr(i+1)
          }
          break
        }
      } else {
        if(opened) { opened = false
          if(callback) {
            parts.push(callback(highlighted, matchI++)); highlighted = ''
          } else {
            highlighted += close
          }
        }
      }
      highlighted += char
    }

    return callback ? parts : highlighted
  }


  var prepareTarget = (target, firstBeginnings=NULL, beginningCounts=NULL, preparedRow=-1) => {
    if(typeof target === 'number') target = ''+target
    else if(typeof target !== 'string') target = ''
    if(target.length >= 65535) preparedRow = -1
    var info = prepareLowerInfo(target, firstBeginnings, beginningCounts, preparedRow)
    var result = new_result(target, {_targetLower:info._lower, _targetLowerCodes:info.lowerCodes, _bitflags:info.bitflags})
    if(preparedRow >= 0) {
      result._preparedFirstBeginnings = firstBeginnings
      result._preparedBeginningCounts = beginningCounts
      result._preparedRow = preparedRow
      result._beginningIndexesLen = beginningCounts[preparedRow]
    }
    return result
  }

  var preparedEntryMarker = {}
  class PreparedTargets {
    constructor(targets, options) {
      this._mode = options?.keys ? 2 : options?.key ? 1 : 0
      this._targets = new Array(targets.length)
      this._keys = NULL
      var keysLen = this._mode === 2 ? options.keys.length : 1
      var preparedLen = targets.length * keysLen
      var firstBeginnings = new Uint16Array(preparedLen * 26)
      var beginningCounts = new Uint16Array(preparedLen)

      if(this._mode === 0) {
        for(var i=0; i<targets.length; ++i) this._targets[i] = prepareTarget(targets[i], firstBeginnings, beginningCounts, i)
      } else if(this._mode === 1) {
        var key = options.key
        var getter = makeGetter(key)
        this._objects = targets.slice()
        for(var i=0; i<targets.length; ++i) {
          var obj = targets[i]
          var value = getter === NULL ? getValue(obj, key) : getter(obj)
          this._targets[i] = value ? prepareTarget(value, firstBeginnings, beginningCounts, i) : noTarget
        }
      } else {
        var keys = options.keys
        var getters = new Array(keysLen)
        this._keys = new Array(keysLen)
        for(var keyI=0; keyI<keysLen; ++keyI) {
          getters[keyI] = makeGetter(keys[keyI])
          this._keys[keyI] = makePreparedKeyGetter(keyI)
        }
        for(var i=0; i<targets.length; ++i) {
          var obj = targets[i]
          var values = new Array(keysLen)
          for(var keyI=0; keyI<keysLen; ++keyI) {
            var getter = getters[keyI]
            var value = getter === NULL ? getValue(obj, keys[keyI]) : getter(obj)
            var preparedRow = i * keysLen + keyI
            values[keyI] = value ? prepareTarget(value, firstBeginnings, beginningCounts, preparedRow) : noTarget
          }
          this._targets[i] = {_prepared:preparedEntryMarker, _obj:obj, _targets:values}
        }
      }
    }
  }
  var makePreparedKeyGetter = i => entry => entry._targets[i]
  var prepare = (targets, options) => new PreparedTargets(targets, options)
  // Finite prepared searches can heap the internal targets directly and only
  // allocate the public results that survive the limit.
  var goPreparedTargets = (search, targets, options) => {
    var preparedSearch = getPreparedSearch(search)
    var searchBitflags = preparedSearch.bitflags
    var threshold = denormalizeScore( options?.threshold || 0 )
    var limit = options?.limit || INFINITY
    var resultsLen = 0; var limitedCount = 0

    for(var i=0; i<targets.length; ++i) {
      var prepared = targets[i]
      if((searchBitflags & prepared._bitflags) !== searchBitflags) continue
      var result = algorithm(preparedSearch, prepared)
      if(result === NULL || result._score < threshold) continue

      // Prepared targets already have the score shape needed by the heap. Keep
      // them there directly and allocate only the public results that survive.
      if(resultsLen < limit) {
        q.add(result); ++resultsLen
      } else {
        ++limitedCount
        if(result._score > q.peek()._score) q.replaceTop(result)
      }
    }

    if(resultsLen === 0) return noResults
    var results = new Array(resultsLen)
    for(var i=resultsLen-1; i>=0; --i) results[i] = materialize(q.poll())
    results.total = resultsLen + limitedCount
    return results
  }
  var goPreparedKey = (search, targets, objects, options) => {
    if(!search) {
      if(!options?.all) return noResults
      var results = []; results.total = targets.length
      var limit = options?.limit || INFINITY
      for(var i=0; i<targets.length && i<limit; ++i) {
        var target = targets[i]
        results.push(new_result(target.target, {_score:target._score, obj:objects[i]}))
      }
      return results
    }

    var preparedSearch = getPreparedSearch(search)
    var searchBitflags = preparedSearch.bitflags
    var threshold = denormalizeScore( options?.threshold || 0 )
    var limit = options?.limit || INFINITY
    var resultsLen = 0; var limitedCount = 0

    for(var i=0; i<targets.length; ++i) {
      var prepared = targets[i]
      if((searchBitflags & prepared._bitflags) !== searchBitflags) continue
      var result = algorithm(preparedSearch, prepared)
      if(result === NULL || result._score < threshold) continue

      if(resultsLen < limit) {
        q.add(materialize(result, objects[i])); ++resultsLen
      } else {
        ++limitedCount
        if(result._score > q.peek()._score) q.replaceTop(materialize(result, objects[i]))
      }
    }

    if(resultsLen === 0) return noResults
    var results = new Array(resultsLen)
    for(var i=resultsLen-1; i>=0; --i) results[i] = q.poll()
    results.total = resultsLen + limitedCount
    return results
  }
  var goPrepared = (search, prepared, options) => {
    if(options?.key || options?.keys) throw new Error('fuzzysort: key/keys must be provided to prepare(), not go()')
    if(prepared._mode === 0) {
      // With no finite heap, every match must be materialized anyway and the
      // established generic path is faster at collecting large result sets.
      if(!search || !options?.limit) return go(search, prepared._targets, options)
      return goPreparedTargets(search, prepared._targets, options)
    }
    if(prepared._mode === 1) return goPreparedKey(search, prepared._targets, prepared._objects, options)

    var preparedOptions = Object.assign({}, options)
    preparedOptions.keys = prepared._keys
    if(options?.['scoreFn']) {
      var scoreFn = options['scoreFn']
      preparedOptions['scoreFn'] = result => {
        result.obj = result.obj._obj
        return scoreFn(result)
      }
    }
    var results = go(search, prepared._targets, preparedOptions)
    for(var i=0; i<results.length; ++i) {
      if(results[i].obj && results[i].obj._prepared === preparedEntryMarker) results[i].obj = results[i].obj._obj
    }
    return results
  }

  var cleanup = () => { preparedCache.clear(); preparedSearchCache.clear() }

  // Result accessors and methods live on the prototype, which structuredClone
  // does not preserve. These helpers also work on results sent from a Worker.
  var getScore = result => {
    var score = result['score']
    return score === undefined ? normalizeScore(result['_score']) : score
  }


  // Below this point is only internal code
  // Below this point is only internal code
  // Below this point is only internal code
  // Below this point is only internal code


  class Result {
    get ['indexes']() { return this._indexes.slice(0, this._indexes.len).sort((a,b)=>a-b) }
    set ['indexes'](indexes) { return this._indexes = indexes }
    ['highlight'](open, close) { return highlight(this, open, close) }
    get ['score']() { return normalizeScore(this._score) }
    set ['score'](score) { this._score = denormalizeScore(score) }
  }

  class KeysResult extends Array {
    get ['score']() { return normalizeScore(this._score) }
    set ['score'](score) { this._score = denormalizeScore(score) }
  }

  var materialize = (prepared, obj=NULL) => {
    var result = new Result()
    result.target   = prepared.target
    result.obj      = obj
    result._score   = prepared._score
    result._indexes = prepared._indexes
    return result
  }

  var new_result = (target, options) => {
    const result = new Result()
    result['target']             = target
    result['obj']                = options.obj                   ?? NULL
    result._score                = options._score                ?? NEGATIVE_INFINITY
    result._indexes              = options._indexes              ?? []
    result._targetLower          = options._targetLower          ?? ''
    result._targetLowerCodes     = options._targetLowerCodes     ?? NULL
    result._nextBeginningIndexes = options._nextBeginningIndexes ?? NULL
    result._beginningIndexesLen  = options._beginningIndexesLen  ?? 0
    result._singleMatchCode      = -1
    result._singleMatchIndex     = -1
    result._singleMatchStrict    = false
    result._bitflags             = options._bitflags             ?? 0
    return result
  }


  var normalizeScore = score => {
    if(score === NEGATIVE_INFINITY) return 0
    if(score > 1) return score
    return Math.E ** ( ((-score + 1)**.04307 - 1) * -2)
  }
  var denormalizeScore = normalizedScore => {
    if(normalizedScore === 0) return NEGATIVE_INFINITY
    if(normalizedScore > 1) return normalizedScore
    return 1 - Math.pow((Math.log(normalizedScore) / -2 + 1), 1 / 0.04307)
  }


  var prepareSearch = (search) => {
    if(typeof search === 'number') search = ''+search
    else if(typeof search !== 'string') search = ''
    search = search.trim()
    var info = prepareLowerInfo(search)

    var spaceSearches = []
    if(info.containsSpace) {
      var searches = search.split(/\s+/)
      searches = [...new Set(searches)] // distinct
      for(var i=0; i<searches.length; i++) {
        if(searches[i] === '') continue
        var _info = prepareLowerInfo(searches[i])
        spaceSearches.push({lowerCodes:_info.lowerCodes, _lower:searches[i].toLowerCase(), containsSpace:false})
      }
    }

    return {lowerCodes: info.lowerCodes, _lower: info._lower, containsSpace: info.containsSpace, bitflags: info.bitflags, spaceSearches: spaceSearches}
  }



  var getPrepared = (target) => {
    if(target.length > 999) return prepareTarget(target) // don't cache huge targets
    var targetPrepared = preparedCache.get(target)
    if(targetPrepared !== undefined) return targetPrepared
    targetPrepared = prepareTarget(target)
    preparedCache.set(target, targetPrepared)
    return targetPrepared
  }
  var getPreparedSearch = (search) => {
    if(search.length > 999) return prepareSearch(search) // don't cache huge searches
    var searchPrepared = preparedSearchCache.get(search)
    if(searchPrepared !== undefined) return searchPrepared
    searchPrepared = prepareSearch(search)
    preparedSearchCache.set(search, searchPrepared)
    return searchPrepared
  }


  var all = (targets, options) => {
    var results = []; results.total = targets.length // this total can be wrong if some targets are skipped

    var limit = options?.limit || INFINITY

    if(options?.key) {
      var key = options.key
      var keyGetter = makeGetter(key)
      for(var i=0;i<targets.length;i++) { var obj = targets[i]
        var target = keyGetter === NULL ? getValue(obj, key) : keyGetter(obj)
        if(target == NULL) continue
        if(!isPrepared(target)) target = getPrepared(target)
        var result = new_result(target.target, {_score: target._score, obj: obj})
        results.push(result); if(results.length >= limit) return results
      }
    } else if(options?.keys) {
      var keys = options.keys
      var keysLen = keys.length
      var keyGetters = new Array(keysLen)
      for(var keyI = 0; keyI < keysLen; ++keyI) keyGetters[keyI] = makeGetter(keys[keyI])
      for(var i=0;i<targets.length;i++) { var obj = targets[i]
        var objResults = new KeysResult(keysLen)
        for (var keyI = keysLen - 1; keyI >= 0; --keyI) {
          var keyGetter = keyGetters[keyI]
          var target = keyGetter === NULL ? getValue(obj, keys[keyI]) : keyGetter(obj)
          if(!target) { objResults[keyI] = noTarget; continue }
          if(!isPrepared(target)) target = getPrepared(target)
          target._score = NEGATIVE_INFINITY
          target._indexes.len = 0
          objResults[keyI] = target
        }
        objResults.obj = obj
        objResults._score = NEGATIVE_INFINITY
        results.push(objResults); if(results.length >= limit) return results
      }
    } else {
      for(var i=0;i<targets.length;i++) { var target = targets[i]
        if(target == NULL) continue
        if(!isPrepared(target)) target = getPrepared(target)
        target._score = NEGATIVE_INFINITY
        target._indexes.len = 0
        results.push(target); if(results.length >= limit) return results
      }
    }

    return results
  }


  var algorithm = (preparedSearch, prepared, allowSpaces=false, allowPartialMatch=false, nextBeginningIndexesChanged=false, allowSingleCharacter=true) => {
    if(allowSpaces===false && preparedSearch.containsSpace) return algorithmSpaces(preparedSearch, prepared, allowPartialMatch)

    var searchLower      = preparedSearch._lower
    var searchLowerCodes = preparedSearch.lowerCodes
    var searchLowerCode  = searchLowerCodes[0]
    var targetLowerCodes = prepared._targetLowerCodes
    var searchLen        = searchLowerCodes.length
    var targetLen        = targetLowerCodes.length
    var searchI          = 0 // where we at
    var targetI          = 0 // where you at
    var matchesSimpleLen = 0

    // Prepared collections can answer ASCII letter searches directly from their
    // shared table, skipping both the target scan and lazy beginning preparation.
    if(searchLen === 1 && !nextBeginningIndexesChanged && allowSingleCharacter && prepared._preparedRow >= 0 && searchLowerCode>=97 && searchLowerCode<=122) {
      var preparedSlot = prepared._preparedRow*26 + searchLowerCode-97
      var simpleMatchIndex = prepared._targetLower.indexOf(searchLower)
      if(simpleMatchIndex === -1) return NULL
      var encodedBeginning = prepared._preparedFirstBeginnings[preparedSlot]
      var successStrict = encodedBeginning !== 0
      var matchIndex = successStrict ? encodedBeginning-1 : simpleMatchIndex
      var score = matchIndex === 0 ? 0 : -matchIndex*matchIndex*.2
      if(!successStrict) score *= 1000
      else if(prepared._beginningIndexesLen > 24) score *= (prepared._beginningIndexesLen-24)*10
      prepared._score = score - (targetLen-1)
      prepared._indexes[0] = matchIndex
      prepared._indexes.len = 1
      return prepared
    }

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
      ++targetI; if(targetI >= targetLen) return NULL // Failed to find searchI
    }

    // Prepared collections keep first word-beginning matches for every letter in
    // compact shared typed arrays. Other targets cache the first character used.
    if(searchLen === 1 && !nextBeginningIndexesChanged && allowSingleCharacter) {
      if(prepared._singleMatchCode === searchLowerCode) {
        var matchIndex = prepared._singleMatchIndex
        var successStrict = prepared._singleMatchStrict
      } else if(prepared._nextBeginningIndexes !== NULL) {
        var nextBeginningIndexes = prepared._nextBeginningIndexes
        targetI = matchesSimple[0]===0 ? 0 : nextBeginningIndexes[matchesSimple[0]-1]
        while(targetI < targetLen && searchLowerCode !== targetLowerCodes[targetI]) targetI = nextBeginningIndexes[targetI]
        var successStrict = targetI < targetLen
        var matchIndex = successStrict ? targetI : matchesSimple[0]
      } else {
        prepareSingleMatch(prepared, searchLowerCode, matchesSimple[0])
        var matchIndex = prepared._singleMatchIndex
        var successStrict = prepared._singleMatchStrict
      }
      var score = matchIndex === 0 ? 0 : -matchIndex*matchIndex*.2
      if(!successStrict) score *= 1000
      else if(prepared._beginningIndexesLen > 24) score *= (prepared._beginningIndexesLen-24)*10
      prepared._score = score - (targetLen-1)
      prepared._indexes[0] = matchIndex
      prepared._indexes.len = 1
      return prepared
    }

    var searchI = 0
    var successStrict = false
    var matchesStrictLen = 0

    var nextBeginningIndexes = prepared._nextBeginningIndexes
    if(nextBeginningIndexes === NULL) nextBeginningIndexes = prepared._nextBeginningIndexes = prepareNextBeginningIndexes(prepared)
    var beginningIndexesLen = nextBeginningIndexesChanged ? 0 : prepared._beginningIndexesLen
    if(!beginningIndexesLen) {
      beginningIndexesLen = 1
      for(var i = nextBeginningIndexes[0]; i < targetLen; i=nextBeginningIndexes[i]) ++beginningIndexesLen
      if(!nextBeginningIndexesChanged) prepared._beginningIndexesLen = beginningIndexesLen
    }

    // A substring beginning at the first simple match is necessarily a strict
    // match. This common case can skip the strict backtracking pass entirely.
    var substringIndex = searchLen <= 1 ? -1 : prepared._targetLower.indexOf(searchLower, matchesSimple[0])
    var isSubstring = substringIndex !== -1
    var isSubstringBeginning = isSubstring && (substringIndex===0 || nextBeginningIndexes[substringIndex-1] === substringIndex)
    if(isSubstringBeginning && substringIndex === matchesSimple[0]) {
      successStrict = true
    } else {
      targetI = matchesSimple[0]===0 ? 0 : nextBeginningIndexes[matchesSimple[0]-1]

      // Try a strict match: every character must be consecutive or at a word beginning.
      var backtrackCount = 0
      if(targetI !== targetLen) for(;;) {
        if(targetI >= targetLen) {
          if(searchI <= 0) break
          ++backtrackCount; if(backtrackCount > 200) break
          --searchI
          var lastMatch = matchesStrict[--matchesStrictLen]
          targetI = nextBeginningIndexes[lastMatch]
        } else if(searchLowerCodes[searchI] === targetLowerCodes[targetI]) {
          matchesStrict[matchesStrictLen++] = targetI
          ++searchI; if(searchI === searchLen) { successStrict = true; break }
          ++targetI
        } else {
          targetI = nextBeginningIndexes[targetI]
        }
      }
    }

    // if it's a substring match but not at a beginning index, let's try to find a substring starting at a beginning index for a better score
    if(isSubstring && !isSubstringBeginning) {
      for(var i=0; i<nextBeginningIndexes.length; i=nextBeginningIndexes[i]) {
        if(i <= substringIndex) continue

        for(var s=0; s<searchLen; s++) if(searchLowerCodes[s] !== targetLowerCodes[i+s]) break
        if(s === searchLen) { substringIndex = i; isSubstringBeginning = true; break }
      }
    }

    // tally up the score & keep track of matches for highlighting later
    // if it's a simple match, we'll switch to a substring match if a substring exists
    // if it's a strict match, we'll switch to a substring match only if that's a better score

    if(!successStrict) {
      if(isSubstring) for(var i=0; i<searchLen; ++i) matchesSimple[i] = substringIndex+i // at this point it's safe to overwrite matchehsSimple with substr matches
      var matchesBest = matchesSimple
    } else {
      if(isSubstringBeginning) {
        for(var i=0; i<searchLen; ++i) matchesSimple[i] = substringIndex+i // at this point it's safe to overwrite matchehsSimple with substr matches
        var matchesBest = matchesSimple
      } else {
        var matchesBest = matchesStrict
      }
    }
    var score = calculateScore(matchesBest, searchLen, targetLen, successStrict, beginningIndexesLen, isSubstring, isSubstringBeginning)

    prepared._score = score

    for(var i = 0; i < searchLen; ++i) prepared._indexes[i] = matchesBest[i]
    prepared._indexes.len = searchLen

    return prepared
  }
  var calculateScore = (matches, searchLen, targetLen, successStrict, beginningIndexesLen, isSubstring, isSubstringBeginning) => {
    var score = 0
    var extraMatchGroupCount = 0
    for(var i = 1; i < searchLen; ++i) {
      if(matches[i] - matches[i-1] !== 1) { score -= matches[i]; ++extraMatchGroupCount }
    }
    var unmatchedDistance = matches[searchLen-1] - matches[0] - (searchLen-1)
    score -= (12+unmatchedDistance) * extraMatchGroupCount
    if(matches[0] !== 0) score -= matches[0]*matches[0]*.2

    if(!successStrict) score *= 1000
    else if(beginningIndexesLen > 24) score *= (beginningIndexesLen-24)*10

    var lengthPenalty = (targetLen - searchLen)/2
    score -= lengthPenalty
    var substringBonus = 1+searchLen*searchLen
    if(isSubstring) score /= substringBonus
    if(isSubstringBeginning) score /= substringBonus
    return score - lengthPenalty
  }
  var algorithmSpaces = (preparedSearch, target, allowPartialMatch) => {
    var seenIndexesLen = 0
    var seenIndexesGeneration = ++seenIndexesGenerationCounter
    var score = 0
    var result = NULL

    var first_seen_index_last_search = 0
    var searches = preparedSearch.spaceSearches
    var searchesLen = searches.length
    var changeslen = 0

    var hasAtLeast1Match = false
    for(var i=0; i<searchesLen; ++i) {
      allowPartialMatchScores[i] = NEGATIVE_INFINITY
      var search = searches[i]

      result = algorithm(search, target, false, false, changeslen !== 0, false)
      if(allowPartialMatch) {
        if(result === NULL) continue
        hasAtLeast1Match = true
      } else {
        if(result === NULL) { resetNextBeginningIndexes(target, changeslen); return NULL }
      }

      // if not the last search, we need to mutate _nextBeginningIndexes for the next search
      var isTheLastSearch = i === searchesLen - 1
      if(!isTheLastSearch) {
        var indexes = result._indexes

        var indexesIsConsecutiveSubstring = true
        for(let i=0; i<indexes.len-1; i++) {
          if(indexes[i+1] - indexes[i] !== 1) {
            indexesIsConsecutiveSubstring = false; break;
          }
        }

        if(indexesIsConsecutiveSubstring) {
          var newBeginningIndex = indexes[indexes.len-1] + 1
          var toReplace = target._nextBeginningIndexes[newBeginningIndex-1]
          for(let i=newBeginningIndex-1; i>=0; i--) {
            if(toReplace !== target._nextBeginningIndexes[i]) break
            target._nextBeginningIndexes[i] = newBeginningIndex
            nextBeginningIndexesChanges[changeslen*2 + 0] = i
            nextBeginningIndexesChanges[changeslen*2 + 1] = toReplace
            changeslen++
          }
        }
      }

      score += result._score / searchesLen
      allowPartialMatchScores[i] = result._score / searchesLen

      // dock points based on order otherwise "c man" returns Manifest.cpp instead of CheatManager.h
      if(result._indexes[0] < first_seen_index_last_search) {
        score -= (first_seen_index_last_search - result._indexes[0]) * 2
      }
      first_seen_index_last_search = result._indexes[0]

      for(var j=0; j<result._indexes.len; ++j) {
        var index = result._indexes[j]
        if(seenIndexesFlags[index] !== seenIndexesGeneration) {
          seenIndexesFlags[index] = seenIndexesGeneration
          seenIndexes[seenIndexesLen++] = index
        }
      }
    }

    if(allowPartialMatch && !hasAtLeast1Match) return NULL

    resetNextBeginningIndexes(target, changeslen)

    // allows a search with spaces that's an exact substring to score well
    var allowSpacesResult = algorithm(preparedSearch, target, /*allowSpaces=*/true)
    if(allowSpacesResult !== NULL && allowSpacesResult._score > score) {
      if(allowPartialMatch) {
        for(var i=0; i<searchesLen; ++i) {
          allowPartialMatchScores[i] = allowSpacesResult._score / searchesLen
        }
      }
      return allowSpacesResult
    }

    if(allowPartialMatch) result = target
    result._score = score

    for(var i = 0; i < seenIndexesLen; ++i) result._indexes[i] = seenIndexes[i]
    result._indexes.len = seenIndexesLen

    return result
  }
  var resetNextBeginningIndexes = (target, changeslen) => {
    for(var i=changeslen-1; i>=0; --i) target._nextBeginningIndexes[nextBeginningIndexesChanges[i*2]] = nextBeginningIndexesChanges[i*2+1]
  }

  // the extra normalize('NFC') is to fix japanese characters like ジ
  // normalize() is relatively expensive and cannot change an ASCII string.
  var remove_accents = (str) => /[^\x00-\x7F]/.test(str) ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC') : str

  var prepareLowerInfo = (str, firstBeginnings=NULL, beginningCounts=NULL, preparedRow=-1) => {
    str = remove_accents(str)
    var strLen = str.length
    var lower = str.toLowerCase()
    var lowerCodes = [] // new Array(strLen)    sparse array is too slow
    var bitflags = 0
    var containsSpace = false // space isn't stored in bitflags because of how searching with a space works
    var collectBeginnings = preparedRow >= 0
    var beginningIndexesLen = 0
    var wasUpper = false
    var wasAlphanum = false
    var beginningOffset = preparedRow * 26

    for(var i = 0; i < strLen; ++i) {
      var lowerCode = lowerCodes[i] = lower.charCodeAt(i)

      if(collectBeginnings) {
        var targetCode = str.charCodeAt(i)
        var isUpper = targetCode>=65&&targetCode<=90
        var isAlphanum = isUpper || targetCode>=97&&targetCode<=122 || targetCode>=48&&targetCode<=57
        var isBeginning = isUpper && !wasUpper || !wasAlphanum || !isAlphanum
        wasUpper = isUpper
        wasAlphanum = isAlphanum
        if(isBeginning) {
          ++beginningIndexesLen
          if(lowerCode>=97 && lowerCode<=122) {
            var beginningSlot = beginningOffset + lowerCode-97
            if(firstBeginnings[beginningSlot] === 0) firstBeginnings[beginningSlot] = i+1
          }
        }
      }

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

    if(collectBeginnings) beginningCounts[preparedRow] = beginningIndexesLen
    return {lowerCodes:lowerCodes, bitflags:bitflags, containsSpace:containsSpace, _lower:lower}
  }
  var prepareSingleMatch = (prepared, searchLowerCode, fallbackIndex) => {
    var target = remove_accents(prepared.target)
    var targetLowerCodes = prepared._targetLowerCodes
    var matchIndex = fallbackIndex
    var successStrict = false
    var beginningIndexesLen = 0
    var wasUpper = false
    var wasAlphanum = false
    for(var i = 0; i < target.length; ++i) {
      var targetCode = target.charCodeAt(i)
      var isUpper = targetCode>=65&&targetCode<=90
      var isAlphanum = isUpper || targetCode>=97&&targetCode<=122 || targetCode>=48&&targetCode<=57
      var isBeginning = isUpper && !wasUpper || !wasAlphanum || !isAlphanum
      wasUpper = isUpper
      wasAlphanum = isAlphanum
      if(isBeginning) {
        ++beginningIndexesLen
        if(!successStrict && searchLowerCode === targetLowerCodes[i]) {
          matchIndex = i
          successStrict = true
        }
      }
    }
    prepared._beginningIndexesLen = beginningIndexesLen
    prepared._singleMatchCode = searchLowerCode
    prepared._singleMatchIndex = matchIndex
    prepared._singleMatchStrict = successStrict
  }
  var prepareNextBeginningIndexes = (prepared) => {
    var target = remove_accents(prepared.target)
    var targetLen = target.length
    var nextBeginningIndexes = [] // new Array(targetLen)     sparse array is too slow
    var fillFrom = 0
    var beginningIndexesLen = 0
    var wasUpper = false
    var wasAlphanum = false
    for(var i = 0; i < targetLen; ++i) {
      var targetCode = target.charCodeAt(i)
      var isUpper = targetCode>=65&&targetCode<=90
      var isAlphanum = isUpper || targetCode>=97&&targetCode<=122 || targetCode>=48&&targetCode<=57
      var isBeginning = isUpper && !wasUpper || !wasAlphanum || !isAlphanum
      wasUpper = isUpper
      wasAlphanum = isAlphanum
      if(isBeginning) {
        ++beginningIndexesLen
        for(; fillFrom < i; ++fillFrom) nextBeginningIndexes[fillFrom] = i
      }
    }
    for(; fillFrom < targetLen; ++fillFrom) nextBeginningIndexes[fillFrom] = targetLen
    prepared._beginningIndexesLen = beginningIndexesLen
    return nextBeginningIndexes
  }

  var preparedCache       = new Map()
  var preparedSearchCache = new Map()

  // the theory behind these being globals is to reduce garbage collection by not making new arrays
  var matchesSimple = []; var matchesStrict = []
  var seenIndexes = []; var seenIndexesFlags = []; var seenIndexesGenerationCounter = 0
  var nextBeginningIndexesChanges = [] // allows straw berry to match strawberry well, by modifying the end of a substring to be considered a beginning index for the rest of the search
  var keysSpacesBestScores = []; var allowPartialMatchScores = []
  var tmpTargets = []; var tmpResults = []

  // prop = 'key'                  2.5ms optimized for this case, seems to be about as fast as direct obj[prop]
  // prop = 'key1.key2'            10ms
  // prop = ['key1', 'key2']       27ms
  // prop = obj => obj.tags.join() ??ms
  var getValue = (obj, prop) => {
    var tmp = obj[prop]; if(tmp !== undefined) return tmp
    if(typeof prop === 'function') return prop(obj) // this should run first. but that makes string props slower
    var segs = prop
    if(!Array.isArray(prop)) segs = prop.split('.')
    var len = segs.length
    var i = -1
    while (obj && (++i < len)) obj = obj[segs[i]]
    return obj
  }
  // Resolve complex key shapes once per go(), rather than coercing and
  // inspecting them for every target.
  var makeGetter = prop => {
    if(typeof prop === 'function') return prop
    if(Array.isArray(prop)) {
      return obj => {
        for(var i=0; obj && i<prop.length; ++i) obj = obj[prop[i]]
        return obj
      }
    }
    if(typeof prop === 'string' && prop.indexOf('.') !== -1) {
      var segs = prop.split('.')
      return obj => {
        var direct = obj[prop]; if(direct !== undefined) return direct
        for(var i=0; obj && i<segs.length; ++i) obj = obj[segs[i]]
        return obj
      }
    }
    return NULL
  }

  var isPrepared = (x) => { return typeof x === 'object' && typeof x._bitflags === 'number' }
  var INFINITY = Infinity; var NEGATIVE_INFINITY = -INFINITY
  var noResults = []; noResults.total = 0
  var NULL = null

  var noTarget = prepareTarget('')

  // Hacked version of https://github.com/lemire/FastPriorityQueue.js
  var fastpriorityqueue=r=>{var e=[],o=0,a={},v=r=>{for(var a=0,v=e[a],c=1;c<o;){var s=c+1;a=c,s<o&&e[s]._score<e[c]._score&&(a=s),e[a-1>>1]=e[a],c=1+(a<<1)}for(var f=a-1>>1;a>0&&v._score<e[f]._score;f=(a=f)-1>>1)e[a]=e[f];e[a]=v};return a.add=(r=>{var a=o;e[o++]=r;for(var v=a-1>>1;a>0&&r._score<e[v]._score;v=(a=v)-1>>1)e[a]=e[v];e[a]=r}),a.poll=(r=>{if(0!==o){var a=e[0];return e[0]=e[--o],v(),a}}),a.peek=(r=>{if(0!==o)return e[0]}),a.replaceTop=(r=>{e[0]=r,v()}),a}
  var q = fastpriorityqueue() // reuse this

  // fuzzysort is written this way for minification. all names are mangeled unless quoted
  return {'single':single, 'go':go, 'prepare':prepare, 'highlight':highlight, 'score':getScore, 'cleanup':cleanup}
}) // UMD
