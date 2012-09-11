var ASTNodeTypeToBodyNameMap = require('./typeToBodyNameMap'),

    /**
     * Object to use as the __proto__ for AST nodes
     * @type {Object}
     */
    ASTNodeProto = module.exports = Object.create(null);


Object.defineProperties(ASTNodeProto, {
    children: {
        get: function () {
            if (this[ASTNodeTypeToBodyNameMap[this.type]])
                return this[ASTNodeTypeToBodyNameMap[this.type]];
            else
                console.warn(this.type ? this.type : '', 'does not have children');
        }
    },
    first: {
        get: function () {
            var c;
            if (this[ASTNodeTypeToBodyNameMap[this.type]])
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
    c && c.length && (add !== undefined ? this.children.splice(at, out, add) : this.children.splice(at, out));
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