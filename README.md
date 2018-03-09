# [fuzzysort](https://raw.github.com/farzher/fuzzysort/master/fuzzysort.js)

Fast SublimeText-like fuzzy search for JavaScript.

Sublime's fuzzy search is... sublime. I wish everything used it. So here's an open source js version.



## [Demo](https://rawgit.com/farzher/fuzzysort/master/test.html)

https://rawgit.com/farzher/fuzzysort/master/test.html

![](http://i.imgur.com/1M6ZrgS.gif)


![](http://i.imgur.com/kdZxnJ0.png)

![](http://i.imgur.com/4kKfMK4.png)

![](http://i.imgur.com/K8KMgcn.png)

![](http://i.imgur.com/PFIp7WR.png)



## Installation Node

```sh
npm i fuzzysort
node
> require('fuzzysort').single('t', 'test')
{ score: -3, indexes: [0], target: 'test' }
```


## Installation Browser

```html
<script src="https://rawgit.com/farzher/fuzzysort/master/fuzzysort.js"></script>
<script> console.log(fuzzysort.single('t', 'test')) </script>
```




## Usage

### `fuzzysort.single(search, target)`

```js
var result = fuzzysort.single('query', 'some string that contains my query.')
result.score // -59
result.indexes // [29, 30, 31, 32, 33]
result.target // some string that contains my query.
fuzzysort.highlight(result, '<b>', '</b>') // some string that contains my <b>query</b>.

fuzzysort.single('query', 'irrelevant string') // null

// exact match returns a score of 0. lower is worse
fuzzysort.single('query', 'query').score // 0
```


### `fuzzysort.go(search, targets, options=null)`

```js
fuzzysort.go('mr', ['Monitor.cpp', 'MeshRenderer.cpp'])
// [{score: -18, target: "MeshRenderer.cpp"}, {score: -6009, target: "Monitor.cpp"}]
```

### `fuzzysort.goAsync(search, targets, options=null)`

```js
let promise = fuzzysort.goAsync('mr', ['Monitor.cpp', 'MeshRenderer.cpp'])
promise.then(results => console.log(results))
if(invalidated) promise.cancel()
```

##### Options

```js
fuzzysort.go(search, targets, {
  threshold: -Infinity, // Don't return matches worse than this (higher is faster)
  limit: Infinity, // Don't return more results than this (lower is faster)
  allowTypo: true, // Allwos a snigle transpoes (false is faster)

  key: null, // For when targets are objects (see its example usage)
  keys: null, // For when targets are objects (see its example usage)
  scoreFn: null, // For use with `keys` (see its example usage)
})
```

#### `fuzzysort.highlight(result, open='<b>', close='</b>')`

```js
fuzzysort.highlight(fuzzysort.single('tt', 'test'), '*', '*') // *t*es*t*
```



## How To Go Fast · Performance Tips

```js
// filter out targets that you don't need to search! especially long ones!
targets = targets.filter(t => t.length < 1000)

// if your targets don't change often, provide prepared targets instead of raw strings!
targets = targets.map(t => fuzzysort.prepare(t))

// to prepare targets that are objects, pick a field to prepare, add the prepared
// field to each object, and search on the prepared field
targets = targets.map((target) => {
  target.titlePrepared = fuzzysort.prepare(target.title);
  return target;
});
const results = fuzzysort.go('search', targets, { key: 'titlePrepared' })
console.log(results[0].obj)

// use smart options!
const options = {
  limit: 100, // don't return more results than you need!
  allowTypo: false, // if you don't care about allowing typos
  threshold: -10000, // don't return garbage results
}
fuzzysort.go('gotta', targets, options)
fuzzysort.go('go', targets, options)
fuzzysort.go('fast', targets, options)
```


### Advanced Usage

Search a list of objects by key

```js
fuzzysort.go('mr', [{file:'Monitor.cpp'}, {file:'MeshRenderer.cpp'}], {key: 'file'})
// When using `key`, the results will have an extra property, `obj`, which referencese the original obj
// [{score: -18, target: "MeshRenderer.cpp", obj}, {score: -6009, target: "Monitor.cpp", obj}]
```

Search a list of objects, by multiple fields, with custom weights.

```js
let objects = [{title:'Favorite Color', desc:'Chrome'}, {title:'Google Chrome', desc:'Launch Chrome'}]
let results = fuzzysort.go('chr', objects, {
  keys: ['title', 'desc'],
  // Create a custom combined score to sort by. -100 to the desc score makes it a worse match
  scoreFn(a) => Math.max(a[0]?a[0].score:-1000, a[1]?a[1].score-100:-1000)
})

var bestResult = results[0]
// When using multiple `keys`, results are different. They're indexable to get each normal result
fuzzysort.highlight(bestResult[0]) // 'Google <b>Chr</b>ome'
fuzzysort.highlight(bestResult[1]) // 'Launch <b>Chr</b>ome'
bestResult.obj.title // 'Google Chrome'
```

Multiple instances, each with different default options.

```js
const strictsort = fuzzysort.new({threshold: -999})
```


### Changelog

#### v1.1.0
- Added `allowTypo` as an option

#### v1.0.0

- Inverted scores; they're now negative instead of positive, so that higher scores are better
- Added ability to search objects by `key`/`keys` with custom weights
- Removed the option to automatically highlight and exposed `fuzzysort.highlight`
- Removed all options from `fuzzysort` and moved them into `fuzzysort.go` optional params

#### v0.x.x

- init
