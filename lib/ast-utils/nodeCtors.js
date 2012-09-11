var ASTNodeProto = require('./NodeProto');

exports.Program = function () {
    this.type = "Program";
    this.body = [];
};
exports.Program.prototype = ASTNodeProto;

exports.VariableDeclaration = function () {
    this.type = 'VariableDeclaration';
    this.declarations = [];
    this.kind = 'var';
};
exports.VariableDeclaration.prototype = ASTNodeProto;

exports.BlockStatement = function (body) {
    this.type = 'BlockStatement';
    this.body = body || [];
};
exports.BlockStatement.prototype = ASTNodeProto;

exports.Identifier = function (name) {
    this.type = "Identifier";
    this.name = name;
}