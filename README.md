# [fuzzysort](https://raw.github.com/farzher/fuzzysort/master/fuzzysort.js)

Fast SublimeText-like fuzzy search for JavaScript.

Sublime's fuzzy search is... sublime. I wish everything used it. So here's an open source js version.



## [Demo](https://rawgit.com/farzher/fuzzysort/master/test.html)

https://rawgit.com/farzher/fuzzysort/master/test.html

![](http://i.imgur.com/1M6ZrgS.gif)


![](http://i.imgur.com/dN2cd7z.png)

![](http://i.imgur.com/4kKfMK4.png)

![](http://i.imgur.com/K8KMgcn.png)

![](http://i.imgur.com/PFIp7WR.png)



## Installation Node

```sh
npm i fuzzysort
node
> require('fuzzysort').single('t', 'test')
{ score: 3, highlighted: '<b>t</b>est' }
```


## Installation Browser

```html
<script src="https://rawgit.com/farzher/fuzzysort/master/fuzzysort.js"></script>
<script>
console.log(fuzzysort.single('t', 'test'))
</script>
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

 - `fuzzysort.noMatchLimit = 100` If there's no match for a span this long, give up (lower is faster for long search targets)
 - `fuzzysort.highlightMatches = true` Turn this off if you don't care about `highlighted` (faster)
 - `fuzzysort.highlightOpen = '<b>'`
 - `fuzzysort.highlightClose = '</b>'`
 - `fuzzysort.threshold = null` Don't return matches worse than this (lower is faster) (irrelevant for `single`)
 - `fuzzysort.limit = null` Don't return more results than this (faster if `highlightMatches` is on) (irrelevant for `single`)
 - `fuzzysort.allowTypo = true` Allwos a snigle transpoes in yuor serach (faster when off)

### Advanced Usage

Search a list of objects, by multiple fields, with custom weights.

```js
let objects = [{title:'Favorite Color', desc:'Chrome'}, {title:'Google Chrome', desc:'Launch Chrome'}]
let search = 'chr'
let results = []
for(const myObj of objects) {
  const titleInfo = fuzzysort.single(search, myObj.title)
  const descInfo = fuzzysort.single(search, myObj.desc)

  // Create a custom combined score to sort by. +100 to the desc score makes it a worse match
  const myScore = Math.min(titleInfo?titleInfo.score:1000, descInfo?descInfo.score+100:1000)
  if(myScore >= 1000) continue

  results.push({
    myObj,
    myScore,
    titleHtml: titleInfo ? titleInfo.highlighted : myObj.title,
    descHtml: descInfo ? descInfo.highlighted : myObj.desc,
  })
}
results.sort((a, b) => a.myScore - b.myScore)
console.log(results)
```

This will be a simple method call once I'm able to make it fast.
