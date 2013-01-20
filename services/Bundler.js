var sourceLoader = require('./sourceLoader'),
    mix = require('../lib/mix'),
    onReady = require('../lib/onReady');

// TODO identifier shortening
// since all of the modules are in the same place, we can rewrite their names
// TODO uglifyjs option

function Bundler (path, relativeID, root, addSourceURLComment) {
    this.isReady = false;
    this.callbacks = [];
    this.bundle = null;
    if (path && relativeID && root)
        this.getModules(path, relativeID, root, addSourceURLComment);
}

mix(onReady, Bundler.prototype);

Bundler.prototype.getModules = function (path, relativeID, root, addSourceURLComment) {
    var ret = {modules: {}, ordered: null},
        modules = ret.modules,
        readyFn = this.ready.bind(this),
        addComment = !!addSourceURLComment;

    sourceLoader(path, relativeID, root).onReady(function () {
        var ordered = this.getSorted(),
            i = 0,
            l = ordered.length;

        // I am under the impression that v8 is smart enough to optimize
        // away an `if` in a loop body, but in this case it doesn't hurt
        // to do it manually.

        if (addComment)
            for ( ; i < l; i++)
                modules[ordered[i]] = this.modules[ordered[i]].source + '\n//@sourceURL=' + this.modules[ordered[i]].location;
        else 
            for ( ; i < l; i++)
                modules[ordered[i]] = this.modules[ordered[i]].source;

        ret.__ordered = ordered;
        ret.__root = this.identity;
        this.bundle = ret;
        readyFn(null, ret);
    });
};

module.exports = Bundler;