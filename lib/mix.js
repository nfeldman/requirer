module.exports = function (src, dest) {
    var prop;
    for (prop in src)
        if (src.hasOwnProperty(prop))
            dest[prop] = src[prop];
};