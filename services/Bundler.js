var sourceLoader = require('./sourceLoader'),
    mix = require('../lib/mix'),
    onReady = require('../lib/onReady');

function Bundler (path, relativeID, root) {
    this.isReady = false;
    this.callbacks = [];
    this.bundle = null;
    if (path && relativeID && root)
        this.init(path, relativeID, root);
}

mix(onReady, Bundler.prototype);

Bundler.prototype.init = function (path, relativeID, root) {
    var ret = {modules: {}, ordered: null},
        modules = ret.modules,
        readyFn = this.ready.bind(this);

    sourceLoader(path, relativeID, root).onReady(function () {
        var ordered = this.getSorted(),
            i = 0,
            l = ordered.length;

        for ( ; i < l; i++) {
            console.log(ordered[i]);
            modules[ordered[i]] = this.modules[ordered[i]].source + '\n//@ sourceURL = ' + root + this.modules[ordered[i]].location;
        }

        ret.ordered = ordered;
        this.bundle = ret;
        readyFn(ret);
    });
};

module.exports = Bundler;