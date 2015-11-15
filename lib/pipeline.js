'use strict'

var util = require('util')
  , fs = require('fs')
  , path = require('path')
  , crypto = require('crypto')
  , httpRequest = require('request')
  , Queue = require('./queue')

function pipeline(options) {
  var that = {}

  that.spiderOpened = function (spider) {}
  that.spiderClosed = function (reason, spider) {}
  that.processItem = function (item, spider) {}

  util._extend(that, options)

  return that
}

function filesPipeline(options) {
  var that = {
    pathToStore: null,
    concurrent: 16
  }
  var running = 0
    , queue = new Queue({ name: 'file pipeline' })

  if (typeof options === 'string') {
    // path should already exist
    that.pathToStore = options
  } else if (typeof options === 'object') {
    util._extend(that, options)
  }

  function _md5(data) {
    return crypto.createHash('md5').update(data).digest('hex')
  }

  function _processItem(item, spider) {
    function _getAllFromQueue() {
      var task = null
      while (running < that.concurrent && (task = queue.get())) {
        spider.logger.trace('<Queue ' + queue.name + '> running tasks ' + (++running))
        spider.logger.debug('Downloading from ' + task.url)
        httpRequest(task.url)
          .on('error', function (err) {
            spider.signals.spiderError(err, spider)
          })
          .on('response', function () {
            running--
            _getAllFromQueue()
          })
          .pipe(fs.createWriteStream(task.filePath))
      }
    }

    if (item['fileUrls']) {
      var subpath = item['fileDir'] ? path.join(that.pathToStore, item['fileDir']) : that.pathToStore

      if (!fs.existsSync(subpath)) {
        fs.mkdirSync(subpath)
      }

      item['fileUrls'].forEach(function (url) {
        var filePath = path.join(subpath, _md5(url) + url.slice(url.lastIndexOf('.')))
        if (fs.existsSync(filePath) && fs.statSync(filePath).size > 512) {
          return
        }
        queue.push({ url: url, filePath: filePath })
      })

      _getAllFromQueue()
    }
  }

  return pipeline({
    spiderOpened: function (spider) {
      if (!fs.existsSync(that.pathToStore)) {
        fs.mkdirSync(that.pathToStore)
      }
    },
    spiderClosed: function (reason, spider) {
      spider.logger.debug('Files all be downloaded in ' + that.pathToStore)
    },
    processItem: _processItem
  })
}

pipeline.filesPipeline = filesPipeline
module.exports = pipeline
