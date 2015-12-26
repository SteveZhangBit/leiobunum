'use strict'

var fs = require('fs')
  , pkg = require('./package.json')
  , version = 'leiobunum ' + pkg['version']
  , leio = require('./index')
  , repl = require('repl')

exports.start = function (argv) {
  var project = argv[0]
  if (!project) {
    console.log('\nUsage:')
    console.log('  leio start <project name>')
    return
  }

  fs.mkdirSync(project)
  fs.readFile(__dirname + '/default-settings.js', function (err, data) {
    fs.writeFile(project + '/settings.js', data)
  })
  fs.readFile(__dirname + '/default-pipelines.js', function (err, data) {
    fs.writeFile(project + '/pipelines.js', data)
  })
  fs.mkdirSync(project + '/spiders')
}

exports.fetch = function (argv) {
  var url = argv[0]
  var spider = leio.spider({
    startUrls: [url],

    parse: function (response, spider) {
      console.log(response.$.html())
    }
  })

  spider.run()
}

exports.shell = function (argv) {
  var url = argv[0]
  var spider = leio.spider({
    startUrls: [url],

    parse: function (response, spider) {
      var replServer = repl.start({
        prompt: 'leiobunum> '
      })

      replServer.context.request = spider._makeRequest(url)
      replServer.context.response = response
    }
  })

  spider.run()
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
  console.log('  shell           Interactive scraping console')
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
