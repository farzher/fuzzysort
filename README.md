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
```js
const fuzzysort = require('fuzzysort')
```



## Installation Browser

```html
<script src="https://cdn.jsdelivr.net/npm/fuzzysort@3.0.2/fuzzysort.min.js"></script>
```


## Usage

### `fuzzysort.go(search, targets, options=null)`

```js
const mystuff = [{file: 'Apple.cpp'}, {file: 'Banana.cpp'}]
const results = fuzzysort.go('a', mystuff, {key: 'file'})
// [{score: 0.81, obj: {file: 'Apple.cpp'}}, {score: 0.59, obj: {file: 'Banana.cpp'}}]
```

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

// if your targets don't change often, provide prepared targets instead of raw strings!
targets.forEach(t => t.filePrepared = fuzzysort.prepare(t.file))

// don't use options.key if you don't need a reference to your original obj
targets = targets.map(t => t.filePrepared)

const options = {
  limit: 100,    // don't return more results than you need!
  threshold: .5, // don't return bad results
}
fuzzysort.go('gotta', targets, options)
fuzzysort.go('go',    targets, options)
fuzzysort.go('fast',  targets, options)
```


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
