# [fuzzysort](https://raw.github.com/farzher/fuzzysort/master/fuzzysort.js)

Fast, Tiny, & Good SublimeText-like fuzzy search for JavaScript.

Sublime's fuzzy search is... sublime. I wish everything used it. So here's an open source js version.



## [Demo](https://rawgit.com/farzher/fuzzysort/master/test/test.html)

- **Fast** - **1ms** to search **13,000** files.
- **Tiny** - 1 file, **5kb**. 0 dependencies.
- **Good** - clean api + sorts results well.

https://rawgit.com/farzher/fuzzysort/master/test/test.html

![](https://i.imgur.com/THbQ08n.gif)

![](https://i.imgur.com/X1rzMGZ.png)

![](https://i.imgur.com/ha0YfNq.png)



## Installation Node

```sh
npm install fuzzysort
```
```js
const fuzzysort = require('fuzzysort')
```
```js
import fuzzysort from 'fuzzysort'
```


## Installation Browser

```html
<script src="https://cdn.jsdelivr.net/npm/fuzzysort@2.0.4/fuzzysort.min.js"></script>
```


## Most Common Usage


### `fuzzysort.go(search, targets, options=null)`

```js
const mystuff = [{file:'Monitor.cpp'}, {file:'MeshRenderer.cpp'}]
const results = fuzzysort.go('mr', mystuff, {key:'file'})
// [{score:-18, obj:{file:'MeshRenderer.cpp'}}, {score:-6009, obj:{file:'Monitor.cpp'}}]
```



## Usage


### `fuzzysort.go(search, targets, options=null)`

```js
const results = fuzzysort.go('mr', ['Monitor.cpp', 'MeshRenderer.cpp'])
// [{score: -18, target: "MeshRenderer.cpp"}, {score: -6009, target: "Monitor.cpp"}]
```


##### Options

```js
fuzzysort.go(search, targets, {
  threshold: -Infinity, // Don't return matches worse than this (higher is faster)
  limit: Infinity, // Don't return more results than this (lower is faster)
  all: false, // If true, returns all results for an empty search

  key: null, // For when targets are objects (see its example usage)
  keys: null, // For when targets are objects (see its example usage)
  scoreFn: null, // For use with `keys` (see its example usage)
})
```

#### `fuzzysort.highlight(result, open='<b>', close='</b>')`

```js
fuzzysort.highlight(fuzzysort.single('tt', 'test'), '*', '*') // *t*es*t*
```

#### `fuzzysort.highlight(result, callback)`
```js
fuzzysort.highlight(result, (m, i) => <react key={i}>{m}</react>) // [<react key=0>t</react>, 'es', <react key=1>t</react>]
```


## What is a `result`

```js
const result = fuzzysort.single('query', 'some string that contains my query.')
// exact match returns a score of 0. lower is worse
result.score // -59
result.target // some string that contains my query.
result.obj // reference to your original obj when using options.key
fuzzysort.highlight(result, '<b>', '</b>') // some string that contains my <b>query</b>.
```



## How To Go Fast · Performance Tips

```js
let targets = [{file:'Monitor.cpp'}, {file:'MeshRenderer.cpp'}]

// filter out targets that you don't need to search! especially long ones!
targets = targets.filter(t => t.file.length < 1000)

// if your targets don't change often, provide prepared targets instead of raw strings!
targets.forEach(t => t.filePrepared = fuzzysort.prepare(t.file))

// don't use options.key if you don't need a reference to your original obj
targets = targets.map(t => t.filePrepared)

const options = {
  limit: 100, // don't return more results than you need!
  threshold: -10000, // don't return bad results
}
fuzzysort.go('gotta', targets, options)
fuzzysort.go('go', targets, options)
fuzzysort.go('fast', targets, options)
```


### Advanced Usage

Search a list of objects, by multiple fields, with custom weights.

```js
let objects = [{title:'Favorite Color', desc:'Chrome'}, {title:'Google Chrome', desc:'Launch Chrome'}]
let results = fuzzysort.go('chr', objects, {
  keys: ['title', 'desc'],
  // Create a custom combined score to sort by. -100 to the desc score makes it a worse match
  scoreFn: a => Math.max(a[0]?a[0].score:-1000, a[1]?a[1].score-100:-1000)
})

var bestResult = results[0]
// When using multiple `keys`, results are different. They're indexable to get each normal result
fuzzysort.highlight(bestResult[0]) // 'Google <b>Chr</b>ome'
fuzzysort.highlight(bestResult[1]) // 'Launch <b>Chr</b>ome'
bestResult.obj.title // 'Google Chrome'
```


### Changelog

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
