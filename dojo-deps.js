var fs = require('fs'),
    path = require('path'),
    deps = require('./lib/DojoDeps'),
    each = require('./lib/each'),
    argparse = require('./lib/argparse'),

    config = {
        argSchema: {
            start: ['path to first file input','required'],
            base: ['path to json mapping packages to directories', 'required'],
            sort: [true, 'print dependencies as a partially ordered set to stdout'],
            list: [true, 'list dependencies of each file in the order it was encountered']
        },
        args: process.argv,
        options: null
    },
    options;

module.exports = function (conf) {
    for (var p in conf) 
        config[p] = conf[p];
    init();
};

function init () {
    var directorySeperator = /^win/.test(process.platform) ? '\\' : '/',
        base, Deps, name, root;

    // if this is the top level module and no args were provided, treat it
    // like a cry for help
    !module.parent && config.args.length == 2 && config.args.push('-h');
    options = config.options || argparse(config.argSchema)(config.args);
    
    base = fs.readFileSync(options.base, 'utf8');
    name = options.start.split(directorySeperator).pop();

    if (name.indexOf('.js') + 3 == name.length)
        name = name.slice(0, -3);

    Deps = deps(directorySeperator, JSON.parse(base));
    root = new Deps();

    root.load(path.resolve(__dirname, options.start));

    // each(root.sortDependencies(), function (dep) {
    //     console.log(dep.name);
    // });
    
    deps.preorder(root, function (node) {
        console.log(new Array(node.atLevel).join('    ') + node.name);
    });
}


// call init directly if this is the top level module
!module.parent && init();