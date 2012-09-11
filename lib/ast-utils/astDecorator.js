var visit   = require('../visit'),
    typeToBodyNameMap = require('./typeToBodyNameMap'),
    nodeProto = require('./nodeProto');


/**
 * @name astDecorator
 * Utility that re-assigns the __proto__ reference of existing AST nodes based 
 * on their declared type to simplify manipulation without risking interfering
 * with code generation tools (escodegen) or expected JSON serialization.
 * @param  {Object} root Starting point in the AST
 * @return {undefined}
 */
module.exports = function (root) {
    visit(root, function (node) {
        if (typeof node == 'object' && node.type && 
          typeof typeToBodyNameMap[node.type] != 'undefined' &&
          !(node.__proto__ == nodeProto)) {
            node.__proto__ = nodeProto;
        }
    });
};