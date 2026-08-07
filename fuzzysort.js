/*! https://github.com/farzher/fuzzysort v4.0.0 */

export function single(search, target) {
  if(!search || !target) return null
  let query = getQuery(search)
  if(!isPrepared(target)) target = getPrepared(target)
  if((query.bitflags & target._bitflags) !== query.bitflags) return null
  let result = algorithm(query, target)
  return result && materialize(result)
}

export function go(search, targets, options) {
  if(targets instanceof SnapshotTargets) return goPrepared(search, targets, options)
  if(!search) return options?.all ? all(targets, options) : noResults

  let query = getQuery(search)
  let key = options?.key
  let keys = !key && options?.keys
  if(keys) return goKeys(query, targets, options)

  let searchBitflags = query.bitflags
  let threshold = denormalizeScore(options?.threshold || 0)
  let limit = options?.limit || INF
  let scoreFn = options?.scoreFn
  let resultCount = 0
  let limited = 0
  let getter = key && makeGetter(key)

  for(let i = 0; i < targets.length; i++) {
    let obj = targets[i]
    let target = key ? getter === null ? obj[key] : getter(obj) : obj
    if(!target) continue
    if(!isPrepared(target)) target = getPrepared(target)
    if((searchBitflags & target._bitflags) !== searchBitflags) continue
    let result = algorithm(query, target)
    if(result === null) continue
    let resultScore = result._score
    if(scoreFn) {
      result = materialize(result, key ? obj : undefined)
      resultScore = scoreFn(result)
      if(!resultScore) continue
      result._score = resultScore = denormalizeScore(resultScore)
    }
    if(resultScore < threshold) continue

    let room = resultCount < limit
    if(room) resultCount++
    else {
      limited++
      if(resultScore <= heap.peek()._score) continue
    }
    if(!scoreFn) result = materialize(result, key ? obj : undefined)
    room ? heap.add(result) : heap.replaceTop(result)
  }
  return finishResults(resultCount, limited)
}

export function highlight(result, open = '<b>', close = '</b>') {
  let callback = typeof open === 'function' ? open : null
  let raw = result._indexes
  let indexes = raw === undefined
    ? result.indexes
    : raw.slice(0, raw.len ?? raw.length).sort((a, b) => a - b)
  let target = result.target
  if(!indexes.length) return callback ? [] : target

  let output = callback ? [] : ''
  let lastIndex = 0
  let matchI = 0

  for(let i = 0; i < indexes.length;) {
    let start = indexes[i++]
    let end = start + 1
    while(indexes[i] === end) {
      i++
      end++
    }
    let before = target.slice(lastIndex, start)
    let match = target.slice(start, end)
    if(callback) output.push(before, callback(match, matchI++))
    else output += before + open + match + close
    lastIndex = end
  }
  if(callback) output.push(target.slice(lastIndex))
  else output += target.slice(lastIndex)
  return output
}

export function score(result) {
  let value = result.score
  return value === undefined ? normalizeScore(result._score) : value
}

export function remap(mappings) {
  for(let char in mappings) {
    remappings[char] = mappings[char]
    if(char.charCodeAt(0) < 128) customAsciiRemappings = true
  }
  cleanup()
}

export function prepare(target) { return prepTarget(target) }

export function snapshot(targets, options) { return new SnapshotTargets(targets, options) }

export function cleanup() { targetCache.clear(); searchCache.clear() }


function goPreparedValues(search, prepared, options, singleChar) {
  let targets = prepared._targets
  let objects = prepared._objects
  let threshold = denormalizeScore(options?.threshold || 0)
  let limit = options?.limit || INF
  let scoreFn = options?.scoreFn
  let searchLen = search.lowerCodes.length
  let shortSearch = !search.hasSpace && searchLen <= 3
  let resultCount = 0
  let limited = 0

  for(let i = 0; i < targets.length; i++) {
    let target = targets[i]
    if(target === noTarget || (search.bitflags & target._bitflags) !== search.bitflags) continue
    let targetShort = shortSearch && target.target.length < 65535
    let result
    if(singleChar && targetShort) result = algorithm1(search, target, prepared._first, i)
    else if(targetShort) {
      let start = prepared._offsets[i]
      let end = prepared._offsets[i + 1]
      result = searchLen === 2
        ? algorithm2(search, target, prepared._beginnings, start, end)
        : algorithm(search, target, false, false, false, true, prepared._beginnings, start, end)
    } else result = algorithm(search, target)
    if(result === null) continue
    let resultScore = result._score
    if(scoreFn) {
      result = materialize(result, objects?.[i])
      resultScore = scoreFn(result)
      if(!resultScore) continue
      result._score = resultScore = denormalizeScore(resultScore)
    }
    if(resultScore < threshold) continue

    let room = resultCount < limit
    if(room) resultCount++
    else {
      limited++
      if(resultScore <= heap.peek()._score) continue
    }
    if(objects && !scoreFn) result = materialize(result, objects[i])
    room ? heap.add(result) : heap.replaceTop(result)
  }
  return finishResults(resultCount, limited, !objects && !scoreFn && materialize)
}

function goPrepared(search, prepared, options) {
  if(options?.key || options?.keys) throw new Error('fuzzysort: key/keys must be provided to snapshot(), not go()')
  prepared._finish()

  if(!search) {
    if(!options?.all) return noResults
    return prepared._mode === 0 ? all(prepared._targets, options) : allPrepared(prepared, options)
  }

  let query = getQuery(search)
  if(prepared._mode < 2) {
    let searchLen = query.lowerCodes.length
    if(prepared._mode === 0 && !options?.limit && searchLen > 3) return go(search, prepared._targets, options)
    let code = query.lowerCodes[0]
    let singleChar = searchLen === 1 && code >= 97 && code <= 122
    return goPreparedValues(query, prepared, options, singleChar)
  }

  return goKeys(query, prepared._objects, options, prepared)
}

function goKeys(query, objects, options, prepared) {
  let indexed = prepared !== undefined
  let keys = indexed ? null : options.keys
  let getters = indexed ? null : keys.map(makeGetter)
  let targets = indexed ? prepared._targets : null
  let keysLength = indexed ? prepared._keysLength : keys.length
  let searchBitflags = query.bitflags
  let hasSpace = query.hasSpace
  let spaceCount = query.parts.length
  let threshold = denormalizeScore(options?.threshold || 0)
  let limit = options?.limit || INF
  let searchLen = query.lowerCodes.length
  let short = indexed && !hasSpace && searchLen <= 3
  let code = query.lowerCodes[0]
  let singleChar = short && searchLen === 1 && code >= 97 && code <= 122
  let scoreFn = options?.scoreFn
  let deferMaterialization = indexed && !scoreFn && (limit !== INF || threshold > -INF)
  let resultCount = 0
  let limited = 0

  outer: for(let i = 0; i < objects.length; i++) {
    let row = i * keysLength
    if(indexed) {
      if((searchBitflags & prepared._bitflags[i]) !== searchBitflags) continue
    } else {
      let obj = objects[i]
      let keysBitflags = 0
      for(let k = 0; k < keysLength; k++) {
        let target = getters[k] === null ? obj[keys[k]] : getters[k](obj)
        if(!target) target = noTarget
        else if(!isPrepared(target)) target = getPrepared(target)
        keyTargets[k] = target
        keysBitflags |= target._bitflags
      }
      if((searchBitflags & keysBitflags) !== searchBitflags) continue
    }
    if(hasSpace) for(let s = 0; s < spaceCount; s++) spaceScores[s] = -INF

    for(let k = 0; k < keysLength; k++) {
      let target = indexed ? targets[row + k] : keyTargets[k]
      if(target === noTarget) {
        keyResults[k] = noTarget
        continue
      }
      if(hasSpace && indexed) {
        let possible = false
        for(let s = 0; s < spaceCount; s++) {
          let partBitflags = query.parts[s].bitflags
          if((partBitflags & target._bitflags) === partBitflags) {
            possible = true
            break
          }
        }
        if(!possible) {
          keyResults[k] = noTarget
          continue
        }
      } else if(!hasSpace && (searchBitflags & target._bitflags) !== searchBitflags) {
        keyResults[k] = noTarget
        continue
      }

      let match
      if(indexed) {
        let valueRow = row + k
        let targetShort = short && target.target.length < 65535
        if(singleChar && targetShort) match = algorithm1(query, target, prepared._first, valueRow)
        else if(targetShort) {
          let start = prepared._offsets[valueRow]
          let end = prepared._offsets[valueRow + 1]
          match = searchLen === 2
            ? algorithm2(query, target, prepared._beginnings, start, end)
            : algorithm(query, target, false, false, false, true, prepared._beginnings, start, end)
        } else match = algorithm(query, target, false, hasSpace)
      } else match = algorithm(query, target, false, hasSpace)

      if(match === null) {
        keyResults[k] = noTarget
        continue
      }
      keyResults[k] = deferMaterialization ? match : materialize(match)
      if(hasSpace) mergePartScores(spaceCount)
    }

    let resultScore
    if(hasSpace) {
      resultScore = 0
      for(let s = 0; s < spaceCount; s++) {
        let partScore = spaceScores[s]
        if(partScore === -INF) continue outer
        resultScore += partScore
      }
    } else {
      resultScore = mergeScores(keyResults, keysLength)
      if(resultScore === -INF) continue
    }

    let result = deferMaterialization ? null : captureKeysResult(keyResults, keysLength, objects[i], resultScore)
    if(scoreFn) {
      resultScore = scoreFn(result)
      if(!resultScore) continue
      result._score = resultScore = denormalizeScore(resultScore)
    }
    if(resultScore < threshold) continue

    let room = resultCount < limit
    if(room) resultCount++
    else {
      limited++
      if(resultScore <= heap.peek()._score) continue
    }
    if(result === null) result = captureKeysResult(keyResults, keysLength, objects[i], resultScore)
    room ? heap.add(result) : heap.replaceTop(result)
  }
  return finishResults(resultCount, limited, deferMaterialization && materializeKeys)
}

function allPrepared(prepared, options) {
  let results = []
  let targets = prepared._targets
  let objects = prepared._objects
  let keysLength = prepared._keysLength
  let total = keysLength === undefined ? targets.length : objects.length
  results.total = total

  for(let i = 0, length = Math.min(total, options?.limit || INF); i < length; i++) {
    if(keysLength === undefined) {
      results.push(newResult(targets[i].target, targets[i]._score, objects?.[i]))
      continue
    }
    let row = i * keysLength
    for(let k = 0; k < keysLength; k++) {
      let target = targets[row + k]
      keyResults[k] = target === noTarget ? noTarget : newResult(target.target, -INF)
    }
    results.push(captureKeysResult(keyResults, keysLength, objects[i], -INF))
  }
  return results
}

function all(targets, options) {
  let results = []
  results.total = targets.length
  let limit = options?.limit || INF
  let key = options?.key
  let keys = !key && options?.keys

  if(keys) {
    let getters = keys.map(makeGetter)
    for(let obj of targets) {
      for(let k = keys.length - 1; k >= 0; k--) {
        let target = getters[k] === null ? obj[keys[k]] : getters[k](obj)
        if(!target) keyResults[k] = noTarget
        else {
          if(!isPrepared(target)) target = getPrepared(target)
          target._score = -INF
          target._indexes.len = 0
          keyResults[k] = target
        }
      }
      results.push(captureKeysResult(keyResults, keys.length, obj, -INF))
      if(results.length >= limit) break
    }
    return results
  }

  let getter = key && makeGetter(key)
  for(let obj of targets) {
    let target = key ? getter === null ? obj[key] : getter(obj) : obj
    if(target == null) continue
    if(!isPrepared(target)) target = getPrepared(target)
    if(key) target = newResult(target.target, target._score, obj)
    else {
      target._score = -INF
      target._indexes.len = 0
    }
    results.push(target)
    if(results.length >= limit) break
  }
  return results
}

function finishResults(length, limited, transform) {
  if(!length) return noResults
  let results = new Array(length)
  for(let i = length - 1; i >= 0; i--) {
    let result = heap.poll()
    results[i] = transform ? transform(result) : result
  }
  results.total = length + limited
  return results
}

function materializeKeys(result) {
  for(let k = 0; k < result.length; k++) if(result[k] !== noTarget) result[k] = materialize(result[k])
  return result
}


function algorithm1(search, target, firstTable, row) {
  let matchI = target._targetLower.indexOf(search._lower)
  if(matchI === -1) return null
  let beginning = firstTable[row * 26 + search.lowerCodes[0] - 97]
  let strict = beginning !== 0
  if(strict) matchI = beginning - 1
  let score = matchI === 0 ? 0 : -matchI * matchI * .2
  if(!strict) score *= 1000
  else if(target._beginningsLen > 24) score *= (target._beginningsLen - 24) * 10
  target._score = score - target._targetLowerCodes.length + 1
  target._indexes[0] = matchI
  target._indexes.len = 1
  return target
}

function algorithm2(search, target, beginnings, start, end) {
  let targetCodes = target._targetLowerCodes
  let targetLen = targetCodes.length
  let firstCode = search.lowerCodes[0]
  let secondCode = search.lowerCodes[1]

  let first = 0
  while(targetCodes[first] !== firstCode) if(++first >= targetLen) return null
  let second = first + 1
  while(targetCodes[second] !== secondCode) if(++second >= targetLen) return null

  let substringI = target._targetLower.indexOf(search._lower, first)
  let substring = substringI !== -1
  let low = lowerBound(beginnings, start, end, substringI)
  let substringStart = substring && low < end && beginnings[low] === substringI
  let strict = substringStart && substringI === first

  if(!strict) {
    let firstBeginning = start
    while(firstBeginning < end && beginnings[firstBeginning] < first) firstBeginning++

    for(let backtracks = 0; firstBeginning < end;) {
      let strictFirst = beginnings[firstBeginning]
      if(targetCodes[strictFirst] !== firstCode) {
        firstBeginning++
        continue
      }

      let consecutive = strictFirst + 1
      if(targetCodes[consecutive] === secondCode) {
        first = strictFirst
        second = consecutive
        strict = true
        break
      }

      let secondBeginning = firstBeginning + 1
      while(secondBeginning < end && beginnings[secondBeginning] <= consecutive) secondBeginning++
      while(secondBeginning < end && targetCodes[beginnings[secondBeginning]] !== secondCode) secondBeginning++
      if(secondBeginning < end) {
        first = strictFirst
        second = beginnings[secondBeginning]
        strict = true
        break
      }

      if(++backtracks > 200) break
      firstBeginning++
    }
  }

  if(substring && !substringStart) {
    while(low < end && beginnings[low] <= substringI) low++
    for(; low < end; low++) {
      let index = beginnings[low]
      if(targetCodes[index] === firstCode && targetCodes[index + 1] === secondCode) {
        substringI = index
        substringStart = true
        break
      }
    }
  }

  if(substring && (!strict || substringStart)) {
    first = substringI
    second = substringI + 1
  }

  let resultScore = second - first === 1 ? 0 : first - second * 2 - 11
  if(first) resultScore -= first * first * .2
  if(!strict) resultScore *= 1000
  else if(end - start > 24) resultScore *= (end - start - 24) * 10

  let lengthPenalty = (targetLen - 2) / 2
  resultScore -= lengthPenalty
  if(substring) resultScore /= 5
  if(substringStart) resultScore /= 5
  target._score = resultScore - lengthPenalty
  target._indexes[0] = first
  target._indexes[1] = second
  target._indexes.len = 2
  return target
}

function algorithm(search, target, spaces = false, partial = false, changed = false, singleMatch = true, beginnings = null, start = 0, end = 0) {
  if(!spaces && search.hasSpace) return algorithmSpaces(search, target, partial)

  let searchCodes = search.lowerCodes
  let targetCodes = target._targetLowerCodes
  let searchLen = searchCodes.length
  let targetLen = targetCodes.length
  let searchCode = searchCodes[0]
  let searchI = 0
  let targetI = 0
  let simpleLen = 0

  for(;;) {
    if(searchCode === targetCodes[targetI]) {
      simpleMatch[simpleLen++] = targetI
      if(++searchI === searchLen) break
      searchCode = searchCodes[searchI]
    }
    if(++targetI >= targetLen) return null
  }

  if(searchLen === 1 && !changed && singleMatch) {
    let matchI
    let strict
    if(target._singleMatchCode === searchCode) {
      matchI = target._singleMatchIndex
      strict = target._singleMatchStrict
    } else if(target._nextBeginningIndexes !== null) {
      let next = target._nextBeginningIndexes
      targetI = simpleMatch[0] === 0 ? 0 : next[simpleMatch[0] - 1]
      while(targetI < targetLen && searchCode !== targetCodes[targetI]) targetI = next[targetI]
      strict = targetI < targetLen
      matchI = strict ? targetI : simpleMatch[0]
    } else {
      prepareSingleMatch(target, searchCode, simpleMatch[0])
      matchI = target._singleMatchIndex
      strict = target._singleMatchStrict
    }

    let resultScore = matchI === 0 ? 0 : -matchI * matchI * .2
    if(!strict) resultScore *= 1000
    else if(target._beginningsLen > 24) resultScore *= (target._beginningsLen - 24) * 10
    target._score = resultScore - (targetLen - 1)
    target._indexes[0] = matchI
    target._indexes.len = 1
    return target
  }

  searchI = 0
  let strict = false
  let strictLen = 0
  let next = target._nextBeginningIndexes
  if(beginnings === null && next === null) next = target._nextBeginningIndexes = makeNextBeginnings(target)
  let beginningLen = beginnings === null ? (changed ? 0 : target._beginningsLen) : end - start
  if(!beginningLen) {
    beginningLen = 1
    for(let i = next[0]; i < targetLen; i = next[i]) beginningLen++
    if(!changed) target._beginningsLen = beginningLen
  }

  let substringI = searchLen <= 1 ? -1 : target._targetLower.indexOf(search._lower, simpleMatch[0])
  let isSubstring = substringI !== -1
  let substringStart = isSubstring && (substringI === 0 || (beginnings
    ? isBeginning(beginnings, start, end, substringI)
    : next[substringI - 1] === substringI))

  if(substringStart && substringI === simpleMatch[0]) strict = true
  else {
    targetI = simpleMatch[0] === 0 ? 0 : beginnings
      ? nextBeginning(beginnings, start, end, simpleMatch[0] - 1, targetLen)
      : next[simpleMatch[0] - 1]
    let backtracks = 0
    if(targetI !== targetLen) for(;;) {
      if(targetI >= targetLen) {
        if(searchI <= 0 || ++backtracks > 200) break
        searchI--
        let previous = strictMatch[--strictLen]
        targetI = beginnings
          ? nextBeginning(beginnings, start, end, previous, targetLen)
          : next[previous]
      } else if(searchCodes[searchI] === targetCodes[targetI]) {
        strictMatch[strictLen++] = targetI
        if(++searchI === searchLen) {
          strict = true
          break
        }
        targetI++
      } else targetI = beginnings
        ? nextBeginning(beginnings, start, end, targetI, targetLen)
        : next[targetI]
    }
  }

  if(isSubstring && !substringStart) {
    if(beginnings) {
      for(let b = start; b < end; b++) {
        let i = beginnings[b]
        if(i <= substringI) continue
        let s = 0
        for(; s < searchLen && searchCodes[s] === targetCodes[i + s]; s++);
        if(s === searchLen) {
          substringI = i
          substringStart = true
          break
        }
      }
    } else for(let i = 0; i < next.length; i = next[i]) {
      if(i <= substringI) continue
      let s = 0
      for(; s < searchLen && searchCodes[s] === targetCodes[i + s]; s++);
      if(s === searchLen) {
        substringI = i
        substringStart = true
        break
      }
    }
  }

  let matches
  if(!strict) {
    if(isSubstring) for(let i = 0; i < searchLen; i++) simpleMatch[i] = substringI + i
    matches = simpleMatch
  } else if(substringStart) {
    for(let i = 0; i < searchLen; i++) simpleMatch[i] = substringI + i
    matches = simpleMatch
  } else matches = strictMatch

  target._score = calculateScore(matches, searchLen, targetLen, strict, beginningLen, isSubstring, substringStart)
  for(let i = 0; i < searchLen; i++) target._indexes[i] = matches[i]
  target._indexes.len = searchLen
  return target
}

function mergePartScores(length) {
  for(let i = 0; i < length; i++) {
    let partial = partials[i]
    let best = spaceScores[i]
    if(partial > -1000 && best > -INF) best = Math.max(best, (best + partial) / 4)
    spaceScores[i] = Math.max(best, partial)
  }
}

function mergeScores(results, length) {
  let total = -INF
  for(let i = 0; i < length; i++) {
    let score = results[i]._score
    if(score > -1000 && total > -INF) total = Math.max(total, (total + score) / 4)
    if(score > total) total = score
  }
  return total
}

function calculateScore(matches, searchLen, targetLen, strict, beginningLen, substring, substringStart) {
  let score = 0
  let groups = 0
  for(let i = 1; i < searchLen; i++) if(matches[i] - matches[i - 1] !== 1) {
    score -= matches[i]
    groups++
  }
  let unmatchedDistance = matches[searchLen - 1] - matches[0] - (searchLen - 1)
  score -= (12 + unmatchedDistance) * groups
  if(matches[0] !== 0) score -= matches[0] * matches[0] * .2
  if(!strict) score *= 1000
  else if(beginningLen > 24) score *= (beginningLen - 24) * 10

  let lengthPenalty = (targetLen - searchLen) / 2
  score -= lengthPenalty
  let substringBonus = 1 + searchLen * searchLen
  if(substring) score /= substringBonus
  if(substringStart) score /= substringBonus
  return score - lengthPenalty
}

function algorithmSpaces(search, target, partial) {
  let seenLen = 0
  let generation = ++seenGeneration
  let score = 0
  let result = null
  let previousFirst = 0
  let searches = search.parts
  let changesLen = 0
  let matched = false

  for(let i = 0; i < searches.length; i++) {
    partials[i] = -INF
    result = algorithm(searches[i], target, false, false, changesLen !== 0, false)
    if(result === null) {
      if(partial) continue
      resetBeginnings(target, changesLen)
      return null
    }
    matched = true

    if(i < searches.length - 1) {
      let indexes = result._indexes
      let consecutive = true
      for(let j = 0; j < indexes.len - 1; j++) if(indexes[j + 1] - indexes[j] !== 1) {
        consecutive = false
        break
      }
      if(consecutive) {
        let beginning = indexes[indexes.len - 1] + 1
        let previous = target._nextBeginningIndexes[beginning - 1]
        for(let j = beginning - 1; j >= 0 && target._nextBeginningIndexes[j] === previous; j--) {
          target._nextBeginningIndexes[j] = beginning
          changes[changesLen * 2] = j
          changes[changesLen * 2 + 1] = previous
          changesLen++
        }
      }
    }

    let partScore = result._score / searches.length
    score += partScore
    partials[i] = partScore
    if(result._indexes[0] < previousFirst) score -= (previousFirst - result._indexes[0]) * 2
    previousFirst = result._indexes[0]

    for(let j = 0; j < result._indexes.len; j++) {
      let index = result._indexes[j]
      if(seenAt[index] === generation) continue
      seenAt[index] = generation
      seen[seenLen++] = index
    }
  }

  if(partial && !matched) return null
  resetBeginnings(target, changesLen)

  let spacedResult = algorithm(search, target, true)
  if(spacedResult !== null && spacedResult._score > score) {
    if(partial) for(let i = 0; i < searches.length; i++) partials[i] = spacedResult._score / searches.length
    return spacedResult
  }

  if(partial) result = target
  result._score = score
  for(let i = 0; i < seenLen; i++) result._indexes[i] = seen[i]
  result._indexes.len = seenLen
  return result
}

function resetBeginnings(target, changesLen) {
  for(let i = changesLen - 1; i >= 0; i--) {
    target._nextBeginningIndexes[changes[i * 2]] = changes[i * 2 + 1]
  }
}


class SnapshotTargets {
  constructor(targets, options) {
    this._mode = options?.keys ? 2 : options?.key ? 1 : 0
    this._keys = this._mode === 2 ? options.keys.slice() : [options?.key]
    this._input = targets.slice()
    this._index = 0
    this._done = false
    this._error = null
    this._initialized = false
    this._scheduled = null

    if(targets.length === 0) this._finish()
    else this._schedule()
  }

  _schedule() {
    let run = deadline => {
      this._scheduled = null
      this._run(deadline)
    }
    if(typeof requestIdleCallback === 'function') {
      this._scheduler = 1
      this._scheduled = requestIdleCallback(run, {timeout:100})
    } else if(typeof setImmediate === 'function') {
      this._scheduler = 2
      this._scheduled = setImmediate(run)
    } else {
      this._scheduler = 3
      this._scheduled = setTimeout(run)
    }
  }

  _cancel() {
    if(this._scheduled === null) return
    if(this._scheduler === 1) {
      if(typeof cancelIdleCallback === 'function') cancelIdleCallback(this._scheduled)
    } else if(this._scheduler === 2) {
      if(typeof clearImmediate === 'function') clearImmediate(this._scheduled)
    } else clearTimeout(this._scheduled)
    this._scheduled = null
  }

  _initialize() {
    if(this._initialized) return
    this._initialized = true
    let keysLength = this._mode === 2 ? this._keys.length : 1
    let valueCount = this._input.length * keysLength
    this._targets = new Array(valueCount)
    this._first = new Uint16Array(valueCount * 26)
    this._offsets = new Uint32Array(valueCount + 1)
    this._buildingBeginnings = []
    if(this._mode) {
      this._objects = this._input
      this._getters = this._keys.map(makeGetter)
    }
    if(this._mode === 2) {
      this._keysLength = keysLength
      this._bitflags = new Int32Array(this._input.length)
    }
  }

  _run(deadline) {
    if(this._done) return
    let end = Date.now() + 8
    try {
      this._initialize()
      do this._prepareOne()
      while(this._index < this._input.length && (deadline && !deadline.didTimeout ? deadline.timeRemaining() > 1 : Date.now() < end))
      if(this._index === this._input.length) this._complete()
      else this._schedule()
    } catch(error) {
      this._error = error
      this._done = true
    }
  }

  _prepareOne() {
    let i = this._index++
    let mode = this._mode
    if(mode < 2) {
      let value = mode
        ? this._getters[0] === null ? this._input[i][this._keys[0]] : this._getters[0](this._input[i])
        : this._input[i]
      this._targets[i] = value ? indexBeginnings(prepTarget(value), this._first, i, this._buildingBeginnings) : noTarget
      this._offsets[i + 1] = this._buildingBeginnings.length
      return
    }

    let obj = this._input[i]
    let bitflags = 0
    let keysLength = this._keysLength
    for(let k = 0; k < keysLength; k++) {
      let value = this._getters[k] === null ? obj[this._keys[k]] : this._getters[k](obj)
      let row = i * keysLength + k
      let prepared = this._targets[row] = value ? prepTarget(value) : noTarget
      if(prepared !== noTarget) indexBeginnings(prepared, this._first, row, this._buildingBeginnings)
      this._offsets[row + 1] = this._buildingBeginnings.length
      bitflags |= prepared._bitflags
    }
    this._bitflags[i] = bitflags
  }

  _complete() {
    this._beginnings = Uint16Array.from(this._buildingBeginnings)
    this._buildingBeginnings = this._input = this._getters = this._keys = null
    this._done = true
  }

  _finish() {
    if(this._error) throw this._error
    if(this._done) return
    this._cancel()
    try {
      this._initialize()
      while(this._index < this._input.length) this._prepareOne()
      this._complete()
    } catch(error) {
      this._error = error
      this._done = true
      throw error
    }
  }
}

function prepTarget(target) {
  if(typeof target === 'number') target = '' + target
  else if(typeof target !== 'string') target = ''
  let info = lowerInfo(target)
  return newResult(target, -INF, null, info._lower, info.lowerCodes, info.bitflags)
}

function prepQuery(search) {
  if(typeof search === 'number') search = '' + search
  else if(typeof search !== 'string') search = ''
  search = search.trim()
  let info = lowerInfo(search)
  info.parts = info.hasSpace ? [...new Set(search.split(/\s+/))].map(prepQuery) : []
  return info
}

function getPrepared(target) {
  if(target.length > 999) return prepTarget(target)
  let prepared = targetCache.get(target)
  if(prepared === undefined) targetCache.set(target, prepared = prepTarget(target))
  return prepared
}

function getQuery(search) {
  if(search.length > 999) return prepQuery(search)
  let prepared = searchCache.get(search)
  if(prepared === undefined) searchCache.set(search, prepared = prepQuery(search))
  return prepared
}

function indexBeginnings(prepared, firstTable, row, packed) {
  if(prepared.target.length >= 65535) return prepared
  let target = remapChars(prepared.target)
  let lowerCodes = prepared._targetLowerCodes
  let offset = row * 26
  let count = 0
  let wasUpper = false
  let wasAlnum = false

  for(let i = 0; i < target.length; i++) {
    let code = target.charCodeAt(i)
    let isUpper = code >= 65 && code <= 90
    let isAlnum = isUpper || code >= 97 && code <= 122 || code >= 48 && code <= 57
    let isBeginning = isUpper && !wasUpper || !wasAlnum || !isAlnum
    wasUpper = isUpper
    wasAlnum = isAlnum
    if(!isBeginning) continue

    count++
    packed.push(i)
    let lowerCode = lowerCodes[i]
    if(lowerCode >= 97 && lowerCode <= 122) {
      let slot = offset + lowerCode - 97
      if(firstTable[slot] === 0) firstTable[slot] = i + 1
    }
  }
  prepared._beginningsLen = count
  return prepared
}

function prepareSingleMatch(prepared, searchCode, fallbackIndex) {
  let target = remapChars(prepared.target)
  let lowerCodes = prepared._targetLowerCodes
  let matchI = fallbackIndex
  let strict = false
  let beginnings = 0
  let wasUpper = false
  let wasAlnum = false

  for(let i = 0; i < target.length; i++) {
    let code = target.charCodeAt(i)
    let isUpper = code >= 65 && code <= 90
    let isAlnum = isUpper || code >= 97 && code <= 122 || code >= 48 && code <= 57
    let isBeginning = isUpper && !wasUpper || !wasAlnum || !isAlnum
    wasUpper = isUpper
    wasAlnum = isAlnum
    if(!isBeginning) continue

    beginnings++
    if(!strict && searchCode === lowerCodes[i]) {
      matchI = i
      strict = true
    }
  }
  prepared._beginningsLen = beginnings
  prepared._singleMatchCode = searchCode
  prepared._singleMatchIndex = matchI
  prepared._singleMatchStrict = strict
}

function makeNextBeginnings(prepared) {
  let target = remapChars(prepared.target)
  let next = []
  let fill = 0
  let beginnings = 0
  let wasUpper = false
  let wasAlnum = false

  for(let i = 0; i < target.length; i++) {
    let code = target.charCodeAt(i)
    let isUpper = code >= 65 && code <= 90
    let isAlnum = isUpper || code >= 97 && code <= 122 || code >= 48 && code <= 57
    let isBeginning = isUpper && !wasUpper || !wasAlnum || !isAlnum
    wasUpper = isUpper
    wasAlnum = isAlnum
    if(!isBeginning) continue

    beginnings++
    for(; fill < i; fill++) next[fill] = i
  }
  for(; fill < target.length; fill++) next[fill] = target.length
  prepared._beginningsLen = beginnings
  return next
}

function remapCharacter(char) {
  let remapped = remappings[char]
  if(remapped !== undefined) return remapped
  if(char.charCodeAt(0) < 128) return char
  remapped = char.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  return remapped.length === 1 ? remapped : char
}

function remapChars(value) {
  if(customAsciiRemappings) return value.replace(/[\s\S]/g, remapCharacter)
  return /[^\x00-\x7F]|[\\"`]/.test(value) ? value.replace(/[^\x00-\x7F]|[\\"`]/g, remapCharacter) : value
}

function lowerInfo(value) {
  value = remapChars(value)
  let lower = value.toLowerCase()
  let lowerCodes = []
  let bitflags = 0
  let hasSpace = false

  for(let i = 0; i < lower.length; i++) {
    let code = lowerCodes[i] = lower.charCodeAt(i)
    if(code === 32) {
      hasSpace = true
      continue
    }
    let bit = code >= 97 && code <= 122 ? code - 97
      : code >= 48 && code <= 57 ? 26
      : code <= 127 ? 30 : 31
    bitflags |= 1 << bit
  }
  return {lowerCodes, bitflags, hasSpace, _lower: lower}
}


class Result {
  get ['indexes']() { return this._indexes.slice(0, this._indexes.len).sort((a, b) => a - b) }
  set ['indexes'](value) { this._indexes = value }
  ['highlight'](open, close) { return highlight(this, open, close) }
  get ['score']() { return normalizeScore(this._score) }
  set ['score'](value) { this._score = denormalizeScore(value) }
}

class KeysResult extends Array {
  get ['score']() { return normalizeScore(this._score) }
  set ['score'](value) { this._score = denormalizeScore(value) }
}

function newResult(target, score = -INF, obj = null, lower = '', lowerCodes = null, bitflags = 0) {
  let result = new Result()
  result.target = target
  result.obj = obj
  result._score = score
  result._indexes = []
  result._targetLower = lower
  result._targetLowerCodes = lowerCodes
  result._nextBeginningIndexes = null
  result._beginningsLen = 0
  result._singleMatchCode = result._singleMatchIndex = -1
  result._singleMatchStrict = false
  result._bitflags = bitflags
  return result
}

function materialize(prepared, obj = null) {
  let result = new Result()
  result.target = prepared.target
  result.obj = obj
  result._score = prepared._score
  result._indexes = prepared._indexes
  return result
}

function captureKeysResult(matches, keysLength, obj, score) {
  let result = new KeysResult(keysLength)
  for(let k = 0; k < keysLength; k++) result[k] = matches[k]
  result.obj = obj
  result._score = score
  return result
}

let normalizeScore = value => value === -INF ? 0 : value > 1 ? value : Math.E ** (((-value + 1) ** .04307 - 1) * -2)
let denormalizeScore = value => value === 0 ? -INF : value > 1 ? value : 1 - Math.pow(Math.log(value) / -2 + 1, 1 / .04307)
let isPrepared = value => typeof value === 'object' && typeof value?._bitflags === 'number'

function makeGetter(key) {
  if(typeof key === 'function') return key
  let path = Array.isArray(key) ? key
    : typeof key === 'string' && key.includes('.') ? key.split('.') : null
  if(path === null) return null
  return obj => {
    if(path !== key) {
      let direct = obj[key]
      if(direct !== undefined) return direct
    }
    for(let i = 0; obj && i < path.length; i++) obj = obj[path[i]]
    return obj
  }
}

function lowerBound(values, start, end, value, after = false) {
  while(start < end) {
    let middle = start + end >> 1
    if(values[middle] < value || after && values[middle] === value) start = middle + 1
    else end = middle
  }
  return start
}

function nextBeginning(indexes, start, end, index, targetLen) {
  let next = lowerBound(indexes, start, end, index, true)
  return next < end ? indexes[next] : targetLen
}

function isBeginning(indexes, start, end, index) {
  let found = lowerBound(indexes, start, end, index)
  return found < end && indexes[found] === index
}

function createHeap() {
  let items = []
  let length = 0

  function down() {
    let index = 0
    let item = items[0]
    for(let child = 1; child < length; child = 1 + index * 2) {
      let right = child + 1
      index = right < length && items[right]._score < items[child]._score ? right : child
      items[(index - 1) >> 1] = items[index]
    }
    for(let parent = (index - 1) >> 1; index > 0 && item._score < items[parent]._score; parent = (index = parent) - 1 >> 1) {
      items[index] = items[parent]
    }
    items[index] = item
  }

  return {
    add(item) {
      let index = length++
      for(let parent = (index - 1) >> 1; index > 0 && item._score < items[parent]._score; parent = (index = parent) - 1 >> 1) {
        items[index] = items[parent]
      }
      items[index] = item
    },
    poll() {
      if(!length) return
      let root = items[0]
      items[0] = items[--length]
      down()
      return root
    },
    peek() { return length ? items[0] : undefined },
    replaceTop(item) {
      items[0] = item
      down()
    },
  }
}


let INF = Infinity
let noResults = []
noResults.total = 0

let targetCache = new Map(), searchCache = new Map()

let simpleMatch = [], strictMatch = []
let seen = [], seenAt = []
let changes = [], partials = [], spaceScores = []
let keyTargets = [], keyResults = []
let seenGeneration = 0

let remappings = {}
let remapFrom = '\\"`‘’“”‐–—−⁄∕…øØæÆœŒßẞłŁ', remapTo = "/''''''----//.oOaAoOsSlL"
for(let i = 0; i < remapFrom.length; i++) remappings[remapFrom[i]] = remapTo[i]
let customAsciiRemappings = false

let heap = createHeap()

let noTarget = prepTarget('')

export default {single, go, highlight, score, remap, prepare, snapshot, cleanup}
