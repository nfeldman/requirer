var visit = require('./visit'),
    isRequire = require('./isRequire');

module.exports = function (obj) {
    var ret = [];

    visit(obj, function (obj) {
        var required = isRequire(obj);
        if (required)
            ret.push(required);
    });

    return ret;
};
