'use strict'

var util = require('util')
  , fs = require('fs')
  , path = require('path')
  , crypto = require('crypto')
  , httpRequest = require('request')
  , Q = require('q')

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
    pathToStore: null
  }

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
    var logger = spider.logger
      , signals = spider.signals
      , itemScheduler = spider.itemScheduler

    if (item['type'] === '__FILE__') {  // download the file of a task
      var task = item
        , deferred = Q.defer()

      // add delay here
      var delay = spider.settings.DOWNLOAD_DELAY * 1000
      if (spider.settings.RANDOMIZE_DOWNLOAD_DELAY) {
        delay *= Math.random() + 0.5
      }
      setTimeout(function () {
        logger.debug('Downloading from ' + task.url)
        httpRequest({ url: task.url, encoding: null, timeout: 30000 }, function (err, response) {
          if (err) {
            logger.error('Download failed for ' + task.url + ' with: ' + err.message)
          } else {
            if (!fs.existsSync(task.subpath)) {
              fs.mkdirSync(task.subpath)
            }
            fs.writeFile(task.filePath, response.body)
          }
          deferred.resolve([item, spider])
        })
      }, delay)

      return deferred.promise

    } else if (item['fileUrls']) {  // add file urls to item pipeline as new items
      var subpath = item['fileDir'] ? path.join(that.pathToStore, item['fileDir']) : that.pathToStore
      item['fileUrls'].forEach(function (url) {
        var filePath = path.join(subpath, _md5(url) + url.slice(url.lastIndexOf('.')))
        if (fs.existsSync(filePath) && fs.statSync(filePath).size > 512) {
          return
        }
        itemScheduler.push({ type: '__FILE__', url: url, subpath: subpath, filePath: filePath })
      })
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
