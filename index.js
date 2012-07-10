var fs = require('fs'),  
    util = require('util'),
    path = require('path'),

    Mod = require('./lib/Mod'),
    each = Mod.each,
    argparse = require('./lib/argparse'),
    

    // set defaults to use when this module is executed from the cli
    config = {
        argSchema: {
            index: ['path to first file input','required'],
            verbose:['v', true, 'spew details'],
            saveAs: ['path to final output file','required'],
            format: ['f', 'final module format, e.g. amd or amd-cjs-global. ' +
                          'If a global is created, its name will match the output ' +
                          "file's name \033[31mNOT IMPLEMENTED\033[39m"],
            es3: ['3', true, 'convert es5 to es3, see docs for supported conversions \033[31mNOT IMPLEMENTED\033[39m'],
            watch: ['w', true, 'whether to watch module files for changes \033[31mNOT IMPLEMENTED\033[39m']
        },
        // defaults
        args: process.argv,
        options: null,

        // TODO figure out how to actually use templates for this?
//        moduleIntro: path.resolve(__dirname, './tmpls/intro.tmpl.js'),
//        moduleOutro: path.resolve(__dirname, './tmpls/outro.tmpl.js')

    },
    options,
    output;


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
    output = mainModule.build();

options.v && each(mainModule._mods, function (val, key) {
        console.log(key);
        each(val, function (val1, key1) {
            console.log('  - ', key1, ' depends on ', val1._requires)
        })
    })

    if (options.es3) {
        // do something to the ast
    }

// TEMPORARY HACK
var left = '(function (global, undef) {\n',
    right = '\n}(this));';

    // if (options.saveAs) {
    //     fs.writeFileSync(options.saveAs, output.src, 'utf8');
    // }

}

// call init directly if this is the top level module
!module.parent && init();