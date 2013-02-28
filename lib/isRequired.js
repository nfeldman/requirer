module.exports = function (node) {
    var ret = {
        node: null,
        id: ''
    };

    if (node && node.type) {
        if (node.type == 'VariableDeclarator' && node.init) {
            // var foo = require('./some/module')
            if (node.init.type  == 'CallExpression' &&
              node.init.callee.name == 'require' &&
              node.init.arguments[0].type == 'Literal') {
                ret.node = node;
                ret.id = node.init.arguments[0].value;
            } else if (node.init.type == 'MemberExpression' && 
              node.init.object && node.init.object.callee && 
              node.init.object.callee.name == 'require') {
                ret.node = node;
                ret.id = node.init.object.arguments[0].value;
            }
        } else if (node.type == 'ExpressionStatement' && node.expression.type && 
          node.expression.type == 'AssignmentExpression' && node.expression.right && 
          node.expression.right.type == 'CallExpression' && node.expression.right.callee.name == 'require' && 
          node.expression.left) {
            ret.node = node;
            ret.id = node.expression.right.arguments[0].value;
            // var foo; foo = require('./some/module') <-- maybe just avoid this form?
            if(node.expression.left.type == 'Identifier') {

            } else if (node.expression.left.type == 'MemberExpression') {
                // var baz = {foo: require('./some/module')}
                // TODO
            }
        }
    }

    return ret;
};