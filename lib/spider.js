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

var Spider = function (options) {
  this.name = 'leio'
  this.allowedDomains = []
  this.startUrls = []
  this.settings = defSettings

  this.middlewares = []
  this.pipelines = []
  this.downloaders = []
  this.signals = new Signals()
  this.queue = new Queue({ name: 'request' })

  if (typeof options === 'object') {
    if (typeof options.settings === 'object') {
      options.settings = util._extend(defSettings, options.settings)
    }
    util._extend(this, options)
  }

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
          { type: 'file', filename: settings.LOG_FILE, category: this.name }
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

Spider.prototype._setDownloaders = function () {
  var signals = this.signals
    , downloaders = baseDownloaders.concat(this.downloaders)

  signals.on('request scheduled', function (request, spider) {
    downloaders.reduce(function (soFar, downloader) {
      return soFar.spread(function (request, spider) {
        var r = downloader.processRequest(request, spider)
        return r ? r : [request, spider]
      })
    }, Q([request, spider]))
    .spread(function (request, spider) {
      httpRequest(spider._requestOptions(request), function (err, response) {
        if (err) {
          signals.spiderError(err, spider)
        } else {
          signals.responseDownloaded(request, response, spider)
        }
      })
    })
    .fail(function (err) {
      if (err.message === 'request dropped') {
        signals.requestDropped(request, spider)
      } else {
        signals.spiderError(err, spider)
      }
    })
    .done()
  })

  signals.on('response downloaded', function (request, response, spider) {
    downloaders.reduce(function (soFar, downloader) {
      return soFar.spread(function (request, response, spider) {
        var r = downloader.processResponse(request, response, spider)
        return r ? r : [request, response, spider]
      })
    }, Q([request, response, spider]))
    .spread(function (request, response, spider) {
      // add yield methods
      response['yieldRequest'] = function (options) {
        signals.requestYield(spider._makeRequest(options), response, spider)
      }
      response['yieldItem'] = function (item) {
        signals.itemYield(item, spider)
      }
      // add meta attribute
      response['meta'] = {}
      signals.responseReceived(request, response, spider)
    })
    .fail(function (err) {
      signals.spiderError(err, spider)
    })
    .done()
  })
}

Spider.prototype._setMiddlewares = function () {
  var signals = this.signals
    , middlewares = baseMiddlewares.concat(this.middlewares)
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
    .fail(function (err) {
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
    .fail(function (err) {
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
    .fail(function (err) {
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
    .fail(function (err) {
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
    .fail(function (err) {
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
