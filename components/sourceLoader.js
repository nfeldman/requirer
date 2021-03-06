/**
 * @fileOverview The guts of a module loader to quickly prepare
 * nodejs style modules for various task, but especially to
 * serve to browsers.
 */

var fs      = require('fs'),
    __path  = require('path'),
    each    = require('../lib/each'),
    mix     = require('../lib/mix'),
    onReady = require('../lib/onReady'),
    parser  = require('acorn'),
    getRequires = require('../lib/getRequires');

function Mod () {
    this.source   = '';
    this.location = '';
    this.identity = '';
    this.timesSeen = 0;
}

module.exports = function (path, relativeID, root) {
    var deps     = Object.create(null),
        jobTotal = 0,
        jobDone  = 0,
        rootLen  = root.length,
        rootPath = __path.resolve(__dirname, path, relativeID + '.js'),
        modules = {
            deps: deps,
            root: rootPath.slice(rootLen, -3),
            callbacks: [],
            isReady: false,
            modules: Object.create(null),
            getSorted: function () {
                var seen   = {},
                    sorted = [];
                function visit (name) {
                    if (seen[name])
                        return;
                    seen[name] = true;
                    for (var i = 0, l = deps[name].length; i < l; i++)
                        visit(deps[name][i]);
                    sorted.push(name);
                }
                visit(this.identity);
                return sorted;
            }
        };
console.log('\npath:', path, '\nrelativeID:', relativeID, '\nroot:', root)
    Mod.call(modules);
    mix(onReady, modules);

    load(rootPath, relativeID, root, modules, true);
    return modules;

    function load (path, relativeID, root, parent, isRoot) {
        var resolvedID = !path.indexOf(root) && path.slice(rootLen, -3),
            module;

        if (!resolvedID) {// TODO real error handling
            console.log(arguments)
            throw Error('dude');
        }

        !deps[resolvedID] && (deps[resolvedID] = []);

        if (parent && parent.source) {
            // TODO use ranges from acorn + arrays to build one final string
            // rather than the n replacements this will require. It may or may not
            // be faster, but it will definitely be more robust.
            parent.source = parent.source.replace(RegExp('\\(\\s*[\'"]' + relativeID + '[\'"]\\s*\\)', 'g'), "('" + resolvedID + "')");
        }

        if (parent && parent.identity)
            deps[parent.identity].push(resolvedID);

        if (modules.modules[resolvedID])
            return ++modules.modules[resolvedID].timesSeen;

        ++jobTotal;

        modules.modules[resolvedID] = !isRoot ? new Mod() : parent;
        module = modules.modules[resolvedID];
        module.location = path;
        module.identity = resolvedID;
        ++module.timesSeen;

        fs.readFile(path, 'utf8', function (err, data) {
            if (err) // TODO real error handling
                return console.error(err);
            module.source = data;
            loadDependencies(module, path, root);
            ++jobDone;

            if (jobDone == jobTotal)
                modules.ready();
            return module;
        });
    }

    function loadDependencies (module, path, root) {
        // module.ast = parser.parse(module.source);
        try {
            var ast = parser.parse(module.source);
        } catch (e) {
            console.log('parsing', path);
            console.error(e.message, e.stack);
        }

        each(getRequires(ast), function (r) {
            var cwdsegments, abspath;

            if (!r.node)
                return;

            cwdsegments = path.slice(1).split('/');
            cwdsegments.pop();
            abspath = resolvePathTo(r.id, cwdsegments);
            abspath += '.js';
            load(abspath, r.id, root, module);
        });
    }

    function resolvePathTo (identifier, cwd) {
        var segments = identifier.split('/'),
            filename = segments.pop(),
            seg;

        while (seg = segments.shift()) {
            if (!seg || seg == '.')
                continue;

            if (seg == '..')
                cwd.pop();
            else
                cwd.push(seg);
        }

        cwd.push(filename);
        cwd[0].indexOf('/') != 0 && (cwd[0] = '/' + cwd[0]);

        return cwd.join('/');
    }
};