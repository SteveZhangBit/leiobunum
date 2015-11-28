# leiobunum
A scrapy like web spider written in Node.js

I haven't upload this project to npm, so by the time you can just download the source files to your project directory.

So you project directory may be some thing like this:

myproject
```
|
|--spiders/
|-----spider_1.js
|-----spider_2.js
|--node_modules/
|------leiobunum/
|----------lib/
|----------bin/
```
All the spider files should be under 'spiders' directory, just the same you will do with Scrapy.
You can copy the binary file leio under bin/ to your project directory, the run ./leio

>leiobunum x.x.x
>
>Usage:
>  leio <command> [options] [args]
>
>Available commands:
>  start           Create a new project
>  feth            Fetch a URL using the default downloader
>  run             Run a spider in the current project by name
>  list            List all the spiders under spiders directory
>  version         Print leiobunum version
>
>Use leio <command> -h to see more info

At the moment, only run, list and version are availble.

*This part I'll show how to create a basic spider, and I'll offer a simple example.*
Basic usage：
```
var leio = require('leiobunum')
var spider = leio.spider({
  name: 'name for this spider',
  allowedDomains: ['site.com'],
  startUrls: [
    'http://www.site.com',
    { // request can be a string or an object. 
      // I'm using request here, so any setting available in request is allowed here.
      // For more, see https://github.com/request/request
      url: 'http://www.anothersite.com',
      callback: 'parse2',  // set callback as 'parse2'
      meta: {}  // using this object to pass some parameters to the response
    }
  ],
  // custom settings for this spider. See more settings in lib/settings.js, they are just the same like in Scrapy
  settings: {
    LOG_LEVEL: 'DEBUG',
    DEPTH_LIMIT: 3,
    CONCURRENT_REQUESTS: 3,
    DOWNLOAD_DELAY: 2
  },

  // pipelines: [pipeline objects here],
  // downloaders: { '10': downloader middleware 1, '20': downloader middleware 2 },
  // middlewares: { '100': spider middleware 2, '200': spider middleware 2}

  parse: function (response, spider) {
    // $ is a cheerio instance which allows you to parse the html just like jQuery
    // see more from https://github.com/cheeriojs/cheerio
    var $ = response.$
    
    // response.yieldItem({ name: 'item name' })  // yield a item. An item can be any javascript object
    // response.yieldReponse('http://www.bing.com') // yield a new request
  },
  
  parse2: function (response, spider) {
    // you can define another parse callback, remember to set the request's callback name to this function
  }
})

module.exports = spider
```

###An example
Scraping some images from play.163.com. I'm using redis to be my custom task queue, so you need to have redis on your computer.

Create a file named yilei.js under spiders directory and copy the code beneath.
Run ./leio run yilei to start the spider.
Images will be downloaded under ./yilei. Have fun!!!

```
'use strict'

var leio = require('leiobunum')
  , redisQueue = leio.redisQueue

// create custom redis requests queue
var requestQueue = redisQueue({ name: 'yilei.redis.requests', timeout: 5 })

// create custom redis files queue for files pipeline
var fileQueue = redisQueue({ name: 'yilei.redis.files', timeout: 5 })
  , filesPipeline = leio.pipeline.filesPipeline(
      { pathToStore: './yilei/', concurrent: 12, queue: fileQueue.queue })

var spider = leio.spider({
  name: 'yilei',
  allowedDomains: ['163.com'],
  startUrls: [
    'http://tie.163.com/gt/15/0722/17/AV54MUBS00304IS3.html',
    'http://help.3g.163.com/15/0623/16/ASQEERTT00964JJI.html'
  ],
  settings: {
    LOG_LEVEL: 'DEBUG',
    // LOG_FILE: './log',
    DEPTH_LIMIT: 3,
    CONCURRENT_REQUESTS: 3,
    DOWNLOAD_DELAY: 2
  },

  pipelines: [filesPipeline],
  downloaders: { '10': requestQueue.uniqueDownloader, '20': requestQueue.cacheDownloader },
  queue: requestQueue.queue,

  parse: function (response, spider) {
    var $ = response.$
      , item = { fileUrls: [] }

    $('div#endText p.f_center img').each(function (i, el) {
      var img = $(el).attr('src')
      item.fileUrls.push(img)
    })
    item.fileDir = $('h1#h1title').text()
    if (item.fileUrls.length && item.fileDir.includes('福利')) {
      response.yieldItem(item)
    }

    $('ul.mod-f14list.ep-list-1.JS_NTES_LOG_FE li a').each(function (i, el) {
      response.yieldRequest($(el).attr('href'))
    })
  }
})

module.exports = spider
```
