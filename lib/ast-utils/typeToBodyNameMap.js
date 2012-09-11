// provides a consistent interface for OO style manipulation of some AST nodes
module.exports = {
    'Program':'body',
    'BlockStatement':'body',
    'VariableDeclaration':'declarations',
    'FunctionExpression':'params',  // NOT BEING USED YET
    'ObjectExpression':'properties'  // NOT BEING USED YET
};