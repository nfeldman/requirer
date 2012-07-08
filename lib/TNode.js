/**
 * @fileOverview A constructor for objects from which to build trees of n-arity
 *               + the standard depth-first, recursive traversal functions
 * @author  Noah Feldman
 */


/**
 * For a node with pointers to parent, first and last child, and previous 
 * and next sibling nodes, for easy to navigate rooted trees. Tnode insertion
 * via append, prepend, before, or after will enforce tree structure, and it
 * is recommended that these methods be used in place of direct manipulation
 * of a node's `children` array.
 * 
 * @namespace  Fortinbras/structures
 * @Class TNode
 * @example

    var 
        A = new TNode(),
        B = new TNode(),
        C = new TNode(),
        D = new TNode(),
        E = new TNode(),
        F = new TNode(),
        G = new TNode(),
        H = new TNode(),
        I = new TNode();
        [A,B,C,D,E,F,G,H,I].forEach(function (v, i) {v.value = i + 1;});
    //================= by value: ======== by name:
    A.append(B);    //         1                  A
    A.append(C);    //        / \                / \
    B.append(D);    //       /   \              /   \
    B.append(E);    //      2 --- 3            B --- C
    C.append(F);    //     / \     \          / \     \
    D.append(G);    //    4 - 5     6        D - E     F
    F.append(H);    //   /   / \            /   / \
    F.append(I);    //  7   8 - 9          G   H - I

 * @constructor
 * @return {TNode}
 */

function TNode () {
    this.parent   = null; // don't set these directly, OK?
    this.next     = null; 
    this.prev     = null; 
    this.children = [];
}
// getters are not supported in IE < 9. pass --es3 to requierer 
// when building to convert to getProp() and setProp(val) functions
TNode.prototype = {
    get first () {
        return !this.children.length ? null : this.children[0];
    },
    get last () {
        var idx;
        if (!this.children.length)
            return null;

        idx = this.children.length - 1;
        return (idx > -1) ? this.children[idx] : null;
    },
    index: function (node) {
        if (node.parent != this)
            return -1;
        return this.children.indexOf(node);
    },
    append: function (node) {
        if (node == this)
            throw new Error('cannot add node to itself');
        node.parent && node.remove();
        node.parent = this;
        this.last && (this.last.next = node);
        this.children.push(node);
        return this;
    },
    prepend: function (node) {
        if (node == this)
            throw new Error('cannot add node to itself');
        node.parent && node.remove();
        node.parent = this;
        this.first && (this.first.prev = node);
        this.children.unshift(node);
        return this;
    },
    before: function (node, idx) {
        if (node == this)
            throw new Error('cannot add node to itself');
        node.parent && node.remove();
        typeof idx != 'number' && (idx = this.parent.indexOf(this));
        this.children.splice(idx, 0, node);
        node.parent = this.parent;
        return this;
    },
    after: function (node) {
        return this.before(node, this.parent.indexOf(this) + 1);
    },
    remove: function () {
        this.parent && this.parent.removeChild(this);
        return this;
    },
    removeChild: function (node) {
        if (node.parent != this)
            throw new Error ('NO SUCH CHILD');

        if (node == this.first) {
            this.children.shift();
            this.first && (this.first.prev = null);
        } else if (node == this.last) {
            this.children.pop();
            this.last && (this.last.next = null);
        } else {
            this.children.splice(this.indexOf(node), 1);
            node.prev && node.prev.next && (node.prev.next = node.next);
            node.next && node.next.prev && (node.next.prev = node.prev);
        }
        node.parent = null;
        node.next   = null;
        node.prev   = null;
        return node;
    },
    replace: function (oldNode, newNode) {
        if (!(oldNode.parent && oldNode.parent == this))
            throw new Error('CANNOT REPLACE UNKNOWN CHILD');

        var idx  = this.index(oldNode),
            next = oldNode.next;

        this.removeChild(oldNode);
        next.before(newNode);
    },
    contains: function (node) {
        while (node = node.parent)
            if (node == this)
                return true;
        return false;
    }
};

TNode.prototype.constructor = TNode;

/**
 * Recursive preorder traversal
 * @static
 * @namepath
 * @param  {TNode}     node     the node to start from
 * @param  {Function} callback function to call on each node
 * @param  {Object}   [context] optional this object, defaults to the node
 * @return {undefined}
 */
function preorder (node, callback, context) {
    callback.call(context || node, node);
    node = node.first;
    while (node) {
        preorder(node, callback, context);
        node = node.next;
    }
}

TNode.preorder = preorder;

/**
 * Recursive postorder traversal
 * @static
 * @param  {TNode}     node     the node to start from
 * @param  {Function} callback function to call on each node
 * @param  {Object}   [context] optional this object, defaults to the node
 * @return {undefined}
 */
function postorder (node, callback, context) {
    var next = node.first;
    while (next) {
        postorder(next, callback, context);
        next = next.next;
    }
    callback.call(context || node, node);
}
TNode.postorder = postorder;

/**
 * Recursive in order traversal
 * @static
 * @param  {TNode}     node     the node to start from
 * @param  {Function} callback function to call on each node
 * @param  {Object}   [context] optional this object, defaults to the node
 * @return {undefined}
 */
function inorder (node, callback, context) {
    var next;
    if (!node) 
        return;

    next = node.first;
    next && inorder(next, callback, context);
    callback.call(context || node, node);
    while (next) {
        inorder(next.next, callback, context);
        next = next.next;
    }
}
TNode.inorder = inorder;

/**
 * Recursive tree traversal with optional pre and post callbacks
 * @static
 * @param  {TNode}      node     the node to start from
 * @param  {Function} [prefunc]  function to call on the node prior to visiting 
 *                               its children
 * @param  {Function} [postfunc] function to call on the node after visiting 
 *                               its children
 * @return {undefined}
 */
function walker (node, prefunc, postfunc, context) {
    var next = node.first;
    prefunc && prefunc.call(context || node, node);
    while (next) {
        walker(next, prefunc, postfunc);
        next = next.next;
    }
    postfunc && postfunc.call(context || node, node);
}
TNode.walker = walker;

module.exports = TNode;