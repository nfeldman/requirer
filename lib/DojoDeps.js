// quick and dirty POC mostly reusing chunks of code from my requirer project
// should really have a properly designed configuralbe way to map dependencies
// in js projects, since there's only a few ways you can actually build these
// module systems in the first place.
// 
// At the moment, this builds trees, not graphs, so you don't get to see how
// often each file is actually required. You do get to generate a poset for
// load order -- although in the case of circular dependencies, this isn't
// guaranteed to be correct -- and you can also easily generate a showing the
// first time a module is encountered from an arbitrary starting point.

var fs = require('fs'),
    __path = require('path'),

    TNode    = require('./TNode'),
    inherits = require('./inherits'),
    each     = require('./each'),
    visit    = require('./visit'),

    esprima = require('esprima'),

    e_divider = '--------------------------------------------------------------------------------\n';


function deps (directorySeperator, packageMaps) {
    var _deps = Object.create(null),
        fixmap = packageMaps._fixMaps,
        basePaths;

    delete packageMaps._fixMaps;

    basePaths = Object.keys(packageMaps).sort(function (a, b) {return a.match(/[.]/g).length > b.match(/[.]/g).length ? -1 : 1});



    function Dep (name/*,_deps*/) {
        TNode.call(this);

        this.atLevel = 0;
        this._deps = arguments[1] || _deps;
        this.name = name;
        this.path = '';
        this.src  = '';
        this.ast  = null;
    }

    inherits(Dep, TNode);

    Dep.prototype.loadRequired = function () {
        this.parse();

        each(getRequires(this.ast), function (r) {
            var name = r.require.name,
                path;

            for (var i = 0, l = basePaths.length; i < l; i++) {
                if (!r.require.name.indexOf(basePaths[i]))
                    break;
            }

            path = __path.join(packageMaps[basePaths[i]], r.require.path);

            if (!this._deps[name]) {
                this._deps[name] = Object.create(null);
                this._deps[name] = !!this._load(path, name, this.atLevel + 1);
            }
        }, this);
        return this;
    };

    Dep.prototype.loadSrc = function (path, name) {
        var e;
        try {
            this.src = fs.readFileSync(path, 'utf8');

        } catch (e) {
            this.parent && console.log('parent module:', this.parent.name + ':', this.parent.path);
            console.log(e_divider);
            console.log('Exception caught when trying to load \npath: ' + path + '\nname: ' + name + '\n from: ' + 
                                                                 this.parent.name + '\nat: ' + this.parent.path,
                        'MESSAGE:', e.message);
            console.log('\nsource:', this.parent.src.slice(0, 2e3))
            process.exit(1);
        }

        this.path = path;
        this.loadRequired();
        return this;
    };

    Dep.prototype.load = function (path, name) {
        !name && (name = 'index');
        this.atLevel = 0;
        this.loadSrc(path, name);
    };

    Dep.prototype._load = function (path, name, level) {
        var child = new Dep(name, this._deps);
        child.atLevel = level;
        this.append(child);
        child.loadSrc(path, name, level);
        return child;
    };

    Dep.prototype.parse = function (config) {
        var e;
        try {
            this.ast = esprima.parse(this.src, config);
        } catch(e) {
            console.error('\npath:', this.path, '\nname:', e.name, '\nmessage:', e.message, '\ntrace:', e.stack);
            console.log(e_divider);
        }
        return this;
    };

    function isRequire (node) {
        var ret, arg;
        if (node && node.type) {
            if (node.type == 'ExpressionStatement' && 
                node.expression.type == 'CallExpression' && 
                node.expression.callee.type == 'MemberExpression' && 
                node.expression.callee.object.type == 'Identifier' &&
                node.expression.callee.object.name == 'dojo' &&
                node.expression.callee.property.type == 'Identifier' &&
                node.expression.callee.property.name == 'require' &&
                node.expression.arguments.length == 1) {
                    arg = node.expression.arguments[0].value.split('.').join(directorySeperator);
                    ret = {
                        type: '',
                        node: node,
                        name: node.expression.arguments[0].value,
                        path: /\.js$/.test(arg) ? arg : (arg + '.js')
                    };
            }
        }

        return ret || false;
    }

    /**
     * Return a collection of requires and the full path to locate them in the AST
     * @param  {Object} obj An AST Node, usually the root node
     * @return {Array} An array of objects 
     */
    function getRequires (obj) {
        var ret = [];
        visit(obj, function (obj, parent, path) {
            var required = isRequire(obj);
            if (required)
                ret.push({require:required, path:path.slice(0)});
        }, undefined, undefined, []);

        return ret;
    }

    Dep.prototype.sortDependencies = function () {
        var sorted = [];
        TNode.postorder(this, function (node) {sorted.push(node)});
        return this.sorted = sorted;
    };

    return Dep;
}

deps.preorder = TNode.preorder;
deps.postorder = TNode.postorder;
module.exports = deps;