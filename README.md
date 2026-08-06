<p align="center"><a href="https://raw.github.com/farzher/fuzzysort/master/fuzzysort.js">
  <img src="https://i.imgur.com/axkOMVs.png" alt="fuzzysort" />
</a></p>

<p align="center">
  Fast, Tiny, & Good fuzzy search for JavaScript.
</p>

<p align="center">
  <b>Fast:</b> <b>&lt;1ms</b> to search <b>13,000</b> files.
  <br>
  <b>Tiny:</b> <b>1 file</b>, <b>0 dependencies</b>, <b>5kb</b>.
  <br>
  <b>Good:</b> clean api + sorts results well.
</p>


## [Demo](https://rawgit.com/farzher/fuzzysort/master/test/test.html)

https://rawgit.com/farzher/fuzzysort/master/test/test.html

![](https://i.imgur.com/muaw363.gif)

![](https://i.imgur.com/SXC9A3q.png)

![](https://i.imgur.com/fUkJ7G3.png)

![](https://i.imgur.com/CnVXRbf.png)





## Installation Node / Bun / Deno

```sh
npm i fuzzysort
```
```js
import fuzzysort from 'fuzzysort'
```



## Installation Browser

```html
<script type="module">
  import fuzzysort from 'https://cdn.jsdelivr.net/npm/fuzzysort@4.0.0/fuzzysort.min.js'
</script>
```


## Usage

### `fuzzysort.go(search, targets, options=null)`

```js
const mystuff = [{file: 'Apple.cpp'}, {file: 'Banana.cpp'}]
const results = fuzzysort.go('a', mystuff, {key: 'file'})
// [{score: 0.81, obj: {file: 'Apple.cpp'}}, {score: 0.59, obj: {file: 'Banana.cpp'}}]
```

### `fuzzysort.prepare(targets, options=null)`

Build an optimized reusable snapshot when the same targets will be searched more than once.
Keys for object targets are provided while preparing, not while searching. Collections are
prepared incrementally during browser idle time (and between Node event-loop turns), so
`prepare()` returns immediately. Searching the collection before it is ready synchronously
finishes its remaining preparation first.

```js
const games = fuzzysort.prepare(['Half-Life', 'Portal', 'Team Fortress 2'])
fuzzysort.go('port', games, {limit: 10})

const files = fuzzysort.prepare(
  [{name: 'App.js', description: 'Application entry point'},
   {name: 'Renderer.js', description: 'Renders the interface'}],
  {keys: ['name', 'description']},
)
fuzzysort.go('render interface', files, {limit: 10})
```

Both `key` and `keys` accept the same dotted paths, path arrays, and getter
functions as `go`. With `keys`, preparation extracts every value once and caches
each object's combined character filter, avoiding key traversal and much of the
per-object setup on every search.

Treat prepared targets and their searchable values as a snapshot. Prepare them again
when they change. This moves preparation work out of latency-sensitive searches and
allows fuzzysort to cache additional search metadata safely. Preparation also builds
a compact first-letter lookup table (about 54 bytes per searchable value) and packed
word beginnings so one- and two-character searches use the same fast paths for every
prepared key.

### Options

```js
fuzzysort.go(search, targets, {
  threshold: 0,    // Don't return matches worse than this
  limit: 0,        // Don't return more results than this
  all: false,      // If true, returns all results for an empty search

  key: null,       // For when targets are objects (see its example usage)
  keys: null,      // For when targets are objects (see its example usage)
  scoreFn: null,   // For use with `keys` (see its example usage)
})
```




## What's a `result`

```js
const result = fuzzysort.single('query', 'some string that contains my query.')
result.score       // .80 (1 is a perfect match. 0.5 is a good match. 0 is no match.)
result.target      // 'some string that contains my query.'
result.obj         // reference to your original obj when using options.key
result.indexes     // [29, 30, 31, 32, 33]

result.highlight('<b>', '</b>')
// 'some string that contains my <b>query</b>.'

result.highlight((m, i) => <react key={i}>{m}</react>)
// ['some string that contains my ', <react key=0>query</react>, '.']
```

When results are returned from a Web Worker, `postMessage()` does not preserve
prototype methods or accessors. Use the top-level helpers on the cloned result:

```js
fuzzysort.highlight(result, '<b>', '</b>')
fuzzysort.score(result)
```

These helpers also work with normal, uncloned results.

### Advanced Usage

Search a list of objects, by multiple complex keys, with custom weights.

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
  scoreFn: r => r.score * r.obj.bookmarked ? 2 : 1, // if the item is bookmarked, boost its score
})

var keysResult = results[0]
// When using multiple `keys`, results are different. They're indexable to get each normal result
keysResult[0].highlight() // 'Liechi <b>Berry</b>'
keysResult[1].highlight() // 'Raises <b>Attack</b> when HP is low.'
keysResult.score          // .84
keysResult.obj.title      // 'Liechi Berry'
```



## How To Go Fast · Performance Tips

```js
let targets = [{file: 'Monitor.cpp'}, {file: 'MeshRenderer.cpp'}]

// filter out targets that you don't need to search! especially long ones!
targets = targets.filter(t => t.file.length < 1000)

// Prepare targets before the user starts searching. For object targets, key/keys
// belong here so their values are extracted only once.
const preparedTargets = fuzzysort.prepare(targets, {key: 'file'})
// Multiple fields work too:
// fuzzysort.prepare(targets, {keys: ['file', 'description']})

const options = {
  limit: 100,    // don't return more results than you need!
  threshold: .5, // don't return bad results
}
fuzzysort.go('gotta', preparedTargets, options)
fuzzysort.go('go',    preparedTargets, options)
fuzzysort.go('fast',  preparedTargets, options)
```


### Character remapping

Searches automatically remap accented characters, Unicode compatibility forms, and
common visual variants (`ø`/`o`, `ｅ`/`e`, `ℯ`/`e`, and smart/straight quotes). Forward and backward
slashes are equivalent, as are an ellipsis and a period. Context-dependent symbols
such as `+`/`&` and decimal `,`/`.` remain distinct.

### Gotcha
`result.score` is implemented as a getter/setter and stored different internally
`r.score = .3; // r.score == 0.30000000000000004`





## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=farzher/fuzzysort)](https://star-history.com/#farzher/fuzzysort)



### Changelog

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
