'use strict'

var util = require('util')
  , EventEmitter = require('events').EventEmitter

var Scheduler = function (options) {
  EventEmitter.call(this)

  this.name = 'default'
  this.concurrent = 16
  this.running = 0

  this._q = []
  this._waiting = 0

  if (typeof options === 'object') {
    util._extend(this, options)
  }
}
util.inherits(Scheduler, EventEmitter)

Scheduler.prototype._push = function (val, callback) {
  this._q.push(val)
  callback(null)
}

Scheduler.prototype.push = function (val, callback) {
  var _this = this
  this._push(val, function (err) {
    if (!err) {
      if (_this._waiting) { _this.emit('' + _this._waiting--, val) }
      if (callback) { callback(null) }
    }
  })
}

Scheduler.prototype._get = function (callback) {
  callback(null, this._q.shift())
}

Scheduler.prototype.get = function (callback) {
  var _this = this
  this._get(function (err, val) {
    if (!err && val) {
      callback(null, val)
    } else {
      _this.once('' + ++_this._waiting, function (val) {
        _this.get(callback)
      })
    }
  })
}

Scheduler.prototype.count = function (callback) {
  callback(null, this._q.length)
}

Scheduler.prototype.start = function () {
  for (var i = 0; i < this.concurrent; i++) {
    this._schedule()
  }
}

Scheduler.prototype._schedule = function () {
  var _this = this
  this.get(function (err, val) {
    _this.running++
    if (!err && val) {
      _this.schedule(val)
    } else {
      _this.next()
    }
  })
}

Scheduler.prototype.next = function () {
  this.running--
  this._schedule()
}

Scheduler.prototype.end = function () {
  console.log(this.name + ' will shutdown')
}

module.exports = Scheduler
