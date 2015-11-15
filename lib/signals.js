'use strict'

var events = require('events')
  , util = require('util')

var Signals = function () {
  events.EventEmitter.call(this)
}
util.inherits(Signals, events.EventEmitter)

Signals.prototype.spiderOpened = function (spider) {
  var logger = spider.logger

  logger.debug('<Signals> spider ' + spider.name + ' opened')
  this.emit('spider opened', spider)
}

Signals.prototype.spiderClosed = function (reason, spider) {
  var logger = spider.logger

  logger.debug('<Signals> spider ' + spider.name + ' closed for reason "' + reason + '"')
  this.emit('spider closed', reason, spider)
}

Signals.prototype.spiderError = function (err, spider) {
  var logger = spider.logger

  logger.error('<Signals> spider error:\n' + err.stack)
  this.emit('spider error', err, spider)
}

Signals.prototype.responseReceived = function (request, response, spider) {
  var logger = spider.logger

  logger.trace('<Signals> response received')
  this.emit('response received', request, response, spider)
}

Signals.prototype.itemYield = function (item, spider) {
  var logger = spider.logger

  logger.trace('<Signals> item yield: ' + JSON.stringify(item))
  this.emit('item yield', item, spider)
}

Signals.prototype.itemScraped = function (item, spider) {
  var logger = spider.logger

  logger.trace('<Signals> item scraped')
  this.emit('item scraped', item, spider)
}

Signals.prototype.itemDropped = function (item, spider) {
  var logger = spider.logger

  logger.trace('<Signals> item dropped')
  this.emit('item dropped', item, spider)
}

Signals.prototype.requestYield = function (request, response, spider) {
  var logger = spider.logger

  logger.trace('<Signals> request yield: ' + request.url)
  this.emit('request yield', request, response, spider)
}

Signals.prototype.requestScheduled = function (request, spider) {
  var logger = spider.logger

  logger.debug('<Signals> request scheduled: ' + request.url)
  this.emit('request scheduled', request, spider)
}

Signals.prototype.requestDropped = function (request, spider) {
  var logger = spider.logger

  logger.trace('<Signals> request dropped: ' + request.url)
  this.emit('request dropped', request, spider)
}

module.exports = Signals
