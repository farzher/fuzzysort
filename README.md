<p align="center"><a href="https://raw.github.com/farzher/fuzzysort/master/fuzzysort.js">
  <img src="https://i.imgur.com/axkOMVs.png" alt="fuzzysort" />
</a></p>

<p align="center">
  <b>Fast, tiny, good fuzzy search for JavaScript.</b><br>
  &lt;1ms for 13,000 files · 0 dependencies · clean ranking
</p>




## [Demo](https://rawgit.com/farzher/fuzzysort/master/test/test.html)

https://rawgit.com/farzher/fuzzysort/master/test/test.html

![](https://i.imgur.com/muaw363.gif)

![](https://i.imgur.com/SXC9A3q.png)

![](https://i.imgur.com/fUkJ7G3.png)

![](https://i.imgur.com/CnVXRbf.png)





## Install

```sh
npm i fuzzysort
```
```js
import fuzzysort from 'fuzzysort'
```

Browser:

```html
<script type="module">
  import fuzzysort from 'https://cdn.jsdelivr.net/npm/fuzzysort@4.0.0/fuzzysort.min.js'
</script>
```


## Quick start

```js
const files = [{file: 'Apple.cpp'}, {file: 'Banana.cpp'}]

const results = fuzzysort.go('a', files, {key: 'file'})
// [{score: 0.81, obj: files[0]}, {score: 0.59, obj: files[1]}]
```

### `fuzzysort.go(search, targets, options)`

```js
fuzzysort.go(search, targets, {
  key       : null,  // Search one property
  keys      : null,  // Search multiple properties
  limit     : 10,    // Max results; 0 = unlimited
  threshold : .5,    // Minimum score; 0 = any match
  scoreFn   : null,  // Override result scoring
})
```




## What's a `result`

```js
const result = fuzzysort.single('query', 'some string that contains my query.')
result.score   // .80 (1 is a perfect match. 0.5 is a good match. 0 is no match.)
result.target  // 'some string that contains my query.'
result.obj     // reference to your original obj when using options.key
result.indexes // [29, 30, 31, 32, 33]

result.highlight('<b>', '</b>') // 'some string that contains my <b>query</b>.'
result.highlight((m, i) => <react key={i}>{m}</react>)
```

### Advanced Usage - objects, multiple complex keys, custom scoring

```js
let objects = [{
  title: 'Liechi Berry',
  meta: {desc: 'Raises Attack when HP is low.'},
  tags: ['berries', 'items'],
  bookmarked: true,
}, {
  title: 'Petaya Berry',
  meta: {desc: 'Raises Special Attack when HP is low.'},
}]

let results = fuzzysort.go('attack berry', objects, {
  keys: ['title', 'meta.desc', obj => obj.tags?.join()],
  scoreFn: r => r.score * (r.obj.bookmarked ? 2 : 1), // if the item is bookmarked, boost its score
})

// When using multiple `keys`, results are different. They're indexable to get each normal result
var keysResult = results[0]
keysResult[0].highlight() // 'Liechi <b>Berry</b>'
keysResult[1].highlight() // 'Raises <b>Attack</b> when HP is low.'
keysResult.score          // .84
keysResult.obj.title      // 'Liechi Berry'
```



## How To Go Fast · Performance Tips · `fuzzysort.snapshot`

```js
let targets = [{file: 'Monitor.cpp'}, {file: 'MeshRenderer.cpp'}]

let options = {
  limit: 100,    // don't return more results than you need!
  threshold: .5, // don't return bad results!
}

// filter out targets that you don't need to search! especially long ones!
targets = targets.filter(t => t.file.length < 1000)

// BEST: if your targets don't change, take an immutable snapshot!
let canSnapshot = true
if(canSnapshot) targets = fuzzysort.snapshot(targets, {key: 'file'})

// FALLBACK: if you can't snapshot, provide prepared targets instead of raw strings!
if(!canSnapshot) {
  targets.forEach(t => t.filePrepared = fuzzysort.prepare(t.file))
  options.key = 'filePrepared'
}

fuzzysort.go('gotta', targets, options)
fuzzysort.go('go',    targets, options)
fuzzysort.go('fast',  targets, options)
```


### Character remapping

Searches use NFKD normalization, strip diacritics, and remap common quote, dash, slash, ellipsis, and lookalike characters.

Add or override mappings with `fuzzysort.remap()`:

```js
fuzzysort.remap({',': '.'}) // 12,5 = 12.5
```


### Gotcha · Web Workers / cloned results

`result.score` is a getter/setter backed by an internal score representation. Structured cloning can remove those getters. For cloned results, use: `fuzzysort.score(result)` and `fuzzysort.highlight(result)`


### Changelog

#### v4.0.0
- ESM instead of UMD
- Added `fuzzysort.snapshot()` for the best search performance
- Added `fuzzysort.score()` and `fuzzysort.highlight()` for Web Worker support
- Added `fuzzysort.remap()` for custom normalization
- Automatically remap common lookalike characters
- Added default `threshold` and `limit`
- Changed `highlight()` to only highlight `keys` with a good match
- Changed scoring: substring matches are even more relevant
- Removed `options.all`; empty search now always returns all results
- `scoreFn` now works with all search modes

#### v3.1.0
- Automatically handle diacritics / accents / ligatures

#### v3.0.0
- Added new behavior when using `keys` and your search contains spaces!
- Added `options.key` can now be a function `{key: obj => obj.tags.join()}`
- Removed `fuzzysort.indexes` & Added `result.indexes` (as a getter/setter for GC perf)
- Removed `fuzzysort.highlight()` & Added `result.highlight()`
- Changed scoring: score is now a number from 0 to 1 instead of from -Infinity to 0
- Changed scoring: substring matches are even more relevant
- Changed scoring: `straw berry` now matches great against `strawberry`
- Changed scoring: tweaked the scoring quite a bit
- `result.score` is behind a getter/setter for performance reasons
- Fixed minor issues

#### v2.0.0
- Added new behavior when your search contains spaces!
- Added fuzzysort.min.js
- Now depends on ES6 features
- Removed `result.indexes` & Added `fuzzysort.indexes` (improved GC performance)
- Completely Removed `options.allowTypo`
- Completely Removed `fuzzysort.goAsync`
- Completely Removed `fuzzysort.new`
- Rewrote the demo

#### v1.9.0
- Even faster
- Added `options.all`
- Deprecated/Removed `options.allowTypo`
- Deprecated/Removed `fuzzysort.goAsync`
- Changed scoring: boosted substring matches
- Changed scoring: targets with too many beginning indexes lose points for being a bad target
- Changed scoring: penality for not starting near the beginning
- Changed scoring: penality for more groups
- Fixed "Exponential backtracking hangs browser"

#### v1.2.0
- Added `fuzzysort.highlight(result, callback)`

#### v1.1.0
- Added `allowTypo` as an option

#### v1.0.0

- Inverted scores; they're now negative instead of positive, so that higher scores are better
- Added ability to search objects by `key`/`keys` with custom weights
- Removed the option to automatically highlight and exposed `fuzzysort.highlight`
- Removed all options from `fuzzysort` and moved them into `fuzzysort.go` optional params

#### v0.x.x

- init
