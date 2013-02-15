/**
 * @fileOverview Requirer tool for development.
 * Demonstrates how to use the output of requirer/services/Bundler from the browser
 *
 * to use, include this tag in your apps index page:
 *     <script type="text/javascript" src="path/to/requirer.js" id="requirer" data-index="index" data-share="false"></script>
 */

(function (undefined) {
    var XHR, testXHR, index, scriptTag, module_sources,
        modules, request, share, shared;

    try {
        testXHR = new XMLHttpRequest();
        XHR = function () {return new XMLHttpRequest()};
    } catch (e) {
        try {
            testXHR = new ActiveXObject('Microsoft.XMLHTTP');
            XHR = function () {return new ActiveXObject('Microsoft.XMLHTTP')};
        } catch (e) {}
    } finally {
        if (!testXHR || !XHR)
            throw new Error('Unable to create an xhr object');
        else
            testXHR = null;
    }

    scriptTag = document.getElementById('requirer');

    // get the program's entry point from the dom
    index = scriptTag.getAttribute('data-main');
    // whether to re-evaluate each module every time it is included or not
    // slower initialization and (probably) greater memory consumption versus
    // trusting yourself never to mutate a shared module... you decide.
    share = scriptTag.getAttribute('data-share');
    share == 'true' ? true : false;

// if shared, module ids become, in effect, global identifiers, and the developer
// must be extra careful not to mutate any of these shared objects. If you follow
// the practice of having each module return a function rather than an object, 
// this should be relatively safe.

    if (share)
        shared = {};

    // the process is very simple. we perform an ajax request for the main
    // program and get back an object full of source strings.
    request = XHR();

    request.open('GET', location.origin + '/requirer?root=' + encodeURIComponent(index));
    // this is for dev use, so no caching
    request.setRequestHeader('Cache-Control', 'no-cache');
    request.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

    request.onload = function () {
        var response = JSON.parse(this.responseText);
        modules = response.modules;
        require(response.__root);
    };

    request.send();

    function require (path) {
        var module = {exports:{}};

        if (share && shared[path])
            return shared[path];

        if (modules[path]) {
            // evaluate in a clean environment and pass in the context. There
            // are two ways we can do this that make sense.
            //
            // Way 1:
            // This is the more obvious and probably more performant, approach.
            // It really only has 1 drawback, in that the code you view in the
            // browser will be wrapped in a function, which will make all your
            // line numbers off by 1.
            //
            // fn = new Function('exports, require, module, global, undefined', modules[path]);
            // fn(module.exports, require, module, this);
            //
            // Way 2:
            // This gets around the line number problem by using eval within an
            // anonymous function, like so:
            (function (exports, require, module, global, undefined) {
                eval(modules[path]);
            }(module.exports, require, module, (1, eval)(this)));

            if (share)
                shared[path] = module.exports;

            return module.exports;
        }
    }
}());