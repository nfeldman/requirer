var fs = require('fs'),
    path = require('path'),
    deps = require('./lib/DojoDeps'),
    each = require('./lib/each'),
    argparse = require('./lib/argparse'),

    config = {
        argSchema: {
            start: ['path to first file input','required'],
            rootname: ['name of the root package'],
            pmaps: ['path to json mapping packages to directories', 'required'],
            list: [true, 'list dependencies of each file in the order it was encountered'],
            output: ['choose what to return to stdout, options are:\t1) flattened poset \t2) pretty printed poset (default), \t3) formatted tree, \t4) big ball of json.']
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
        pmaps, Deps, root, ballOfJson = {
            nodes:[],
            edges:[]
        };

    // if this is the top level module and no args were provided, treat it
    // like a cry for help
    !module.parent && config.args.length == 2 && config.args.push('-h');
    options = config.options || argparse(config.argSchema)(config.args);
    !options.output && (options.output = 2);

    try { // ... sorry
        pmaps = JSON.parse(fs.readFileSync(options.pmaps, 'utf8'));
    } catch (e) {
        console.error('no pmaps provided');
        process.exit(1);
    }

    Deps = deps(directorySeperator, pmaps);
    root = new Deps(options.rootname);

    root.load(path.resolve(__dirname, options.start));

    switch (+options.output) {
        case 1:
            console.log(root.sortDependencies().map(function (dep) {return dep.name}).join(', ').slice(0, -2));
          break;
        case 3:
            deps.preorder(root, function (node) {
                if (!node.name)
                    console.log(options.start + ':');
                else
                    console.log(new Array(node.atLevel + 1).join('    ') + node.name);
            });
          break;
        case 4: // gets us a structure that should work as input in the d3 force directed graph example
            each(root.sortDependencies(), function (node) {

                if (node._deps[node.name]) {
                var id = node._deps[node.name].id;
                    
                    ballOfJson.nodes.push({
                        name : node.name,
                        id   : id,
                        group: node._deps[node.name].group
                    });

                    for (var i = 0, edges = node.edges, l = edges.length; i < l; i++) {
                        ballOfJson.edges.push({
                            from: id,
                            to: node._deps[edges[i]].id
                        });
                    }
                } // in theory, only the actual root entry will not be in _deps
            });
            console.log(JSON.stringify(ballOfJson));
          break;
        case 5: // gets us something that should work as input in the d3 hive plots example
          (function (){
            // this bit is a bit hacky
            var groups = Object.keys(pmaps).sort(function (a, b) {
                    return a./*match(/[.]/g).*/length > b./*match(/[.]/g).*/length ? -1 : 1
                }),
                gmap = groups.join(''),
                offsets = Object.create(null),
                i = 0, l = groups.length, last = 0;

            for ( ; i < l; i++) {
                last = gmap.indexOf(groups[i], last);
                offsets[i] = groups[i].slice(0, -1);
            }

            console.log(JSON.stringify(root.sortDependencies().map(function (dep) {
                var group = dep._deps[dep.name] ? offsets[dep._deps[dep.name].group] : false;
                return {
                    name: dep.name,
                    group: group || 'root',
                    imports: dep.edges
                };
            }).sort(function (a, b) {return a.name > b.name ? 1 : -1})));
          }());
          break;
        case 2:
        default:
            each(root.sortDependencies(), function (dep) {
                console.log(!dep.name ? ('\n\n\tare required to use:\n' + options.start) : (new Array(dep.atLevel + 1).join('    ') + dep.name));
            });
    }
    

}


// call init directly if this is the top level module
!module.parent && init();