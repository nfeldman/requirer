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

// TODO Move all this AST Helper stuff to another file.

// map nodes I want to interact with to their childNodes collection, by name
ASTNode = {
    'Program':'body',
    'BlockStatement':'body',
    'VariableDeclaration':'declarations',
    'FunctionExpression':'params',  // NOT BEING USED YET
    'ObjectExpression':'properties'  // NOT BEING USED YET
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
                console.log(this.type ? this.type : '', 'does not have children');
        }
    },
    first: {
        get: function () {
            var c;
            if (this[ASTNode[this.type]])
                c = this.children;
                return !c || !c.length ? null : c[0];
        }
    },
    last: {
        get: function () {
            var c = this.children,
                i = c && c.length;
            return (!c || !idx) ? null : c[idx-1];
        }
    }
});

ASTNodeProto.append = function (node) {
    var c = this.children;
    c && c.push(node);
};

ASTNodeProto.prepend = function (node) {
    var c = this.children;
    c && c.unshift(node);
};

ASTNodeProto.indexOf = function (node) {
    var c = this.children;
    return c && c.length ? c.indexOf(node) : -1;
};

ASTNodeProto.splice = function (at, out, add) {
    var c = this.children;
    c && c.length && (add !== undef ? this.children.splice(at, out, add) : this.children.splice(at, out));
};

ASTNodeProto.removeChild = function (child) {
    var idx = this.indexOf(child);
    if (idx != -1)
        return this.splice(idx, 1);
};

ASTNodeProto.replaceChild = function (oldChild, newChild) {
    var idx = this.indexOf(oldChild);
    if (idx != -1)
        this.splice(idx, 1, newChild);
};

ASTNodeProto.insertBefore = function (refNode, newNode) {
    var idx = this.indexOf(refNode);
    if (idx != -1)
        this.splice(idx, 0, newChild);  
};

ASTNodeProto.insertAfter = function (refNode, newNode) {
    var idx = this.indexOf(refNode);
    if (idx > -1) {
        if (arguments.length > 2)
            [].splice.apply(this.children, [].slice.call(arguments, 1).unshift(0, ++idx));
        else
            this.splice(++idx, 0, newNode);
    }
};

/**
 * Utility that re-assigns the __proto__ reference of existing AST nodes based 
 * on their declared type to simplify manipulation without risking interfering
 * with code generation tools (escodegen) or expected JSON serialization.
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
Program.prototype = ASTNodeProto;


function VariableDeclaration () {
    this.type = 'VariableDeclaration';
    this.declarations = [];
    this.kind = 'var';
}
VariableDeclaration.prototype = ASTNodeProto;


function BlockStatement (body) {
    this.type = 'BlockStatement';
    this.body = body || [];
}
BlockStatement.prototype = ASTNodeProto;

function Identifier (name) {
    this.type = "Identifier";
    this.name = name;
}

function moduleDeclaration (moduleName) {
    return {
        "type": "VariableDeclarator",
        "id": new Identifier(moduleName),
        "init": {
            "type": "ObjectExpression",
            "properties": [
                {
                    "type": "Property",
                    "key": new Identifier("exports"),
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
                    new Identifier("module"), 
                    new Identifier("exports"), 
                    new Identifier("global"),
                    new Identifier("undef")
                ],
                "body": new BlockStatement(tree)
            },
            "arguments": [
                new Identifier(moduleName),
                {
                    "type": "MemberExpression",
                    "computed": false,
                    "object": new Identifier(moduleName),
                    "property": new Identifier("exports")
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
            "left": new Identifier(moduleName),
            "right": {
                "type": "MemberExpression",
                "computed": false,
                "object": new Identifier(moduleName),
                "property": new Identifier("exports")
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
     * @private      
     * @type {Object} 
     * @description a per node collection of edges, not shared among instances
     */
    this._requires = Object.create(null);
    /** 
     * @private      
     * @type {Array} 
     */
    this._requiredBy = [];
}

inherits(Mod, TNode);



/**
 * Loads the source of a module, adds the current module to the right array
 * in the _levels collection, determines if the source has already been seen,
 * and if necessary, calls Mod#loadRequired.
 * Mod#loadSrc is called by both Mod#load and Mod#_load
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
        console.log(e_divider);
        console.log('Exception caught when trying to load ' + path + ' from ' + this.parent.name + '.\n');
        // we want to stop processing now, but we don't need the stack trace
        // comment out if building for node, until dealing with node's files 
        // is handled correctly
        process.exit(1);
    }

    this.path = path;
   !this._levels[this.atLevel] && (this._levels[this.atLevel] = []);
    this._levels[this.atLevel].push(this);

    // find and, if necessary, create Mod instances for dependencies
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
    this.atLevel = 0;
    this.loadSrc(path, name);
};

/**
 * Prepares a new Mod and appends it to the current Mod. 
 * Called by Mod#loadRequired 
 * @private
 * @param  {string} path  Absolute path to the module js file
 * @param  {string} name  The name used as the identifier for the module
 * @param  {number} level Depth in the tree at which this appears
 * @return {Mod} The newly created module
 */
Mod.prototype._load = function (path, name, level) {
    var child = new Mod(name, this._mods, this._levels);
    child.atLevel = level;
    child.loadSrc(path, name, level);
    return child;
};


/**
 * Calls esprima.parse, assigns the result to this.ast, then applies the 
 * astDecorator utility to this tree
 * @param {Object} [config] esprima.parse config object
 * @return {this}
 */
Mod.prototype.parse = function (config) {
    var e;
    // if (!config)
    //     config = {
    //         comment: true,
    //         range: true,
    //         loc: false,
    //         tokens: true
    //     };
    try {
        this.ast = esprima.parse(this.src, config);
        astDecorator.call(this, this.ast);
    } catch(e) { // somewhat indiscriminate 
        console.error('\npath:', this.path, 
                      '\nname:', e.name, 
                      '\nmessage:', e.message, 
                      '\ntrace:', e.stack);
        console.log(e_divider);
    }
    return this;
};

// Most requires are relative to the file requiring them, this resolves the 
// absolute path.
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
 * Parses a module's source and traverses the resulting AST to locate and load
 * additional requried modules and remove references to already known modules.
 * WARNING very naive and simple
 * 
 * @return {this}
 */
Mod.prototype.loadRequired = function () {
    this.parse();

    each(getRequires(this.ast), function (r) {
        var name = r.require.name,
            path = this.toAbsPath(r.require.path);
    
        this._requires[name] = { path: path, mod: null };
        
        // if the required module has never been seen
        if (path && this._mods && !this._mods[path])
            this._mods[path] = {};
        
        // and/or it has not previously been seen with this name
        if (!this._mods[path][name])
            this._mods[path][name] = this._load(path, name, this.atLevel + 1);

        this._requires[name] = this._mods[path][name];
        this._mods[path][name]._requiredBy.push(this);
    }, this);
    return this;
};

// utilities used by subsequent methods of Mod


function isRequire (node) {
    var ret, arg;
    // personal perference, ONLY WRITE CODE THAT WILL BE MATCHED BY THE FIRST BRANCH. :) 
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


// utility called from Mod#build
function removeRequire (ast, seen, name) {
    var f = ast.first;    
    each(getRequires(ast), function (r) {
        var require = r.require,
            name = require.name,
            path = r.path;

        if (r.require.type == 'simple') {
            f.removeChild(require.node);
//            console.log('removing', name);

            if (!f.children.length && f == path[1][0]) {
//                console.log('removing empty declarations')
                path[1][1][1][0].removeChild(path[1][0]);
            }
        }
    });
}


/**
 * Where everything ends
 * @return {Object{src:'',ast:{}}} A map of src: the generated source,
 *                                          ast: the generated syntax tree
 */
Mod.prototype.build = function () {
    var levels = this._levels,
        i = levels.length,
        program = new Program(), // TODO the final format of the output
        vars = new VariableDeclaration(),
        seen = {},
        index, indexVars, l,
        current, e;


// TODO handle shadowed identifiers
// TODO handle requires in nested scopes
// TODO handle redundant var declarations
// TODO handle module.exports that don't need to capture anything in scope, 
//      e.g. the entire file consists of the thing that becomes module.exports
// TODO handle requires that is either part of an ObjectExpression, e.g. the
//      required thing is going to be a property of an object literal, or is
//      on the right side of an AssignmentExpression, either to an existing 
//      Identifier or to a MemberExpression
    program.append(vars);

    while (--i) {
        for (var j = 0, k = levels[i].length; j < k; j++) {
            current = levels[i][j];
            if (!seen[current.name]) {
//                console.log('JUST SAW:', current.name);
                vars.append(moduleDeclaration(current.name));
                try {
                    program.append(moduleBody(current.name, current.ast.body));
                } catch (e) {
                    console.log(e.message);
                    console.log(e.stack);
                    process.exit(1);
                }
                seen[current.name] = true;
            }
            // down to one per module, yay
            removeRequire(current.ast, seen, current.name);
            program.append(moduleClose(current.name));
        }
    }
    return {
        ast: program,
        src: escodegen.generate(program/*, { // TODO figure out how to keep
            comment: true,                 // comments from each module
            format: {
                indent: {
                    adjustMultilineComment: true
                }
            }
        }*/)
    };

};

// export everything that anything which uses Mod will also want to use
Mod.esprima = esprima;
Mod.escodegen = escodegen;
Mod.visit = visit;
Mod.each = each;
// and export Mod
module.exports = Mod;


