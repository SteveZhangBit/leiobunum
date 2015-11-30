'use strict'

var util = require('util')
  , EventEmitter = require('events').EventEmitter

var Queue = function (options) {
  EventEmitter.call(this)

  this._q = []
  this._waiting = 0

  this.name = 'default'
  if (typeof options === 'object') {
    util._extend(this, options)
  }
}
util.inherits(Queue, EventEmitter)

Queue.prototype.push = function (val, callback) {
  this._q.push(val)
  if (this._waiting) {
    this.emit('' + this._waiting--, val)
  }
  if (callback) callback(null)
}

Queue.prototype.get = function (callback) {
  var _this = this
    , val = this._q.shift()

  if (val) {
    callback(null, val)
  } else {
    this.once('' + ++this._waiting, function (val) {
      _this.get(callback)
    })
  }
}

Queue.prototype.count = function (callback) {
  callback(null, this._q.length)
}

Queue.prototype.end = function () {}

module.exports = Queue
