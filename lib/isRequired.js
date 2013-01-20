module.exports = function (node) {
    var ret = {
        type: '',
        node: null,
        id: ''
    }, arg;

    if (node && node.type) {
        // var foo = require('./some/module')
        if (node.type == "VariableDeclarator" && 
          node.init && node.init.type  == "CallExpression" &&
          node.init.callee.name == 'require' &&
          node.init.arguments[0].type == 'Literal') {
            arg = node.init.arguments[0].value;
            ret.type = 'simple';
            ret.node = node;
            ret.id = arg;
        } else if (node.type == 'ExpressionStatement' && node.expression.type && 
          node.expression.type == 'AssignmentExpression' && node.expression.right && 
          node.expression.right.type == 'CallExpression' && node.expression.right.callee.name == 'require' && 
          node.expression.left) {
            ret.node = node;
            ret.id = node.expression.right.arguments[0].value;
            // var foo; foo = require('./some/module') <-- maybe just avoid this form?
            if(node.expression.left.type == 'Identifier') {
                ret.type = 'assignToExistingVar';
            } else if (node.expression.left.type == 'MemberExpression') {
                // var baz = {foo: require('./some/module')}
                ret.type = 'assignToObjectLiteral'; // name :( but good enough
            }
        }
    }

    return ret;
};