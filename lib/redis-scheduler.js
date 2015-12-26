'use strict'

var redis = require('redis')
  , util = require('util')
  , Q = require('q')
  , downloader = require('./downloader')
  , Scheduler = require('./scheduler')

function cacheDownloader(options) {
  var client = null
    , expire = options.expire || 3600 // default expire time: 1 hour

  function _spiderOpened(spider) {
    client = redis.createClient(options.port || 6379,
      options.host || '127.0.0.1', options.redis)
    client.on('error', function (err) {
      spider.logger.error('<CacheDownloader>: ' + err.message)
    })
  }

  function _spiderClosed(reason, spider) {
    client.end()
  }

  function _processRequest(request, spider) {
    var deferred = Q.defer()
    client.get(request.url, function (err, val) {
      if (!err && val) {
        deferred.reject(new Error('request dropped'))

        spider.logger.debug('response cached for ' + request.url)
        var response = JSON.parse(val)
        response.body = new Buffer(response.body.data)
        spider.signals.responseDownloaded(request, response, spider)
      } else {
        deferred.resolve([request, spider])
      }
    })
    return deferred.promise
  }

  function _processResponse(request, response, spider) {
    client.exists(request.url, function (err, val) {
      if (!err && !val) {
        client.set(request.url, JSON.stringify(response))
        client.expire(request.url, expire)
      }
    })
  }

  return downloader({
    spiderOpened: _spiderOpened,
    spiderClosed: _spiderClosed,
    processRequest: _processRequest,
    processResponse: _processResponse
  })
}

function uniqueDownloader(options) {
  var client = null

  function _spiderOpened(spider) {
    client = redis.createClient(options.port || 6379,
      options.host || '127.0.0.1', options.redis)
    client.on('error', function (err) {
      spider.logger.error('<UniqueDownloader>: ' + err.message)
    })
  }

  function _spiderClosed(reason, spider) {
    client.del(spider.scheduler.name + '.set', function (err, val) {
      client.end()
    })
  }

  function _processRequest(request, spider) {
    var deferred = Q.defer()
      , scheduler = spider.scheduler
    client.sismember(scheduler.name + '.set', request.url, function (err, val) {
      if (err) {
        deferred.reject(err)
      } else if (val) {
        deferred.reject(new Error('request dropped'))
      } else {
        client.sadd(scheduler.name + '.set', request.url)
        deferred.resolve([request, spider])
      }
    })
    return deferred.promise
  }

  return downloader({
    spiderOpened: _spiderOpened,
    spiderClosed: _spiderClosed,
    processRequest: _processRequest
  })
}

exports.scheduler = function (options) {
  var RedisScheduler = function (_options) {
    Scheduler.call(this, _options)

    this._client = redis.createClient(options.port || 6379,
      options.host || '127.0.0.1', options.redis)
    this._consumer = redis.createClient(options.port || 6379,
      options.host || '127.0.0.1', options.redis)
    this._client.on('error', function (err) {
      console.error(err.message)
    })
    this._consumer.on('error', function (err) {
      console.error(err.message)
    })
  }
  util.inherits(RedisScheduler, Scheduler)

  RedisScheduler.prototype._push = function (val, callback) {
    this._client.lpush(this.name, JSON.stringify(val), callback)
  }

  RedisScheduler.prototype._get = function (callback) {
    this._consumer.brpop(this.name, 0, function (err, val) {
      if (!err) {
        try {
          val = JSON.parse(val[1])
        } catch (e) {
          err = e
        }
      }
      callback(err, val)
    })
  }

  RedisScheduler.prototype.stop = function () {
    this._client.del(this.name)
    this.status = 'stop'
  }

  RedisScheduler.prototype.end = function () {
    this._client.end()
    this._consumer.end()
  }

  RedisScheduler.prototype.count = function (callback) {
    this._client.llen(this.name, callback)
  }

  return RedisScheduler
}
exports.cacheDownloader = cacheDownloader
exports.uniqueDownloader = uniqueDownloader
