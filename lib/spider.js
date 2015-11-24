'use strict'

var util = require('util')
  , log4js = require('log4js')
  , Q = require('q')
  , defSettings = require('./settings')
  , Signals = require('./signals')
  , baseMiddlewares = require('./middleware').baseMiddlewares
  , baseDownloaders = require('./downloader').baseDownloaders
  , Queue = require('./queue')
  , httpRequest = require('request')

function _sortDict(dict) {
  var items = Object.keys(dict).map(function (key) {
    return [parseInt(key), dict[key]]
  })
  return items.sort(function (x, y) {
    return x[0] - y[0]
  }).map(function (i) {
    return i[1]
  })
}

var Spider = function (options) {
  this.name = 'leio'
  this.allowedDomains = []
  this.startUrls = []
  this.settings = defSettings

  this.middlewares = {}
  this.pipelines = []
  this.downloaders = {}
  this.signals = new Signals()
  this.queue = new Queue({ name: 'requests' })

  if (typeof options === 'object') {
    if (typeof options.settings === 'object') {
      options.settings = util._extend(defSettings, options.settings)
    }
    util._extend(this, options)
  }

  this._running = 0
  this._setLogger()
  this._setDownloaders()
  this._setMiddlewares()
  this._setPipelines()
}

Spider.prototype._setLogger = function () {
  var settings = this.settings

  if (settings.LOG_ENABLED) {
    if (settings.LOG_FILE) {
      log4js.configure({
        appenders: [
          // { type: 'console' },
          { type: 'file', filename: settings.LOG_FILE }
        ],
        replaceConsole: settings.LOG_STDOUT
      })
    } else {
      log4js.configure({
        appenders: [
          { type: 'console' }
        ],
        replaceConsole: settings.LOG_STDOUT
      })
    }
  }
  this.logger = log4js.getLogger(this.name)
  this.logger.setLevel(settings.LOG_LEVEL)
}

Spider.prototype._schedule = function () {
  var _this = this
    , queue = this.queue
    , signals = this.signals
    , logger = this.logger

  queue.get(function (err, request) {
    if (!err && request) {
      logger.trace('<Queue ' + queue.name + '> running requests ' + (++_this._running))
      signals.requestScheduled(request, _this)
    }
  })
}

Spider.prototype._setDownloaders = function () {
  var signals = this.signals
    , downloaders = _sortDict(util._extend(baseDownloaders, this.downloaders))
    , logger = this.logger
    , settings = this.settings
    , queue = this.queue

  signals.on('request scheduled', function (request, spider) {
    function _retry(request) {
      if (settings.RETRY_ENABLED &&
          (!request.meta['retry'] || request.meta['retry'] < settings.RETRY_TIMES)) {
        request.meta['retry'] = (request.meta['retry'] || 0) + 1
        queue.push(request)
      }
    }

    downloaders.reduce(function (soFar, downloader) {
      return soFar.spread(function (request, spider) {
        var r = downloader.processRequest(request, spider)
        return r ? r : [request, spider]
      })
    }, Q([request, spider]))
    .spread(function (request, spider) {
      var deferred = Q.defer()
      if (!request.meta['retry']) {
        logger.debug('Requesting from ' + request.url)
      } else {
        logger.debug('Retry site ' + request.url + ' for ' + request.meta['retry'] + ' times')
      }
      httpRequest(spider._requestOptions(request), function (err, response) {
        if (err) {
          deferred.reject(err)
          _retry(request)
        } else if (settings.RETRY_HTTP_CODES.indexOf(response.statusCode) !== -1) {
          deferred.reject(new Error('[HTTP ERROR] ' + response.statusCode))
          _retry(request)
        } else {
          signals.responseDownloaded(request, response, spider)
          deferred.resolve()
        }
      })
      return deferred.promise
    })
    .catch(function (err) {
      if (err.message === 'request dropped') {
        signals.requestDropped(request, spider)
      } else {
        signals.spiderError(err, spider)
      }
    })
    .fin(function () {
      --spider._running
      spider._schedule()
    })
    .done()
  })

  signals.on('response downloaded', function (request, response, spider) {
    var promise = Q.fcall(function (request, response, spider) {
      // add yield methods
      response['yieldRequest'] = function (options) {
        signals.requestYield(spider._makeRequest(options), response, spider)
      }
      response['yieldItem'] = function (item) {
        signals.itemYield(item, spider)
      }
      // add meta attribute
      response['meta'] = request.meta

      return [request, response, spider]
    }, request, response, spider)

    downloaders.reduce(function (soFar, downloader) {
      return soFar.spread(function (request, response, spider) {
        var r = downloader.processResponse(request, response, spider)
        return r ? r : [request, response, spider]
      })
    }, promise)
    .spread(function (request, response, spider) {
      signals.responseReceived(request, response, spider)
    })
    .catch(function (err) {
      signals.spiderError(err, spider)
    })
    .done()
  })
}

Spider.prototype._setMiddlewares = function () {
  var signals = this.signals
    , middlewares = _sortDict(util._extend(baseMiddlewares, this.middlewares))
    , queue = this.queue

  signals.on('response received', function (request, response, spider) {
    middlewares.reduce(function (soFar, middleware) {
      return soFar.spread(function (request, response, spider) {
        var r = middleware.processInput(request, response, spider)
        return r ? r : [request, response, spider]
      })
    }, Q([request, response, spider]))
    .spread(function (request, response, spider) {
      spider[request.callback](response, spider)
    })
    .catch(function (err) {
      signals.spiderError(err, spider)
    })
    .done()
  })

  signals.on('request yield', function (request, response, spider) {
    middlewares.reduce(function (soFar, middleware) {
      return soFar.spread(function (request, response, spider) {
        var r = middleware.processOutput(request, response, spider)
        return r ? r : [request, response, spider]
      })
    }, Q([request, response, spider]))
    .spread(function (request, response, spider) {
      var deferred = Q.defer()
      queue.push(request, function (err) {
        if (err) {
          deferred.reject(err)
        } else {
          deferred.resolve([request, response, spider])
        }
      })
      return deferred.promise
    })
    .catch(function (err) {
      if (err.message === 'request dropped') {
        signals.requestDropped(request, spider)
      } else {
        signals.spiderError(err, spider)
      }
    })
    .done()
  })
}

Spider.prototype._setPipelines = function () {
  var signals = this.signals
    , pipelines = this.pipelines

  signals.on('spider opened', function (spider) {
    pipelines.reduce(function (soFar, pipeline) {
      return soFar.then(function (spider) {
        var r = pipeline.spiderOpened(spider)
        return r ? r : spider
      })
    }, Q(spider))
    .catch(function (err) {
      signals.spiderError(err, spider)
    })
    .done()
  })

  signals.on('spider closed', function (reason, spider) {
    pipelines.reduce(function (soFar, pipeline) {
      return soFar.spread(function (reason, spider) {
        var r = pipeline.spiderClosed(reason, spider)
        return r ? r : [reason, spider]
      })
    }, Q([reason, spider]))
    .catch(function (err) {
      signals.spiderError(err, spider)
    })
    .done()
  })

  signals.on('item yield', function (item, spider) {
    pipelines.reduce(function (soFar, pipeline) {
      return soFar.spread(function (item, spider) {
        var r = pipeline.processItem(item, spider)
        return r ? r : [item, spider]
      })
    }, Q([item, spider]))
    .spread(function (item, spider) {
      signals.itemScraped(item, spider)
    })
    .catch(function (err) {
      if (err.message === 'item dropped') {
        signals.itemDropped(item, spider)
      } else {
        signals.spiderError(err, spider)
      }
    })
    .done()
  })
}

Spider.prototype.startRequests = function () {
  var requests = []
    , _this = this

  this.startUrls.forEach(function (url) {
    requests.push(_this._makeRequest(url))
  })
  return requests
}

Spider.prototype._makeRequest = function (options) {
  var request = {
    headers: this.settings.DEFAULT_REQUEST_HEADERS,
    encoding: null, // If null, the body is returned as a Buffer
    callback: 'parse',
    meta: {}
  }

  if (typeof options === 'string') {
    request['url'] = options
  } else if (typeof options === 'object') {
    util._extend(request, options)
  }
  return request
}

Spider.prototype._requestOptions = function (request) {
  var copy = util._extend({}, request)
  delete copy.callback
  delete copy.meta
  return copy
}

Spider.prototype.dropItem = function () {
  throw new Error('item dropped')
}

Spider.prototype.dropRequest = function () {
  throw new Error('request dropped')
}

module.exports = Spider
