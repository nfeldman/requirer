var extend = require('./extend');

module.exports = function (SubC, SuperC) {
    var subProto = Object.create(SuperC.prototype);
    extend(subProto, SubC.prototype);
    SubC.prototype = subProto;
};