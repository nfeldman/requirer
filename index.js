var fs = require('fs'),  
    // util = require('util'),
    path = require('path'),

    Mod = require('./lib/Mod'),
    each = Mod.each,
    argparse = require('./lib/argparse'),

    watch = require('watch'),
    // set defaults to use when this module is executed from the cli
    config = {
        argSchema: {
            index: ['path to first file input','required'],
            dev: ['d', 'build a file full of document.writeLn\'s for local dev \033[31mNOT IMPLEMENTED\033[39m'],
            verbose:['v', true, 'spew details'],
            params: ['comma delimited string of additional formal parameters for the IIFE in which a module is defined'],
            saveAs: ['path to final output file','required'],
            format: ['f', 'final module format, e.g. amd or amd-cjs-global. ' +
                          'If a global is created, its name will match the output ' +
                          "file's name \033[31mNOT IMPLEMENTED\033[39m"],
            es3: ['3', true, 'convert es5 to es3, see docs for supported conversions \033[31mNOT IMPLEMENTED\033[39m'],
            watch: ['w', true, 'whether to watch module files for changes']
        },
        // defaults
        args: process.argv,
        options: null,

        // TODO figure out how to actually use templates for this?
//        moduleIntro: path.resolve(__dirname, './tmpls/intro.tmpl.js'),
//        moduleOutro: path.resolve(__dirname, './tmpls/outro.tmpl.js')

    },
    options,
    output,
    rootdir;


// TODO grok the finer points of the LLJS project, I think it has much for
// me to learn. https://github.com/mbebenita/LLJS/blob/master/src/compiler.js

// export a module to allow calling this from within another script
// the conf object, if provided, will override defaults
module.exports = function (conf) {
    for (var p in conf) 
        config[p] = conf[p];
    init();
}

function init () {
    var name;
    // if this is the top level module and no args were provided, treat it
    // like a cry for help
    !module.parent && config.args.length == 2 && config.args.push('-h');
    options = config.options || argparse(config.argSchema)(config.args);

    name = options.index.split('/').pop();
    if (name.indexOf('.js') + 3 == name.length)
        name = name.slice(0, -3);

    // root of tree
    mainModule = new Mod(name);

    mainModule.load(path.resolve(__dirname, options.index), name);


    if (options.es3) {
        // do something to the ast
    }

    function updateBuild () {
        console.time('saving build');
        output = options.params ? mainModule.build.apply(mainModule, options.params.split(',')) : mainModule.build();
        fs.writeFileSync(options.saveAs, output.src, 'utf8');
        console.timeEnd('saving build');
    }

    // TODO it shouldn't be necessary to re-process everything
    // let's try for something a little less brute force, at some point?
    // WARNING: I just threw in file watching via a module, I don't yet know 
    // if using it the way I am here is entirely safe.
    // 
    if (options.watch) {
        rootdir = path.resolve(__dirname, options.index);
        watch.createMonitor(rootdir.slice(0, rootdir.lastIndexOf('/')), {ignoreDotFiles:true}, function (monitor) {
            // monitor.files = mainModule.sorted;
            monitor.on("changed", function (f, curr, prev) {
              updateBuild();
            });
            monitor.on("removed", function (f, stat) {
              updateBuild();
            });
        })


    }

    if (options.saveAs) {
        updateBuild();

    }

}

// call init directly if this is the top level module
!module.parent && init();