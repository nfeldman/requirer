#!/usr/bin/env node
var each = require('./lib/each'),
    bundler = new (require('./components/Bundler')),
    path = require('path'),
    fs   = require('fs'),
    uglify = require('uglify-js'),
    argv = require('optimist')
        .usage('Package commonjs modules for the browser\nUsage: $0 -f ... -o ...')
        .demand(['f','o'])
        .alias('f', 'file')
        .alias('o', 'out')
        .describe('f', 'program main file')
        .describe('o', 'destination file')
        .argv,
    output = fs.createWriteStream(argv.o, {encoding: 'utf8'}),
    file = argv.f.split(path.sep),
    relativeID = '.' + path.sep + file.pop();

file = path.resolve(__dirname, file.join(path.sep));

if (~relativeID.indexOf('.js'))
    relativeID = relativeID.slice(0, -3);

bundler.onReady(function (err, modules) {
    each(modules.modules, function (m, k) {
        if (k == '__' ||  k == '__ordered')
            return;
        console.log('!!!module:', k);
        modules.modules[k] = uglify.minify(m, {fromString: true}).code;
    });
    var out = JSON.stringify(modules);

    output.write(out);
    output.end();
});

bundler.getModules(file, relativeID, path.resolve(file, '..' + path.sep), 0);