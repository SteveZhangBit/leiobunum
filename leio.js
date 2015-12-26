'use strict'

var fs = require('fs')
  , pkg = require('./package.json')
  , version = 'leiobunum ' + pkg['version']

exports.start = function (argv) {
  console.log('Start project...')
  console.log(argv)
}

exports.fetch = function (argv) {
  console.log('Fetch...')
  console.log(argv)
}

exports.run = function (argv) {
  var spider = argv[0] + '.js'
  fs.readdir('./spiders', function (err, files) {
    if (err) {
      console.log(err.message)
    } else if (files.indexOf(spider) === -1) {
      console.log('Error: No such spider')
      console.log('Run "leio list" to see available spiders')
    } else {
      require(process.cwd() + '/spiders/' + spider).run()
    }
  })
}

exports.list = function (argv) {
  fs.readdir('./spiders', function (err, files) {
    if (!err) {
      for (var i = 0; i < files.length; i++) {
        var name = files[i]
        console.log(name.slice(0, name.indexOf('.')) + '\t')
      }
    }
  })
}

exports.version = function () {
  console.log(version)
}

exports.printCmds = function () {
  console.log(version)
  console.log('\nUsage:')
  console.log('  leio <command> [options] [args]')
  console.log('\nAvailable commands:')
  console.log('  start           Create a new project')
  console.log('  feth            Fetch a URL using the default downloader')
  console.log('  run             Run a spider in the current project by name')
  console.log('  list            List all the spiders')
  console.log('  version         Print leiobunum version')
  console.log('\nUse leio <command> -h to see more info')
}

exports.printError = function (cmd) {
  console.log(version)
  console.log('\nUnknown command: ' + cmd)
  console.log('\nRun "leio" to see available commands')
}
