/**
 * A utility that bundles modules prepared by sourceLoader into a simpler JS
 * object intended to be converted to JSON and evaluated on the client. It
 * optionally includes the //@ sourceURL comment at the end of each module's
 * source string for better client side debugging.
 */

var sourceLoader = require('./sourceLoader'),
    mix = require('../lib/mix'),
    onReady = require('../lib/onReady'),
    uglify  = require('uglify-js');

/**
 *
 * @param {string} path Path to the root module
 * @param {string} relativeID Directory relative id string, e.g. '../lib/mix'
 * @param {string} root Portion of the system path to exclude from
 *                              module names, e.g. /Users/nfeldman/projects
 * @param {boolean} [productionMode=false] Whether to include a comment that
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
 */
function Bundler (path, relativeID, root, productionMode, known) {
    this.isReady = false;
    this.callbacks = [];
    this.bundle = null;
    this.idmap  = Object.create(null);
    this.commonPrefix = '';
    if (path && relativeID && root)
        this.getModules(path, relativeID, root, productionMode, known);
}

mix(onReady, Bundler.prototype);

Bundler.prototype.getModules = function (path, relativeID, root, productionMode, known) {
    var ret = {},
        modules = '{',
        readyFn = this.ready.bind(this),
        that = this,
        addComment, minify;

    addComment = productionMode == 0;
    !known && (known = {});

    sourceLoader(path, relativeID, root).onReady(function () {
        var ordered = this.getSorted(),
            // _ordered = that._minifyModuleIdentifiers(this.modules, ordered),
            i = 0,
            l = ordered.length,
            source;

        // v8 should be smart enough to optimize this for us
        for ( ; i < l; i++) {
            if (known[ordered[i]])
                continue;
            if (addComment) {
                modules += '"' + ordered[i] + '":function (exports,require,module,global,undefined){\n' + this.modules[ordered[i]].source + '\n//@ sourceURL=' + this.modules[ordered[i]].identity + '.js\n}';
                // modules[ordered[i]] = 'function factory(exports,require,module,global,undefined){\n' + this.modules[ordered[i]].source + '\n//@ sourceURL=' + this.modules[ordered[i]].identity + '.js\n}';
                if (i < l - 1)
                modules += ','
            } else {
                try {
                source = this.modules[ordered[i]].source;
                modules[ordered[i]] = uglify.minify('function x(exports,require,module,global,undefined){' + source + '}', {fromString: true}).code.replace(/^function x/, 'function');
                } catch (e)  {
                    console.log(ordered[i], e);
                    process.exit(1);
                }
                // modules[ordered[i]] = source.slice(source.indexOf('(') + 1, source.indexOf(')')) + '-' + source.slice(source.indexOf('{') + 1, -1);
            }
        }

        modules += '}';
        ret.modules = modules;
        ret.__ordered = ordered;
        ret.__ = this.identity;
        that.bundle = ret;

        readyFn(null, ret);
    });
};

Bundler.prototype._minifyModuleIdentifiers = function (modules, ordered) {
    var alpha = 'abcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_+=~`:;\'",.<>/\\?',
        len   = alpha.length,
        cycle = 0,
        idmap = this.idmap,
        ret   = new Array(ordered.length),
        names;

    ordered.map(function (name, i) {modules[name]._index = i; return name})
        .sort(function (a, b) {
            return modules[a].timesSeen != modules[b].timesSeen ? modules[a].timesSeen > modules[b].timesSeen ? 1 : -1 : 0;
        }).forEach(function (name, i) {
            var idx = i % len,
                module = modules[name];

            !(idx % len) && ++cycle;
            idmap[module.identity] = repeat(alpha.charAt(idx), cycle);
            ret[module._index] = idmap[module.identity];
            // delete module._index;
        });

    names = RegExp('\\(\\s*[\'"](' + Object.keys(idmap).join('|').replace(/\//g, '\\/') + ')[\'"]\\s*\\)', 'g');

    for (var i = 0, l = ordered.length; i < l; i++)
        modules[ordered[i]].source = modules[ordered[i]].source.replace(names, function (a, b) {
            return "('" + idmap[b] + "')";
        });
    return ret;
};

// via jdalton, original comment follows:
// Based on work by Yaffle (@4esn0k) and Dr. J.R.Stockton.
// Uses the `Exponentiation by squaring` algorithm.
// http://www.merlyn.demon.co.uk/js-misc0.htm#MLS
// https://github.com/jdalton/fusejs/blob/master/src/lang/string.js#L16-25

function repeat (string, count) {
    var half;
    if (count < 1)
        return '';
    if (count % 2)
        return repeat(string, count - 1) + string;

    half = repeat(string, count / 2);
    return half + half;
}

module.exports = Bundler;