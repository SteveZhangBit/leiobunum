# leiobunum
A scrapy like web spider written in Node.js

Basic usage：
```
var leio = require('leiobunum')
var spider = leio.spider({
  name: 'name for this spider',
  allowedDomains: ['site.com'],
  startUrls: [
    'http://www.site.com',
    { // request can be a string or an object. 
      // I'm using request here, so any setting available in request is allowed  here
      url: 'http://www.anothersite.com',
      callback: 'parse2'  // set callback as 'parse2'
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
