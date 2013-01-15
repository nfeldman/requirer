var fs = require('fs'),

    TNode    = require('./TNode'),
    inherits = require('./inherits'),
    each     = require('./each'),
    visit    = require('./visit'),

    parser = require('acorn'),
    e_divider = '--------------------------------------------------------------------------------\n';


/**
 * Creates a Node for a dependency tree
 * @Class 
 * @extends TNode
 * @param {string} name Module identifier
 * @return {Mod}
 */

function Mod (name/*,_mods*/) {
    TNode.call(this); // inherit TNode ownProperties
    this._mods   = arguments[1] || Object.create(null); // shared lookup
    this.name = name; // file name without the extension
    this.root = null; // array representation of absolute path
    this.path = '';   // string representation of absolute path
    this.src  = '';   // string representation of source code
    this.ast  = null; // ast of source, this gets modified a lot
}

inherits(Mod, TNode);

// Most requires are relative to the file requiring them, this resolves the 
// absolute path.
// TODO proper path handling for Windows directory seperator
Mod.prototype.toAbsPath = function (path) {
    var segments = path.split('/'),
        filename = segments.pop(),
        cwdcopy  = this.root.slice(0),
        seg;

    while (seg = segments.shift()) {
        switch (seg) {
            case '..':
                cwdcopy.pop();
            case '.':
            case '': 
              break;
            default:
                cwdcopy.push(seg);
        }
    }

    cwdcopy.push(filename);
    cwdcopy[0].indexOf('/') != 0 && (cwdcopy[0] = '/' + cwdcopy[0]);
console.log(path + ':', cwdcopy.join('/'))
    return cwdcopy.join('/');
};


/**
 * Parses a module's source and traverses the resulting AST to locate and load
 * additional requried modules and remove references to already known modules.
 * currently very naive and simple (applies to entire project)
 * 
 * @return {this}
 */
Mod.prototype.loadRequired = function () {
    this.parse();

    each(getRequires(this.ast), function (r) {
        var name = r.require.name,
            path = this.toAbsPath(r.require.path);
        
        // if the required module has never been seen
        if (path && this._mods && !this._mods[path])
            this._mods[path] = Object.create(null);
        
        // and/or it has not previously been seen with this name
        if (!this._mods[path][name])
            this._mods[path][name] = !!this._load(path, name);
    }, this);
    return this;
};

/**
 * Loads the source of a module and calls Mod#loadRequired.
 * @param  {string} path  The absolute path to this module's source
 * @return {this}
 */
Mod.prototype.loadSrc = function (path, name) {
    var e;
    // each module has an array of directories between it and the system root
    if (!this.root && path.indexOf('/') == 0)
        this.root = path.slice(1, path.lastIndexOf('/')).split('/');

    try {
        this.src = fs.readFileSync(path, 'utf8');
    } catch (e) {
        console.log('parent module:', this.parent.name + ':', this.parent.path);
        console.log(e_divider);
        console.log('Exception caught when trying to load ' + path + ' from ' + 
                                                             this.name + '.\n',
                    'MESSAGE:', e.message);
        process.exit(1);
    }

    this.path = path;
    this.loadRequired();
    return this;
};


/**
 * Where everything starts, the public Mod#load
 * @param  {string} path Path to the root module
 * @return {undefined}
 */
Mod.prototype.load = function (path, name) {
    !name && (name = 'index');
    this.loadSrc(path, name);
};

/**
 * Prepares a new Mod and appends it to the current Mod.
 * @private
 * @param  {string} path  Absolute path to the module js file
 * @param  {string} name  The name used as the identifier for the module
 * @return {Mod} The newly created module
 */
Mod.prototype._load = function (path, name) {
    var child = new Mod(name, this._mods);
    this.append(child);
    child.loadSrc(path, name, level);
    return child;
};


/**
 * Calls esprima.parse, assigns the result to `this.ast`, then applies the 
 * astDecorator utility to `this.ast`
 * @param {Object} [config] esprima.parse config object
 * @return {this}
 */
Mod.prototype.parse = function (config) {
    var e;
    // if (!config)
    //     config = { // TODO comments
    //         comment: true,
    //         range: true,
    //         loc: false,
    //         tokens: true
    //     };
    try {
        this.ast = esprima.parse(this.src, config);
        astDecorator.call(this, this.ast);
    } catch(e) {
        console.error('\npath:', this.path, '\nname:', e.name, '\nmessage:', e.message, '\ntrace:', e.stack);
        console.log(e_divider);
    }
    return this;
};


// -------- utilities used by subsequent methods of Mod ------

// TODO handle shadowed identifiers
// TODO handle requires in nested scopes
function isRequire (node) {
    var ret, arg;
    if (node && node.type) { // var foo = require('./some/module')
        if (node.type == "VariableDeclarator" && 
          node.init && node.init.type  == "CallExpression" &&
          node.init.callee.name == 'require' &&
          node.init.arguments[0].type == 'Literal') {
            arg = node.init.arguments[0].value;
            ret = {
                type: 'simple', // need to call it something... TODO better names?
                node: node,
                name: node.id.name,
                path: (/\.js$/.test(arg) ? arg : arg + '.js')/*,
                // TODO figure out how to insert comment mapping to source location
                //      after figuring out how to preserve comments
                ranges: {
                    decl: {
                        range: [node.init.callee.range[0], node.range[1] + 1]
                    }
                }*/
            };
        } else if (node.type == 'ExpressionStatement' && node.expression.type && 
          node.expression.type == 'AssignmentExpression' && node.expression.right && 
          node.expression.right.type == 'CallExpression' && node.expression.right.callee.name == 'require' && 
          node.expression.left) {
            arg = node.expression.right.arguments[0].value;
            ret =  {
                type: '',
                node: node,
                name: '',
                path: (/\.js$/.test(arg) ? arg : arg + '.js')
            };
            // var foo; foo = require('./some/module') <-- maybe just avoid this form?
            if(node.expression.left.type == 'Identifier') {
                ret.type = 'assignToExistingVar'; // name sucks? this'll do for now?
                ret.name = node.expression.left.name;
            } else if (node.expression.left.type == 'MemberExpression') {
                // var baz = {foo: require('./some/module')} // possible, but annoying
                ret.type = 'assignToObjectLiteral'; // name :( but good enough
                ret.name = node.left; // TODO how to handle this one?
            }
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


// utility called from Mod#build
function removeRequire (ast, seen, name) {
    var f = ast.first;

    each(getRequires(ast), function (r) {
        var require = r.require,
            name = require.name,
            path = r.path;

    // TODO be able to handle modules that don't put all the requires at the top
        if (r.require.type == 'simple')
            f.removeChild(require.node);

        if (!f.children.length && f == path[1][0])
            path[1][1][1][0].removeChild(path[1][0]);

    });
}


// ------- remaining methods of Mod ------
// can't we build the sorted array in loadRequired as we build the tree?
// TODO figure out whether we can't do this while we construct the tree
Mod.prototype.sortDependencies = function () {
    var sorted = [];
    TNode.postorder(this, function (node) {sorted.push(node)});
    return this.sorted = sorted;
}

/**
 * Where everything ends
 * @param {string} [] Zero or more additional formal parameters to add to a module
 * @return {Object{src:'',ast:{}}} A map of src: the generated source,
 *                                          ast: the generated syntax tree
 */
Mod.prototype.build  = function (/*params*/) {
    var dependencies = this.sortDependencies(),
        l = dependencies.length,
        i = 0,
        program = new Program(),
        vars = new VariableDeclaration(),
        seen = {}, // might not need this anymore
        body, // each module body
        params = [].map.call(arguments, function (name) {
            return new Identifier(name);
        }),
        addParams = params && params.length,
        current, e;

// TODO handle redundant var declarations

    program.append(vars);

    for (; i < l; i++) {
        current = dependencies[i];
        if (!seen[current.name]) {
            try {
                body = moduleBody(current.name, current.ast.body);
                addParams && [].push.apply(body.expression.callee.params, params);
                vars.append(moduleDeclaration(current.name));
                program.append(body);
                program.append(moduleClose(current.name));
                removeRequire(current.ast, seen, current.name);
            } catch (e) {
                console.log(e.message);
                console.log(e.stack);
                process.exit(1);
            }
            seen[current.name] = true;
        }
    }

    return {
        ast: program,
        src: escodegen.generate(program, {
            comment:true,
            compact:true
        }) // TODO figure out how to keep comments from each module
    };

};

// export everything that anything which uses Mod will also want to use
Mod.esprima = esprima;
Mod.escodegen = escodegen;
Mod.visit = visit;
Mod.each  = each;
// and export Mod
module.exports = Mod;


