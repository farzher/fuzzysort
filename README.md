<div align="center">
<a href="https://raw.github.com/farzher/fuzzysort/master/fuzzysort.js">
  <img src="https://i.imgur.com/axkOMVs.png" alt="fuzzysort" />
</a>


<b>Fast, tiny, good fuzzy search for JavaScript.</b>
<br>
&lt;1ms for 13,000 files · 0 dependencies · clean ranking




## [Demo](https://farzher.github.io/fuzzysort/test/test.html)

[https://farzher.github.io/fuzzysort/test/test.html](https://farzher.github.io/fuzzysort/test/test.html)

![](https://i.imgur.com/muaw363.gif)

</div>




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
  import fuzzysort from 'https://cdn.jsdelivr.net/npm/fuzzysort@4.0.2/fuzzysort.min.js'
</script>
```


## Quick start

```js
const files = [
  {file: 'Guide.cpp'},
  {file: 'UserInterface.cpp'},
]

const results = fuzzysort.go('ui', files, {key: 'file'})

results[0].obj.file // 'UserInterface.cpp'
```




```js
fuzzysort.go(search, targets, {
  limit     : 10,   // Max results; 0 = unlimited
  threshold : .5,   // Minimum score; 0 = any match
  key       : null, // Search one property
  keys      : null, // Search multiple properties
  scoreFn   : null, // Override result scoring
})
```




## Results

```js
const result = fuzzysort.single('query', 'some string that contains my query.')
result.score   // .80 (1 is a perfect match. 0.5 is a good match. 0 is no match.)
result.target  // 'some string that contains my query.'
result.indexes // [29, 30, 31, 32, 33]
result.obj     // reference to your original obj when using options.key

result.highlight('<b>', '</b>') // 'some string that contains my <b>query</b>.'
result.highlight((m, i) => <react key={i}>{m}</react>)
```

### Advanced Usage - multiple complex keys - custom scoring

```js
const objects = [{
  title: 'Petaya Berry',
  meta: {desc: 'Raises Special Attack when HP is low.'},
  tags: ['berries', 'items'],
}, {
  title: 'Liechi Berry',
  meta: {desc: 'Raises Attack when HP is low.'},
  favorite: true,
}]

const targets = fuzzysort.snapshot(objects, {
  keys: ['title', 'meta.desc', obj => obj.tags?.join()],
})

const results = fuzzysort.go('attack berry', targets, {
  scoreFn: r => r.score * (r.obj.favorite ? 2 : 1),
})

const result = results[0]
result[0].highlight() // 'Liechi <b>Berry</b>'
result[1].highlight() // 'Raises <b>Attack</b> when HP is low.'
result.obj.title      // 'Liechi Berry'
```






## How To Go Fast! - Performance Tips!

Filter out targets you don't need to search! Especially long ones!

```js
let targets = [
  {file: 'Guide.cpp'},
  {file: 'UserInterface.cpp'},
].filter(t => t.file.length < 1000)
```

If your targets don't change, take an immutable `snapshot()` for the best performance!

```js
targets = fuzzysort.snapshot(targets, {key: 'file'})

fuzzysort.go('gotta', targets)
fuzzysort.go('go',    targets)
fuzzysort.go('fast',  targets)
```

If you can't snapshot, provide prepared targets instead of raw strings!

```js
targets.forEach(t => t.filePrepared = fuzzysort.prepare(t.file))

fuzzysort.go('fast', targets, {key: 'filePrepared'})
```










### Character remapping

Searches use NFKD normalization, strip diacritics, and remap common quote, dash, slash, ellipsis, and lookalike characters.

Add or override mappings with `fuzzysort.remap()`:

```js
fuzzysort.remap({',': '.'}) // 12,5 = 12.5
```


### Web Workers / cloned results

Structured cloning can remove the getters on results. For cloned results use:

```js
fuzzysort.score(result)
fuzzysort.highlight(result)
```


### Changelog

#### v4.0.0
- ESM instead of UMD
- Added `fuzzysort.snapshot()` for the best search performance
- Added `fuzzysort.score()` and `fuzzysort.highlight()` for Web Worker support
- Added `fuzzysort.remap()` for custom normalization
- Automatically remaps common lookalike characters
- Added default `threshold` and `limit`
- Improved multi-key highlighting
- Improved substring scoring
- Removed `options.all`; empty search now returns results
- `scoreFn` now works with all search modes
