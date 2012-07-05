var TNode     = require('./TNode'),
    inherits = require('./inherits'),
    each     = require('./each'),
    visit    = require('./visit'),
    fs = require('fs'),

    esprima = require('esprima'),
    escodegen = require('escodegen'),

// not using this
    scopeInitializers = {
        Program: 1,
        FunctionDeclaration: 1,
        FunctionExpression: 1
    },

    e_divider = '--------------------------------------------------------------------------------\n',

    ASTNode, ASTNodeProto, undef;

function isRequire (node) {
    var arg;
    if (node && node.type == "VariableDeclarator" && 
        node.init && node.init.type  == "CallExpression" &&
        node.init.callee.type == "Identifier" &&
        node.init.callee.name == 'require' &&
        node.init.arguments[0].type == 'Literal') {
        arg = node.init.arguments[0].value;
        return {
            node: node,
            name: node.id.name, // the left side
            path: (/\.js$/.test(arg) ? arg : arg + '.js')/*,
            // TODO figure out how to insert comment mapping to source location
            ranges: {
                decl: {
                    range: [node.init.callee.range[0], node.range[1] + 1]
                }
            }*/
        };
    }

    return false;
}

/**
 * Return a collection of requires and the full path to locate the in the AST
 * @param  {Object} obj An AST Node, usually the root node
 * @return {Array} An array of objects 
 */
function getRequires (obj) {
    var ret = [];
    visit(obj, function (obj, parent, path) {
        var required = isRequire(obj);
        if (required)
            ret.push({require:required, path:path});
    }, undef, undef, []);

    return ret;
}


// map nodes I want to interact with to their childNodes collection, by name
ASTNode = {
    'Program':'body',
    'BlockStatement':'body',  // NOT BEING USED
    'VariableDeclaration':'declarations',
    'FunctionExpression':'params',  // NOT BEING USED
    'ObjectExpression':'properties'  // NOT BEING USED
};

/**
 * Object to use as the __proto__ for AST nodes
 * @type {Object}
 */
ASTNodeProto = Object.create(null);

// provides a consistent interface for OO style manipulation of some AST nodes
Object.defineProperties(ASTNodeProto, {
    children: {
        get: function () {
            if (this[ASTNode[this.type]])
                return this[ASTNode[this.type]];
            else
                console.log(this.type?this.type:'','does not have children');
        }
    },
    first: {
        get: function () {
            if (this[ASTNode[this.type]])
                return !this.children.length ? null : this.children[0];
            else
                console.log(this.type?this.type:'','does not have children');
        },
        enumerable: false
    },
    last: {
        get: function () {
            var idx;
            if (this[ASTNode[this.type]]) {
                if (!this.children || !this.children.length)
                    return null;

                idx = this.children.length - 1;
                return (idx > -1) ? this.children[idx] : null;
            } else {
                console.log(this.type?this.type:'','does not have children');
            }
        },
        enumerable: false
    } // NOT BEING USED
});

ASTNodeProto.append = function (node) {
    this.children && this.children.push(node);
};

ASTNodeProto.indexOf = function (node) {
    return this.children.indexOf(node);
};

ASTNodeProto.splice = function (at, out, add) {
    add !== undef ? this.children.splice(at, out, add) : this.children.splice(at, out);
};

ASTNodeProto.removeChild = function (child) {
    var idx = this.indexOf(child);
    if (0 > idx)
        throw new Error('NO SUCH CHILD');
    return this.splice(idx, 1);
};

ASTNodeProto.replaceChild = function (oldChild, newChild) {
    var idx = this.indexOf(oldChild);
    if (0 > idx)
        throw new Error('NO SUCH CHILD');
    this.splice(idx, 1, newChild);
}; // NOT BEING USED

ASTNodeProto.insertBefore = function (refNode, newNode) {
    var idx = this.indexOf(refNode);
    if (0 > idx)
        throw new Error('NO SUCH CHILD');
    this.splice(idx, 0, newChild);  
}; // NOT BEING USED

ASTNodeProto.insertAfter = function (refNode, newNode) {
    var idx = this.indexOf(refNode);
    if (0 > idx)
        throw new Error('NO SUCH CHILD');
    if (arguments.length > 2)
        [].splice.apply(this.children, [].slice.call(arguments, 1).unshift(0, ++idx));
    else
        this.splice(++idx, 0, newNode);
}; // NOT BEING USED

/**
 * Utility that re-assigns the __proto__ pointer of existing AST nodes based 
 * on their declared type to simplify manipulation without risking interfering
 * with code generation tools (escodegen) or serialization.
 * @param  {Object} root Starting point in the AST
 * @return {undefined}
 */
function astDecorator (root) {
    visit(root, function (node) {
        if (typeof node == 'object' && node.type && 
          typeof ASTNode[node.type] != 'undefined' &&
          !(node.__proto__ == ASTNodeProto)) {
            node.__proto__ = ASTNodeProto;
        }
    });
}

// things with which to build the output
function Program () {
    this.type = "Program";
    this.body = [];
}

Program.prototype.append = function (val) {
    this.body.push(val);
};

function VariableDeclaration () {
    this.type = 'VariableDeclaration';
    this.declarations = [];
    this.kind = 'var';
}

VariableDeclaration.prototype.append = function (val) {
    this.declarations.push(val);
};

// TODO make this configurable?
function moduleDeclaration (moduleName) {
    return {
        "type": "VariableDeclarator",
        "id": {
            "type": "Identifier",
            "name": moduleName
        },
        "init": {
            "type": "ObjectExpression",
            "properties": [
                {
                    "type": "Property",
                    "key": {
                        "type": "Identifier",
                        "name": "exports"
                    },
                    "value": {
                        "type": "ObjectExpression",
                        "properties": []
                    },
                    "kind": "init"
                }
            ]
        }
    };
}

function moduleBody (moduleName, tree) {
    return {
        "type": "ExpressionStatement",
        "expression": {
            "type": "CallExpression",
            "callee": {
                "type": "FunctionExpression",
                "id": null,
                "params": [
                    {
                        "type": "Identifier",
                        "name": "module"
                    },
                    {
                        "type": "Identifier",
                        "name": "exports"
                    },
                    {
                        "type": "Identifier",
                        "name": "global"
                    }
                ],
                "body": {
                    "type": "BlockStatement",
                    "body": tree
                }
            },
            "arguments": [
                {
                    "type": "Identifier",
                    "name": moduleName
                },
                {
                    "type": "MemberExpression",
                    "computed": false,
                    "object": {
                        "type": "Identifier",
                        "name": moduleName
                    },
                    "property": {
                        "type": "Identifier",
                        "name": "exports"
                    }
                },
                {
                    "type": "ThisExpression"
                }
            ]
        }
    };
}

function moduleClose (moduleName) {
    return {
        "type": "ExpressionStatement",
        "expression": {
            "type": "AssignmentExpression",
            "operator": "=",
            "left": {
                "type": "Identifier",
                "name": moduleName
            },
            "right": {
                "type": "MemberExpression",
                "computed": false,
                "object": {
                    "type": "Identifier",
                    "name": moduleName
                },
                "property": {
                    "type": "Identifier",
                    "name": "exports"
                }
            }
        }
    };
}


/**
 * Creates a Node for a dependency tree
 * @Class 
 * @extends TNode
 * @param {string} name Module identifier
 * @return {Mod}
 */
 

// TODO determine whether v8 can optimize args when they're not declared, just
// pulled from `arguments` . . . my guess is no
function Mod (name/*,_mods, _levels*/) {
    TNode.call(this); // seems a bit too heavy for what I'm doing?
    this.atLevel = 0; // what level this module is first seen at
    this.name = name; // file name without the extension
    this.root = null; // array representation of absolute path
    this.path = '';   // string representation of absolute path
    this.src  = '';   // string representation of source code
    this.ast  = null; // ast of source, this gets modified a lot
    /**
     * @protected
     * @type {Object} 
     * @description shared by all nodes in a scope
     */
    this._mods = arguments[1] || Object.create(null);

    /**
     * @protected
     * @type {Array}
     * @description shared by all nodes in a tree
     */
    this._levels = arguments[2] || [];

    /**
     * Tracks variables that that are visible from the current module's scope
     * @type {Object}
     */
    // this.visibleVars = {}; // NOT CURRENTLY USED
    /** 
     * @private      
     * @type {Object} 
     * @description a per node collection of edges, not shared among instances
     */
    // this._requires = Object.create(null); // NOT CURRENTLY USED
}

inherits(Mod, TNode);



/**
 * Calls esprima.parse, assigns the result to this.ast, then applies the 
 * astDecorator utility to this tree
 * @param {Object} [config] esprima.parse config object
 * @return {undefined}
 */
Mod.prototype.parse = function (config) {
    var e;

    try {
        this.ast = esprima.parse(this.src, config);
        astDecorator.call(this, this.ast);
    } catch(e) { // somewhat indiscriminate 
        console.error('path:', this.path, 
                      '\nname:', e.name, 
                      '\nmessage:', e.message, 
                      '\ntrace:', e.stack);
        console.log(e_divider);
    }
};

// Most requires are relative to the file requiring them, this resolves the absolute path.
// TODO proper path handling for Windows directory seperator
Mod.prototype.toAbsPath = function (path) {
    var r = path.split('/'),
        c = this.root.slice(0),
        f = r.pop(),
        seg;

    while (seg = r.shift()) {
        switch (seg) {
            case '..':
                c.pop();
            case '.':
            case '': 
              break;
            default:
                c.push(seg);
        }
    }

    c.push(f);
    c[0].indexOf('/') != 0 && (c[0] = '/' + c[0]);
    return c.join('/');
};

 
/**
 * Prepares a new Mod and appends it to the current Mod. 
 * Called by Mod#loadRequired 
 * @private
 * @param  {string} path  Absolute path to the module js file
 * @param  {string} name  The name used as the identifier for the module
 * @param  {number} level Depth in the tree at which this appears
 * @return {undefined}
 */
Mod.prototype._load = function (path, name, level) {
    var child = new Mod(name, this._mods, this._levels);
    child.atLevel = level||0;
    !this._levels[level] && (this._levels[level] = []);
    this.append(child);
    child.loadSrc(path, name, level||0);
};

/**
 * Loads the source of a module, adds the current module to the right array
 * in the _levels collection, determines if the source has already been seen,
 * and if necessary, calls Mod#loadRequired.
 * Mod#loadSrc is called by both Mod#load and Mod#_load
 * @param  {string} path  The absolute path to this module's source
 * @param  {number} level Current tree depth
 * @return {this}
 */
Mod.prototype.loadSrc = function (path, name, level) {
    var e;
    // each module has an array of directories between it and the system root
    if (!this.root && path.indexOf('/') == 0)
        this.root = path.slice(1, path.lastIndexOf('/')).split('/');

    try {
        this.src = fs.readFileSync(path, 'utf8');
        this.path = path;
        this.loadRequired(++level);
        return this;
    } catch (e) {
        console.log(e_divider);
        console.log('Exception caught when trying to load ' + path + ' from ' + this.parent.name + '.\n');
        // we want to stop processing now, but we don't need the stack trace
//        process.exit(0);            
    }


};



/**
 * Parses a module's source and traverses the resulting AST to locate and load
 * additional requried modules and remove references to already known modules.
 * WARNING very naive and simple
 * 
 * Process so far:
 * 1. Get all dependencies for this module (all the requires)
 *     caveate: only checks var assignment right now, not member assignments,
 *     so it will miss things like
 *       module.exports = {ucfirst:require('../string/ucfirst')}
 * 2. Prune the AST of requires that we should already know about
 * 3. For any remaining require, load it
 * 
 * @param  {number} level The depth of the current node in the tree of modules
 * @return {this}
 */

// TODO deal with scope properly
// TODO handle requires at greater depths
// TODO handle shadowed identifiers
Mod.prototype.loadRequired = function (level) {
    var requires, e;
   !this._levels[level-1] && (this._levels[level-1] = []);
    this._levels[level-1].push(this);
    // create or re-create the AST
    this.parse();

    requires = getRequires(this.ast);

    if (requires) {
        each(requires, function (r) {
            var name = r.require.name,
                path = this.toAbsPath(r.require.path);

            // if the required module has never been seen
            if (path && this._mods && !this._mods[path])
                this._mods[path] = {};
            // and/or it has not previously been seen with this name
            if (!this._mods[path][name]) {
                this._mods[path][name] = this;
                this._load(path, name, level);
            } else {
                // remove redundant declaration ... am I absolutely sure at 
                // this point that it is redundant?
                if (r.path && r.path.length > 1 && r.path[1][0] && r.path[1][0].type == "VariableDeclaration") {
                    console.log(r.path)
                    if (r.path[1][0].indexOf(r.require.node) > -1) {
                        //console.log('removing:', r.require.node);
                        r.path[1][0].removeChild(r.require.node);
                    }
                    if (!r.path[1][0].children.length && r.path[1][1][1][0].first == r.path[1][0]) {
                        r.path[1][1][1][0].removeChild(r.path[1][0]);
                    }
                }
            }
        }, this);
    }
    return this;
};

/**
 * Where everything starts, the public Mod#load
 * @param  {string} path Path to the root module
 * @return {undefined}
 */
Mod.prototype.load = function (path) {
    this.loadSrc(path);
};

/**
 * Where everything ends
 * @return {string} The generated program
 */
Mod.prototype.build = function () {
    var levels = this._levels,
        i = levels.length,
        program = new Program(), // TODO the final format of the output
        vars = new VariableDeclaration(),
        seen = {},
        current;


// TODO handle shadowed identifiers
// TODO handle requires in nested scopes
// TODO handle redundant var declarations
// TODO handle module.exports that don't need to capture anything in scope, 
//      e.g. the entire file consists of the thing that becomes module.exports

// TODO with some modifications, I could build each module to include its
// dependencies within its own scope and only elevate one if it is required by
// multiple modules ?

    program.append(vars);

    while (i--) {
        for (var j = 0, k = levels[i].length; j < k; j++) {
            current = levels[i][j];
            visit(current.ast, function (node, path) {
                var requires = getRequires(node);

                each(requires, function (r) {
                    var name = r.require.name,
                        path = this.toAbsPath(r.require.path);
                    if (seen[name]) {
                        console.log('seen it');
                        // I'm honestly not sure why this is needed, but I've
                        // missed some requires in loadRequired
                        if (r.path && r.path.length > 1 && r.path[1][0] && r.path[1][0].type == "VariableDeclaration") {
                            if (r.path[1][0].indexOf(r.require.node) > -1) {
                                r.path[1][0].removeChild(r.require.node);
                            }
                            if (!r.path[1][0].children.length && r.path[1][1][1][0].first == r.path[1][0]) {
                                r.path[1][1][1][0].removeChild(r.path[1][0]);
                            }
                        }
                    }
                }, this);
            }, undef, current, []);
            seen[current.name] = true;
//            console.log(current.name, current.path)
            vars.append(moduleDeclaration(current.name));
            program.append(moduleBody(current.name, current.ast.body));
            program.append(moduleClose(current.name));
        }
    }


    return {
        ast: program,
        src: escodegen.generate(program)
    };

};

// export everything that anything which uses Mod will also want to use
Mod.esprima = esprima;
Mod.escodegen = escodegen;
Mod.visit = visit;
Mod.each = each;
// and export Mod
module.exports = Mod;


