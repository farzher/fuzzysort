/*! https://github.com/farzher/fuzzysort v4.0.0 */

export let single = (search, target) => {
  if(!search || !target) return NULL

  var preparedSearch = getPreparedSearch(search)
  if(!isPrepared(target)) target = getPrepared(target)

  var searchBitflags = preparedSearch.bitflags
  if((searchBitflags & target._bitflags) !== searchBitflags) return NULL

  var result = algorithm(preparedSearch, target)
  return result === NULL ? NULL : materialize(result)
}

export let go = (search, targets, options) => {
  if(targets instanceof PreparedTargets) return goPrepared(search, targets, options)
  if(!search) return options?.all ? all(targets, options) : noResults

  var preparedSearch = getPreparedSearch(search)
  var searchBitflags = preparedSearch.bitflags
  var containsSpace = preparedSearch.containsSpace
  var threshold = denormalizeScore(options?.threshold || 0)
  var limit = options?.limit || INFINITY
  var resultsLen = 0; var limitedCount = 0

  function push(result) {
    if(resultsLen < limit) { q.add(result); ++resultsLen }
    else {
      ++limitedCount
      if(result._score > q.peek()._score) q.replaceTop(result)
    }
  }
  function pushPrepared(prepared, obj) {
    if(resultsLen < limit) { q.add(materialize(prepared, obj)); ++resultsLen }
    else {
      ++limitedCount
      if(prepared._score > q.peek()._score) q.replaceTop(materialize(prepared, obj))
    }
  }

  var key = options?.key
  var keys = !key && options?.keys
  if(keys) {
    var keysLen = keys.length
    var getters = new Array(keysLen)
    var spacesLen = preparedSearch.spaceSearches.length
    for(var keyI=0; keyI<keysLen; ++keyI) getters[keyI] = makeGetter(keys[keyI])

    outer: for(var i=0; i<targets.length; ++i) {
      var obj = targets[i]
      var keysBitflags = 0
      for(var keyI=0; keyI<keysLen; ++keyI) {
        var getter = getters[keyI]
        var target = getter === NULL ? obj[keys[keyI]] : getter(obj)
        if(!target) { tmpTargets[keyI] = noTarget; continue }
        if(!isPrepared(target)) target = getPrepared(target)
        tmpTargets[keyI] = target
        keysBitflags |= target._bitflags
      }
      if((searchBitflags & keysBitflags) !== searchBitflags) continue

      if(containsSpace) for(var spaceI=0; spaceI<spacesLen; ++spaceI) keysSpacesBestScores[spaceI] = NEGATIVE_INFINITY

      for(var keyI=0; keyI<keysLen; ++keyI) {
        target = tmpTargets[keyI]
        if(target === noTarget) { tmpResults[keyI] = noTarget; continue }
        var result = algorithm(preparedSearch, target, false, containsSpace)
        if(result === NULL) { tmpResults[keyI] = noTarget; continue }
        tmpResults[keyI] = materialize(result)

        if(containsSpace) for(var spaceI=0; spaceI<spacesLen; ++spaceI) {
          var partialScore = allowPartialMatchScores[spaceI]
          var bestScore = keysSpacesBestScores[spaceI]
          if(partialScore > -1000 && bestScore > NEGATIVE_INFINITY) {
            var combinedScore = (bestScore + partialScore) / 4
            if(combinedScore > bestScore) bestScore = combinedScore
          }
          if(partialScore > bestScore) bestScore = partialScore
          keysSpacesBestScores[spaceI] = bestScore
        }
      }

      if(containsSpace) {
        for(var spaceI=0; spaceI<spacesLen; ++spaceI) {
          if(keysSpacesBestScores[spaceI] === NEGATIVE_INFINITY) continue outer
        }
      } else {
        var hasMatch = false
        for(var keyI=0; keyI<keysLen; ++keyI) {
          if(tmpResults[keyI]._score !== NEGATIVE_INFINITY) { hasMatch = true; break }
        }
        if(!hasMatch) continue
      }

      var objResults = new KeysResult(keysLen)
      for(var keyI=0; keyI<keysLen; ++keyI) objResults[keyI] = tmpResults[keyI]

      if(containsSpace) {
        var score = 0
        for(var spaceI=0; spaceI<spacesLen; ++spaceI) score += keysSpacesBestScores[spaceI]
      } else {
        var score = NEGATIVE_INFINITY
        for(var keyI=0; keyI<keysLen; ++keyI) {
          var result = objResults[keyI]
          if(result._score > -1000 && score > NEGATIVE_INFINITY) {
            var combinedScore = (score + result._score) / 4
            if(combinedScore > score) score = combinedScore
          }
          if(result._score > score) score = result._score
        }
      }

      objResults.obj = obj
      objResults._score = score
      if(options?.['scoreFn']) {
        score = options['scoreFn'](objResults)
        if(!score) continue
        objResults._score = score = denormalizeScore(score)
      }
      if(score >= threshold) push(objResults)
    }
  } else {
    var getter = key && makeGetter(key)
    for(var i=0; i<targets.length; ++i) {
      var obj = targets[i]
      var target = key ? getter === NULL ? obj[key] : getter(obj) : obj
      if(!target) continue
      if(!isPrepared(target)) target = getPrepared(target)
      if((searchBitflags & target._bitflags) !== searchBitflags) continue
      var result = algorithm(preparedSearch, target)
      if(result !== NULL && result._score >= threshold) pushPrepared(result, key ? obj : undefined)
    }
  }

  if(!resultsLen) return noResults
  var results = new Array(resultsLen)
  for(var i=resultsLen-1; i>=0; --i) results[i] = q.poll()
  results.total = resultsLen + limitedCount
  return results
}


export let highlight = (result, open='<b>', close='</b>') => {
  var callback = typeof open === 'function' ? open : NULL
  var rawIndexes = result['_indexes']
  var indexes = rawIndexes === undefined
    ? result.indexes
    : rawIndexes.slice(0, rawIndexes['len'] ?? rawIndexes.length).sort((a,b)=>a-b)
  var target = result.target
  if(!indexes.length) return callback ? [] : target
  var output = callback ? [] : ''
  var lastIndex = 0
  var matchI = 0

  for(var i=0; i<indexes.length;) {
    var start = indexes[i++]
    var end = start + 1
    while(indexes[i] === end) { ++i; ++end }
    var before = target.slice(lastIndex, start)
    var match = target.slice(start, end)
    if(callback) output.push(before, callback(match, matchI++))
    else output += before + open + match + close
    lastIndex = end
  }

  if(callback) output.push(target.slice(lastIndex))
  else output += target.slice(lastIndex)
  return output
}


var prepareTarget = target => {
  if(typeof target === 'number') target = ''+target
  else if(typeof target !== 'string') target = ''
  var info = prepareLowerInfo(target)
  return new_result(target, {_targetLower:info._lower, _targetLowerCodes:info.lowerCodes, _bitflags:info.bitflags})
}

var preparedEntryMarker = {}
var makePreparedKeyGetter = i => entry => entry._targets[i]

class PreparedTargets {
  constructor(targets, options) {
    var mode = this._mode = options?.keys ? 2 : options?.key ? 1 : 0
    var keys = mode === 2 ? options.keys : [options?.key]
    var keysLen = keys.length
    var firstBeginnings = mode < 2 && new Uint16Array(targets.length * 26)
    this._targets = new Array(targets.length)

    if(mode < 2) {
      this._firstBeginnings = firstBeginnings
      var key = keys[0]
      var getter = mode && makeGetter(key)
      if(mode) this._objects = targets.slice()
      for(var i=0; i<targets.length; ++i) {
        var value = mode ? getter === NULL ? targets[i][key] : getter(targets[i]) : targets[i]
        this._targets[i] = value ? indexFirstCharacters(prepareTarget(value), firstBeginnings, i) : noTarget
      }
      return
    }

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
        var value = getter === NULL ? obj[keys[keyI]] : getter(obj)
        values[keyI] = value ? prepareTarget(value) : noTarget
      }
      this._targets[i] = {_prepared:preparedEntryMarker, _obj:obj, _targets:values}
    }
  }
}

export let prepare = (targets, options) => new PreparedTargets(targets, options)

var preparedSingleResult = (search, target, firstBeginnings, row) => {
  var matchIndex = target._targetLower.indexOf(search._lower)
  if(matchIndex === -1) return NULL
  var beginning = firstBeginnings[row * 26 + search.lowerCodes[0] - 97]
  var successStrict = beginning !== 0
  if(successStrict) matchIndex = beginning - 1
  var score = matchIndex === 0 ? 0 : -matchIndex * matchIndex * .2
  if(!successStrict) score *= 1000
  else if(target._beginningIndexesLen > 24) score *= (target._beginningIndexesLen - 24) * 10
  target._score = score - target._targetLowerCodes.length + 1
  target._indexes[0] = matchIndex
  target._indexes.len = 1
  return target
}

var goPreparedValues = (search, prepared, options, single) => {
  var targets = prepared._targets
  var objects = prepared._objects
  var firstBeginnings = prepared._firstBeginnings
  if(!search) {
    if(!options?.all) return noResults
    var results = []; results.total = targets.length
    var limit = options?.limit || INFINITY
    for(var i=0; i<targets.length && i<limit; ++i) {
      results.push(new_result(targets[i].target, {_score:targets[i]._score, obj:objects[i]}))
    }
    return results
  }

  if(!single) search = getPreparedSearch(search)
  var searchBitflags = search.bitflags
  var threshold = denormalizeScore(options?.threshold || 0)
  var limit = options?.limit || INFINITY
  var resultsLen = 0; var limitedCount = 0

  for(var i=0; i<targets.length; ++i) {
    var target = targets[i]
    if(target === noTarget || (searchBitflags & target._bitflags) !== searchBitflags) continue
    var result = single && target.target.length < 65535
      ? preparedSingleResult(search, target, firstBeginnings, i)
      : algorithm(search, target)
    if(result === NULL || result._score < threshold) continue
    if(objects) result = materialize(result, objects[i])
    if(resultsLen < limit) { q.add(result); ++resultsLen }
    else {
      ++limitedCount
      if(result._score > q.peek()._score) q.replaceTop(result)
    }
  }

  if(!resultsLen) return noResults
  var results = new Array(resultsLen)
  for(var i=resultsLen-1; i>=0; --i) {
    var result = q.poll()
    results[i] = objects ? result : materialize(result)
  }
  results.total = resultsLen + limitedCount
  return results
}

var goPrepared = (search, prepared, options) => {
  if(options?.key || options?.keys) throw new Error('fuzzysort: key/keys must be provided to prepare(), not go()')
  if(prepared._mode < 2) {
    if(prepared._mode === 0 && (!search || !options?.limit)) return go(search, prepared._targets, options)
    var preparedSearch = search && getPreparedSearch(search)
    var code = preparedSearch?.lowerCodes?.[0]
    var single = preparedSearch?.lowerCodes?.length === 1 && code >= 97 && code <= 122
    return goPreparedValues(single ? preparedSearch : search, prepared, options, single)
  }

  var preparedOptions = Object.assign({}, options, {keys:prepared._keys})
  if(options?.['scoreFn']) {
    var scoreFn = options['scoreFn']
    preparedOptions['scoreFn'] = result => {
      result.obj = result.obj._obj
      return scoreFn(result)
    }
  }
  var results = go(search, prepared._targets, preparedOptions)
  for(var i=0; i<results.length; ++i) {
    if(results[i].obj?._prepared === preparedEntryMarker) results[i].obj = results[i].obj._obj
  }
  return results
}

export let cleanup = () => { preparedCache.clear(); preparedSearchCache.clear() }

// Result accessors and methods live on the prototype, which structuredClone
// does not preserve. These helpers also work on results sent from a Worker.
export let score = result => {
  var score = result['score']
  return score === undefined ? normalizeScore(result['_score']) : score
}


// Below this point is internal code.


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
  var result = new Result()
  result['target']             = target
  result['obj']                = options.obj               ?? NULL
  result._score                = options._score            ?? NEGATIVE_INFINITY
  result._indexes              = []
  result._targetLower          = options._targetLower      ?? ''
  result._targetLowerCodes     = options._targetLowerCodes ?? NULL
  result._nextBeginningIndexes = NULL
  result._beginningIndexesLen  = 0
  result._singleMatchCode      = -1
  result._singleMatchIndex     = -1
  result._singleMatchStrict    = false
  result._bitflags             = options._bitflags         ?? 0
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


var prepareSearch = search => {
  if(typeof search === 'number') search = ''+search
  else if(typeof search !== 'string') search = ''
  search = search.trim()
  var info = prepareLowerInfo(search)
  var spaceSearches = info.containsSpace
    ? [...new Set(search.split(/\s+/))].map(prepareSearch)
    : []
  return {
    lowerCodes:info.lowerCodes,
    _lower:info._lower,
    containsSpace:info.containsSpace,
    bitflags:info.bitflags,
    spaceSearches,
  }
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
  var results = []; results.total = targets.length
  var limit = options?.limit || INFINITY
  var key = options?.key
  var keys = !key && options?.keys

  if(keys) {
    var keysLen = keys.length
    var getters = new Array(keysLen)
    for(var keyI=0; keyI<keysLen; ++keyI) getters[keyI] = makeGetter(keys[keyI])
    for(var i=0; i<targets.length; ++i) {
      var obj = targets[i]
      var objResults = new KeysResult(keysLen)
      for(var keyI=keysLen-1; keyI>=0; --keyI) {
        var getter = getters[keyI]
        var target = getter === NULL ? obj[keys[keyI]] : getter(obj)
        if(!target) { objResults[keyI] = noTarget; continue }
        if(!isPrepared(target)) target = getPrepared(target)
        target._score = NEGATIVE_INFINITY
        target._indexes.len = 0
        objResults[keyI] = target
      }
      objResults.obj = obj
      objResults._score = NEGATIVE_INFINITY
      results.push(objResults)
      if(results.length >= limit) return results
    }
    return results
  }

  var getter = key && makeGetter(key)
  for(var i=0; i<targets.length; ++i) {
    var obj = targets[i]
    var target = key ? getter === NULL ? obj[key] : getter(obj) : obj
    if(target == NULL) continue
    if(!isPrepared(target)) target = getPrepared(target)
    if(key) target = new_result(target.target, {_score:target._score, obj:obj})
    else {
      target._score = NEGATIVE_INFINITY
      target._indexes.len = 0
    }
    results.push(target)
    if(results.length >= limit) return results
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

  // Cache the best word-beginning match for repeated single-character searches.
  if(searchLen === 1 && !nextBeginningIndexesChanged && allowSingleCharacter) {
    if(prepared._singleMatchCode === searchLowerCode) {
      var matchIndex = prepared._singleMatchIndex
      var successStrict = prepared._singleMatchStrict
    } else if(prepared._nextBeginningIndexes != NULL) {
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
  if(nextBeginningIndexes == NULL) nextBeginningIndexes = prepared._nextBeginningIndexes = prepareNextBeginningIndexes(prepared)
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
      for(var j=0; j<indexes.len-1; ++j) {
        if(indexes[j+1] - indexes[j] !== 1) {
          indexesIsConsecutiveSubstring = false; break;
        }
      }

      if(indexesIsConsecutiveSubstring) {
        var newBeginningIndex = indexes[indexes.len-1] + 1
        var toReplace = target._nextBeginningIndexes[newBeginningIndex-1]
        for(var j=newBeginningIndex-1; j>=0; --j) {
          if(toReplace !== target._nextBeginningIndexes[j]) break
          target._nextBeginningIndexes[j] = newBeginningIndex
          nextBeginningIndexesChanges[changeslen*2 + 0] = j
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

var characterFolds = {}
var foldFrom = "\\\"`‘’“”‐–—−⁄∕…øØæÆœŒßẞłŁ"
var foldTo = "/''''''----//.oOaAoOsSlL"
for(var i=0; i<foldFrom.length; ++i) characterFolds[foldFrom[i]] = foldTo[i]

var customAsciiFolds = false
export let remap = mappings => {
  for(var char in mappings) {
    characterFolds[char] = mappings[char]
    if(char.charCodeAt(0) < 128) customAsciiFolds = true
  }
}

var foldCharacter = char => {
  var folded = characterFolds[char]
  if(folded !== undefined) return folded
  if(char.charCodeAt(0) < 128) return char
  folded = char.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  return folded.length === 1 ? folded : char
}

var normalizeCharacters = str => {
  if(customAsciiFolds) return str.replace(/[\s\S]/g, foldCharacter)
  return /[^\x00-\x7F]|[\\"`]/.test(str)
    ? str.replace(/[^\x00-\x7F]|[\\"`]/g, foldCharacter)
    : str
}

var indexFirstCharacters = (prepared, firstBeginnings, row) => {
  if(prepared.target.length >= 65535) return prepared
  var target = normalizeCharacters(prepared.target)
  var lowerCodes = prepared._targetLowerCodes
  var offset = row * 26
  var beginnings = 0
  var wasUpper = false
  var wasAlphanum = false
  for(var i=0; i<target.length; ++i) {
    var code = target.charCodeAt(i)
    var isUpper = code>=65&&code<=90
    var isAlphanum = isUpper || code>=97&&code<=122 || code>=48&&code<=57
    var isBeginning = isUpper&&!wasUpper || !wasAlphanum || !isAlphanum
    wasUpper = isUpper
    wasAlphanum = isAlphanum
    if(isBeginning) {
      ++beginnings
      var lowerCode = lowerCodes[i]
      if(lowerCode>=97&&lowerCode<=122) {
        var slot = offset + lowerCode-97
        if(firstBeginnings[slot] === 0) firstBeginnings[slot] = i+1
      }
    }
  }
  prepared._beginningIndexesLen = beginnings
  return prepared
}

var prepareLowerInfo = str => {
  str = normalizeCharacters(str)
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

  return {lowerCodes:lowerCodes, bitflags:bitflags, containsSpace:containsSpace, _lower:lower}
}
var prepareSingleMatch = (prepared, searchLowerCode, fallbackIndex) => {
  var target = normalizeCharacters(prepared.target)
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
  var target = normalizeCharacters(prepared.target)
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

// Resolve complex key shapes once per go(), rather than coercing and
// inspecting them for every target.
var makeGetter = prop => {
  if(typeof prop === 'function') return prop
  var path = Array.isArray(prop)
    ? prop
    : typeof prop === 'string' && prop.includes('.') ? prop.split('.') : NULL
  if(path === NULL) return NULL
  return obj => {
    if(path !== prop) {
      var direct = obj[prop]
      if(direct !== undefined) return direct
    }
    for(var i=0; obj && i<path.length; ++i) obj = obj[path[i]]
    return obj
  }
}

var isPrepared = (x) => { return typeof x === 'object' && typeof x._bitflags === 'number' }
var INFINITY = Infinity; var NEGATIVE_INFINITY = -INFINITY
var noResults = []; noResults.total = 0
var NULL = null

var noTarget = prepareTarget('')

// Hacked version of https://github.com/lemire/FastPriorityQueue.js
var fastpriorityqueue=r=>{var e=[],o=0,a={},v=r=>{for(var a=0,v=e[a],c=1;c<o;){var s=c+1;a=c,s<o&&e[s]._score<e[c]._score&&(a=s),e[a-1>>1]=e[a],c=1+(a<<1)}for(var f=a-1>>1;a>0&&v._score<e[f]._score;f=(a=f)-1>>1)e[a]=e[f];e[a]=v};return a.add=(r=>{var a=o;e[o++]=r;for(var v=a-1>>1;a>0&&r._score<e[v]._score;v=(a=v)-1>>1)e[a]=e[v];e[a]=r}),a.poll=(r=>{if(0!==o){var a=e[0];return e[0]=e[--o],v(),a}}),a.peek=(r=>{if(0!==o)return e[0]}),a.replaceTop=(r=>{e[0]=r,v()}),a}
var q = fastpriorityqueue() // reuse this

export default {single, go, prepare, highlight, score, remap, cleanup}
