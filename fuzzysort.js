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
  const typoPenalty = 20
  const fuzzysort = {

    noMatchLimit: 100, // If there's no match for a span this long, give up (lower is faster for long search targets)
    highlightMatches: true, // Turn this off if you don't care about `highlighted` (faster)
    highlightOpen: '<b>',
    highlightClose: '</b>',
    threshold: null, // Don't return matches worse than this (lower is faster) (irrelevant for `single`)
    limit: null, // Don't return more results than this (faster) (irrelevant for `single`)
    allowTypo: true, // Allwos a snigle transpoes in yuor serach (faster when off)

    single: (search, target) => {
      const searchLower = search.toLowerCase()
      const searchLen = searchLower.length
      const searchLowerCode = searchLower.charCodeAt(0)
      const isObj = typeof target === 'object'
      const infoFn = isObj ? fuzzysort.infoObj : fuzzysort.info
      const result = infoFn(searchLower, searchLen, searchLowerCode, target)
      if(result === null) return null
      if(fuzzysort.highlightMatches) result.highlighted = fuzzysort.highlight(result)
      return result
    },

    go: (search, targets) => {
      if(search === '') { const a=[]; a.total=0; return a }
      const isObj = typeof targets[0] === 'object'
      const infoFn = isObj ? fuzzysort.infoObj : fuzzysort.info
      const searchLower = search.toLowerCase()
      const searchLen = searchLower.length
      const searchLowerCode = searchLower.charCodeAt(0)
      var resultsLen = 0
      var thresholdCount = 0
      var limitedCount = 0
      for(var i = targets.length-1; i>=0; i-=1) {
        const result = infoFn(searchLower, searchLen, searchLowerCode, targets[i])
        if(result === null) continue
        if(fuzzysort.threshold!==null && result.score > fuzzysort.threshold) { thresholdCount += 1; continue }
        if(!fuzzysort.limit || resultsLen<fuzzysort.limit)  {
          resultsLen += 1
          q.add(result)
        } else {
          limitedCount += 1
          if(result.score < q.peek().score) { q.poll(); q.add(result) }
        }
      }
      var results = new Array(resultsLen)
      for (var i = resultsLen - 1; i >= 0; i--) results[i] = q.poll()
      results.total = resultsLen + limitedCount
      results.thresholdCount = thresholdCount

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
        const infoFn = isObj ? fuzzysort.infoObj : fuzzysort.info
        const itemsPerCheck = 1000
        const searchLower = search.toLowerCase()
        const searchLen = searchLower.length
        const searchLowerCode = searchLower.charCodeAt(0)
        const q = new fastpriorityqueue(compareResultsMaxBool)
        var iCurrent = targets.length-1
        var resultsLen = 0
        var thresholdCount = 0
        var limitedCount = 0
        function step() {
          if(canceled) return reject('canceled')

          const startMs = Date.now()

          for(; iCurrent>=0; iCurrent-=1) {
            const result = infoFn(searchLower, searchLen, searchLowerCode, targets[iCurrent])
            if(result === null) continue
            if(fuzzysort.threshold!==null && result.score > fuzzysort.threshold) { thresholdCount += 1; continue }
            if(!fuzzysort.limit || resultsLen<fuzzysort.limit)  {
              resultsLen += 1
              q.add(result)
            } else {
              limitedCount += 1
              if(result.score < q.peek().score) { q.poll(); q.add(result) }
            }

            if(iCurrent%itemsPerCheck===0) {
              if(Date.now() - startMs >= 32) {
                isNode?setImmediate(step):setTimeout(step)
                return
              }
            }
          }

          var results = new Array(resultsLen)
          for (i = resultsLen - 1; i >= 0; i--) results[i] = q.poll()
          results.total = resultsLen + limitedCount
          results.thresholdCount = thresholdCount

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


    // very basic fuzzy match; to remove non-matching targets ASAP!
    // walk through target. find sequential matches.
    // if all chars aren't found then exit
    info: (searchLower, searchLen, searchLowerCode, target) => {
      const targetLower = target.toLowerCase()
      const targetLen = targetLower.length
      var targetLowerCode = targetLower.charCodeAt(0)
      var searchI = 0 // where we at
      var targetI = 0 // where you at
      var typoSimpleI = 0
      var noMatchCount = 0 // how long since we've seen a match
      var matchesSimple // target indexes
      var matchesSimpleLen = 1

      while(true) {
        const isMatch = searchLowerCode === targetLowerCode

        if(isMatch) {
          matchesSimple===undefined ? matchesSimple = [targetI] : matchesSimple[matchesSimpleLen++] = targetI

          searchI += 1
          if(searchI === searchLen) break
          searchLowerCode = searchLower.charCodeAt(typoSimpleI===0?searchI : (typoSimpleI===searchI?searchI+1 : (typoSimpleI===searchI-1?searchI-1 : searchI)))
          noMatchCount = 0
        } else {
          noMatchCount += 1
          if(noMatchCount >= fuzzysort.noMatchLimit) return null
        }

        targetI += 1
        if(targetI === targetLen) { // Failed to find searchI
          if(!fuzzysort.allowTypo) return null

          // Check for typo or exit
          // we go as far as possible before trying to transpose
          // then we transpose backwards until we reach the beginning
          do {
            if(searchI <= 1) return null // not allowed to transpose first char
            if(typoSimpleI === 0) { // we're searching an already transposed search
              searchI -= 1
              const searchLowerCodeNew = searchLower.charCodeAt(searchI)
              if(searchLowerCode === searchLowerCodeNew) continue // doesn't make sense to transpose a repeat char
              typoSimpleI = searchI
              matchesSimpleLen = searchI
              targetI = matchesSimple[matchesSimpleLen - 1] + 1
            } else {
              if(typoSimpleI===1) return null // reached the end of the line for transposing
              typoSimpleI -= 1
              searchI = typoSimpleI
              searchLowerCode = searchLower.charCodeAt(searchI+1)
              const searchLowerCodeNew = searchLower.charCodeAt(searchI)
              if(searchLowerCode === searchLowerCodeNew) continue // doesn't make sense to transpose a repeat char
              matchesSimpleLen = searchI
              targetI = matchesSimple[matchesSimpleLen - 1]
            }
            break
          } while(true)
        }
        targetLowerCode = targetLower.charCodeAt(targetI)
      }

      { // This obj creation needs to be scoped for performance
        // Otherwise this causes a big slowdown, even if it's never executed, weird!
        const obj = {_target:target, _targetLower:targetLower, _matchesSimple:matchesSimple, _typoSimpleI:typoSimpleI}
        return fuzzysort.infoStrict(searchLower, searchLen, searchLowerCode, obj)
      }
    },


    // This code is basically a copy/paste of `info` for performance reasons :(
    infoObj: (searchLower, searchLen, searchLowerCode, obj) => {
      // if(obj._targetLower === undefined) obj._targetLower = obj._target.toLowerCase()
      const targetLower = obj._targetLower
      const targetLen = targetLower.length
      var targetLowerCode = targetLower.charCodeAt(0)
      var searchI = 0 // where we at
      var targetI = 0 // where you at
      var typoSimpleI = 0
      var noMatchCount = 0 // how long since we've seen a match
      var matchesSimple // target indexes
      var matchesSimpleLen = 1

      while(true) {
        const isMatch = searchLowerCode === targetLowerCode

        if(isMatch) {
          matchesSimple===undefined ? matchesSimple = [targetI] : matchesSimple[matchesSimpleLen++] = targetI

          searchI += 1
          if(searchI === searchLen) break
          searchLowerCode = searchLower.charCodeAt(typoSimpleI===0?searchI : (typoSimpleI===searchI?searchI+1 : (typoSimpleI===searchI-1?searchI-1 : searchI)))
          noMatchCount = 0
        } else {
          noMatchCount += 1
          if(noMatchCount >= fuzzysort.noMatchLimit) return null
        }

        targetI += 1

        if(targetI === targetLen) { // Failed to find searchI
          if(!fuzzysort.allowTypo) return null

          // Check for typo or exit
          // we go as far as possible before trying to transpose
          // then we transpose backwards until we reach the beginning
          do {
            if(searchI <= 1) return null // not allowed to transpose first char
            if(typoSimpleI === 0) { // we're searching an already transposed search
              searchI -= 1
              const searchLowerCodeNew = searchLower.charCodeAt(searchI)
              if(searchLowerCode === searchLowerCodeNew) continue // doesn't make sense to transpose a repeat char
              typoSimpleI = searchI
              matchesSimpleLen = searchI
              targetI = matchesSimple[matchesSimpleLen - 1] + 1
            } else {
              if(typoSimpleI===1) return null // reached the end of the line for transposing
              typoSimpleI -= 1
              searchI = typoSimpleI
              searchLowerCode = searchLower.charCodeAt(searchI+1)
              const searchLowerCodeNew = searchLower.charCodeAt(searchI)
              if(searchLowerCode === searchLowerCodeNew) continue // doesn't make sense to transpose a repeat char
              matchesSimpleLen = searchI
              targetI = matchesSimple[matchesSimpleLen - 1]
            }
            break
          } while(true)
        }
        targetLowerCode = targetLower.charCodeAt(targetI)
      }

      obj._matchesSimple = matchesSimple
      obj._typoSimpleI = typoSimpleI
      return fuzzysort.infoStrict(searchLower, searchLen, searchLowerCode, obj)
    },

    // Our target string successfully matched all characters in sequence!
    // Let's try a more advanced and strict test to improve the score
    // only count it as a match if it's consecutive or a beginning character!
    // we use information about previous matches to skip around here and improve performance
    infoStrict: (searchLower, searchLen, searchLowerCode, obj) => {
      // TODO: actually use searchLowerCode
      const matchesSimple = obj._matchesSimple
      const targetLower = obj._targetLower
      const targetLen = targetLower.length
      const target = obj._target
      var wasUpper = false
      var wasAlphanum = false
      var isConsec = false
      var searchI = 0
      var typoStrictI = 0
      // var targetI // It's faster if this variable is not defined... ??????
      var noMatchCount = 0
      var successStrict = false
      var matchesStrict
      var matchesStrictLen = 1
      // var wasUpperFirstMatch
      // var wasAlphanumFirstMatch

      if(matchesSimple[0] > 0) {
        // skip and backfill history
        targetI = matchesSimple[0]
        const targetCode = target.charCodeAt(targetI-1)
        // wasUpperFirstMatch=
        wasUpper = targetCode>=65&&targetCode<=90
        // wasAlphanumFirstMatch=
        wasAlphanum = wasUpper || targetCode>=97&&targetCode<=122 || targetCode>=48&&targetCode<=57
      } else {
        targetI = 0
      }

      while(true) {

        if (targetI >= targetLen) {
          // We failed to find a good spot for this search char, go back to the previous search char and force it forward
          if (searchI <= 0) { // We failed to push chars forward for a better match
            if(!fuzzysort.allowTypo) break

            typoStrictI += 1
            if(typoStrictI > searchLen-2) break
            // if(obj._typoSimpleI>0 && typoStrictI>obj._typoSimpleI) break // Could this help performance?
            if(searchLower.charCodeAt(typoStrictI) === searchLower.charCodeAt(typoStrictI+1)) continue // doesn't make sense to transpose a repeat char
            isConsec = false
            if(matchesSimple[0] > 0) {
              // skip and backfill history
              targetI = matchesSimple[0]
              // wasUpper = wasUpperFirstMatch
              // wasAlphanum = wasAlphanumFirstMatch
              const targetCode = target.charCodeAt(targetI-1)
              wasUpper = targetCode>=65&&targetCode<=90
              wasAlphanum = wasUpper || targetCode>=97&&targetCode<=122 || targetCode>=48&&targetCode<=57
            } else {
              targetI = 0
              wasAlphanum = false
              // wasUpper = false // unnecessary
            }
            continue
          }
          searchI -= 1

          const lastMatch = matchesStrict[--matchesStrictLen]
          targetI = lastMatch + 1

          isConsec = false
          // backfill history
          const targetCode = target.charCodeAt(targetI-1)
          wasUpper = targetCode>=65&&targetCode<=90
          wasAlphanum = wasUpper || targetCode>=97&&targetCode<=122 || targetCode>=48&&targetCode<=57

        } else {
          const targetLowerCode = targetLower.charCodeAt(targetI)
          if(!isConsec) {
            const targetCode = target.charCodeAt(targetI)
            const isUpper = targetCode>=65&&targetCode<=90
            const isAlphanum = targetLowerCode>=97&&targetLowerCode<=122 || targetLowerCode>=48&&targetLowerCode<=57
            const isBeginning = isUpper && !wasUpper || !wasAlphanum || !isAlphanum
            wasUpper = isUpper
            wasAlphanum = isAlphanum
            if (!isBeginning) { targetI += 1; continue }
          }

          const isMatch = searchLower.charCodeAt(typoStrictI===0?searchI : (typoStrictI===searchI?searchI+1 : (typoStrictI===searchI-1?searchI-1 : searchI))) === targetLowerCode
          if(isMatch) {
            matchesStrict===undefined ? matchesStrict = [targetI] : matchesStrict[matchesStrictLen++] = targetI

            searchI += 1
            if(searchI === searchLen) { successStrict = true; break }

            targetI += 1
            const canSkipAhead = typoStrictI>0?false : matchesSimple[searchI] > targetI // TODO: skip during typos
            if(canSkipAhead) {
              // skip and backfill history
              targetI = matchesSimple[searchI]
              isConsec = false
              const targetCode = target.charCodeAt(targetI-1)
              wasUpper = targetCode>=65&&targetCode<=90
              wasAlphanum = wasUpper || targetCode>=97&&targetCode<=122 || targetCode>=48&&targetCode<=57
            } else {
              isConsec = true
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
        obj._matchesBest = successStrict ? matchesStrict : matchesSimple
        var score = 0
        var lastTargetI = -1
        for(const targetI of obj._matchesBest) {
          // score only goes up if they're not consecutive
          if(lastTargetI !== targetI - 1) score += targetI
          lastTargetI = targetI
        }
        if(!successStrict) {
          score *= 1000
          if(obj._typoSimpleI!==0) score += typoPenalty
        } else {
          if(typoStrictI!==0) score += typoPenalty
        }
        score += targetLen - searchLen
        obj.score = score

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

  function compareResultsMin(a, b) { return a.score - b.score }
  function compareResultsMaxBool(a, b) { return a.score > b.score }
  var isNode = typeof require !== 'undefined' && typeof window === 'undefined'
  var fastpriorityqueue=function(){function r(r){this.array=[],this.size=0,this.compare=r||t}var t=function(r,t){return r<t};return r.prototype.add=function(r){var t=this.size;this.array[this.size++]=r;for(var i=t-1>>1;t>0&&this.compare(r,this.array[i]);t=i,i=t-1>>1)this.array[t]=this.array[i];this.array[t]=r},r.prototype.heapify=function(r){this.array=r,this.size=r.length;for(var t=this.size>>1;t>=0;t--)this._percolateDown(t)},r.prototype._percolateUp=function(r){for(var t=this.array[r],i=r-1>>1;r>0&&this.compare(t,this.array[i]);r=i,i=r-1>>1)this.array[r]=this.array[i]},r.prototype._percolateDown=function(r){for(var t=this.size,i=this.array[r],a=1+(r<<1);a<t;){var s=a+1;r=a,s<t&&this.compare(this.array[s],this.array[a])&&(r=s),this.array[r-1>>1]=this.array[r],a=1+(r<<1)}for(var e=r-1>>1;r>0&&this.compare(i,this.array[e]);r=e,e=r-1>>1)this.array[r]=this.array[e];this.array[r]=i},r.prototype.peek=function(r){return this.array[0]},r.prototype.poll=function(r){var t=this.array[0];return this.array[0]=this.array[--this.size],this._percolateDown(0),t},r.prototype.trim=function(){this.array=this.array.slice(0,this.size)},r.prototype.isEmpty=function(r){return 0==this.size},r}()
  var q = new fastpriorityqueue(compareResultsMaxBool)

  // Export fuzzysort
    if(isNode) module.exports = fuzzysort
    else window.fuzzysort = fuzzysort
})()

// TODO: (performance) is it important to make sure `highlighted` property always exists for hidden class optimization?

// TODO: (like sublime) strip spaces from search input

// TODO: (like sublime) backslash === forwardslash

// TODO: (performance) i have no idea how well optizmied the allowing typos algorithm is (or if it even works)

// TODO: (performance) search could assume to be lowercase?
