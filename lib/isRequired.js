module.exports = function (node) {
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
                path: (/\.js$/.test(arg) ? arg : arg + '.js')
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
                ret.type = 'assignToExistingVar';
                ret.name = node.expression.left.name;
            } else if (node.expression.left.type == 'MemberExpression') {
                // var baz = {foo: require('./some/module')} // possible, but annoying
                ret.type = 'assignToObjectLiteral'; // name :( but good enough
                ret.name = node.left; // TODO how to handle this one?
            }
        }
    }

    return ret || false;
};