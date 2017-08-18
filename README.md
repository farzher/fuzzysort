# [fuzzysort](https://raw.github.com/farzher/fuzzysort/master/fuzzysort.js)

Fast SublimeText-like fuzzy search for node or the browser.



## [Demo](https://rawgit.com/farzher/fuzzysort/master/test.html)

![](http://i.imgur.com/tleIW3b.gif)



## Installation Node

```
npm i fuzzysort
node
> require('fuzzysort').go('t', 'test')
{ score: 0.003, highlighted: '<b>t</b>est' }
```


## Installation Browser

```html
<script src="fuzzysort.js"></script>
```




## Usage

### `fuzzysort.go(search, target)`

```js
fuzzysort.go('query', 'some string that contains my query.')
// {score: 0.059, highlighted: "some string that contains my <b>query</b>."}

fuzzysort.go('query', 'irrelevant string') // null

// exact match returns a score of 0. lower score is better
fuzzysort.go('query', 'query') // {score: 0, highlighted: "<b>query</b>"}
```

### `fuzzysort.goArray(search, targets)`

```js
fuzzysort.goArray('mr', ['Monitor.cpp', 'MeshRenderer.cpp'])
// [{score: 0.018, highlighted: "<b>M</b>esh<b>R</b>enderer.cpp"}
// ,{score: 6.009, highlighted: "<b>M</b>onito<b>r</b>.cpp"}]
```

### `fuzzysort.goArrayAsync`

```js
let promise = fuzzysort.goArrayAsync('mr', ['Monitor.cpp', 'MeshRenderer.cpp'])
promise.then(results => console.log(results))
if(invalidated) promise.cancel()
```

##### Options

 - `fuzzysort.noMatchLimit = 100` If there's no match for a span this long, give up
 - `fuzzysort.highlightMatches = true` Turn this off if you don't care about `highlighted`
 - `fuzzysort.highlightOpen = '<b>'`
 - `fuzzysort.highlightClose = '</b>'`
