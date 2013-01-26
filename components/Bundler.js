/**
 * A utility that bundles modules prepared by sourceLoader into a simpler JS
 * object intended to be converted to JSON and evaluated on the client. It
 * optionally includes the //@ sourceURL comment at the end of each module's
 * source string for better client side debugging.
 */

var sourceLoader = require('./sourceLoader'),
    mix = require('../lib/mix'),
    onReady = require('../lib/onReady');

// TODO identifier shortening
// since all of the modules are in the same place, we can rewrite their names

/**
 *
 * @param {string} path Path to the root module
 * @param {string} relativeID Directory relative id string, e.g. '../lib/mix'
 * @param {string} root Portion of the system path to exclude from 
 *                              module names, e.g. /Users/nfeldman/projects
 * @param {boolean} [addSourceComment=false] Whether to include a comment that
 *                                           causes chrome's debugger to display
 *                                           each module as though it were in the
 *                                           original file. Useful during dev.
 * @param {Function(source)} [filter] Function to which the source of each module
 *                                    will be passed. Must return a source string.
 * @return {Object} An object with a key for each module by the id the source
 *                  has been rewritten to use and two additional properties:
 *                  __root, the id of the index or main module
 *                  __ordered, a poset (i.e. dependency ordered) of module ids,
 *                   this isn't needed for anything at the moment.
 * 
 */
function Bundler (path, relativeID, root, addSourceURLComment, filter) {
    this.isReady = false;
    this.callbacks = [];
    this.bundle = null;
    if (path && relativeID && root)
        this.getModules(path, relativeID, root, addSourceURLComment, filter);
}

mix(onReady, Bundler.prototype);

Bundler.prototype.getModules = function (path, relativeID, root, addSourceURLComment, filter) {
    var ret = {modules: {}, ordered: null},
        modules = ret.modules,
        readyFn = this.ready.bind(this),
        addComment = !!addSourceURLComment;

    sourceLoader(path, relativeID, root).onReady(function () {
        var ordered = this.getSorted(),
            i = 0,
            l = ordered.length;

        for ( ; i < l; i++) {
            if (filter)
                modules[ordered[i]] = filter(this.modules[ordered[i]].source);
            else 
                modules[ordered[i]] = this.modules[ordered[i]].source;
            if (addComment)
                modules[ordered[i]] += '\n//@ sourceURL=' + this.modules[ordered[i]].identity + '.js';
        }

        ret.__ordered = ordered;
        ret.__root = this.identity;
        this.bundle = ret;
        readyFn(null, ret);
    });
};

module.exports = Bundler;