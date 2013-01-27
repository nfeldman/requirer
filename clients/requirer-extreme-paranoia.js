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


// use Function to create a clean environment from which to return the require function. 
// The CONFIG param holds options. This approach ensures that eval can't accidentally include
// variables from this IIFE. The net result is to prevent the creation of any global variables
// and, if share is false, prevent unexpected interactions between modules with mutual dependencies.
// Whether this is worth the effort or not is another question. This lets us safely use eval
// to solve the problem of incorrect line numbers.
    var CONFIG_OBJECT_ID = '___' + (Date.now() * Math.random()).toFixed();
    var requirer = new Function(CONFIG_OBJECT_ID,
    '    // if shared, module ids become, in effect, global identifiers, and the developer\n' +
    '    // must be extra careful not to mutate any of these shared objects. If you follow\n' +
    '    // the practice of having each module return a function rather than an object,\n' +
    '    // this should be relatively safe.\n' +
    '    ' + CONFIG_OBJECT_ID + '.shared = {};\n\n' +
    '\n' +
    '    return function require (path) {\n' +
    '        var module = {exports:{}};\n' +

    '        if (' + CONFIG_OBJECT_ID + '.share && ' + CONFIG_OBJECT_ID + '[path])\n' +
    '            return ' + CONFIG_OBJECT_ID + '[path];\n' +

    '        if (' + CONFIG_OBJECT_ID + '.modules[path]) {\n' +
    '            // evaluate in a clean environment and pass in the context. There\n' +
    '            // are two ways we can do this that make sense.\n' +
    '            //\n' +
    '            // Way 1:\n' +
    '            // This is the more obvious and probably more performant, approach.\n' +
    '            // It really only has 1 drawback, in that the code you view in the\n' +
    '            // browser will be wrapped in a function, which will make all your\n' +
    '            // line numbers off by 1.\n' +
    '            //\n' +
    '            // fn = new Function("exports, require, module, global, undefined", modules[path]);\n' +
    '            // fn(module.exports, require, module, this);\n' +
    '            //\n' +
    '            // Way 2:\n' +
    '            // This gets around the line number problem by using eval within an\n' +
    '            // anonymous function, like so:\n' +
    '            (function (exports, require, module, global, undefined) {\n' +
    '                eval(' + CONFIG_OBJECT_ID + '.modules[path]);\n' +
    '            }(module.exports, require, module, this));\n' +
    '\n' +
    '            if (' + CONFIG_OBJECT_ID + '.share)\n' +
    '                ' + CONFIG_OBJECT_ID + '[path] = module.exports;\n' +
    '\n' +
    '            return module.exports;\n' +
    '        }\n' +
    '    }' +
    '//@ sourceURL=clients/require.js'),

    

    // the process is very simple. we perform an ajax request for the main
    // program and get back an object full of source strings.
    request = XHR();

    request.open('GET', location.origin + '/requirer?root=' + encodeURIComponent(index));
    // this is for dev use, so no caching
    request.setRequestHeader('Cache-Control', 'no-cache');
    request.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

    request.onload = function () {
        var response = JSON.parse(this.responseText),
            require = requirer({share:share, modules:response.modules});
        require(response.__root);
    };

    request.send();
}());