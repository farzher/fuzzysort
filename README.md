# [fuzzysort](https://raw.github.com/farzher/fuzzysort/master/fuzzysort.js)

Fast SublimeText-like fuzzy search for JavaScript.



## [Demo](https://rawgit.com/farzher/fuzzysort/master/test.html)

https://rawgit.com/farzher/fuzzysort/master/test.html

![](http://i.imgur.com/tleIW3b.gif)


![](http://i.imgur.com/dN2cd7z.png)

![](http://i.imgur.com/4kKfMK4.png)



## Installation Node

```
npm i fuzzysort
node
> require('fuzzysort').single('t', 'test')
{ score: 3, highlighted: '<b>t</b>est' }
```


## Installation Browser

```html
<script src="fuzzysort.js"></script>
```




## Usage

### `fuzzysort.single(search, target)`

```js
fuzzysort.single('query', 'some string that contains my query.')
// {score: 59, highlighted: "some string that contains my <b>query</b>."}

fuzzysort.single('query', 'irrelevant string') // null

// exact match returns a score of 0. lower score is better
fuzzysort.single('query', 'query') // {score: 0, highlighted: "<b>query</b>"}
```

### `fuzzysort.go(search, targets)`

```js
fuzzysort.go('mr', ['Monitor.cpp', 'MeshRenderer.cpp'])
// [{score: 18, highlighted: "<b>M</b>esh<b>R</b>enderer.cpp"}
// ,{score: 6009, highlighted: "<b>M</b>onito<b>r</b>.cpp"}]
```

### `fuzzysort.goAsync(search, targets)`

```js
let promise = fuzzysort.goAsync('mr', ['Monitor.cpp', 'MeshRenderer.cpp'])
promise.then(results => console.log(results))
if(invalidated) promise.cancel()
```

##### Options

 - `fuzzysort.noMatchLimit = 100` If there's no match for a span this long, give up
 - `fuzzysort.highlightMatches = true` Turn this off if you don't care about `highlighted`
 - `fuzzysort.highlightOpen = '<b>'`
 - `fuzzysort.highlightClose = '</b>'`
 - `fuzzysort.limit = null` Don't return more results than this (improve performance by not highlighting everything)
