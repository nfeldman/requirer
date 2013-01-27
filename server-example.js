/**
 * @fileOverview A simple testing server used in Grue based projects that uses
 * requirer to generate a single javascript file, starting from an application's
 * entry point, which must be called 'index.js' and found in the project 
 * directory. It also serves all the static resources, like css, you might need.
 * 
 * This is too simple for anything but development, and should never be used in
 * a production environment.
 * 
 * TODO make config based
 * 
 */

// REQUIRER SPECIFIC CODE ON LINES 57 - 90

var http = require('http'),
    fs   = require('fs'),  
    path = require('path'),
    parseUrl = require('url').parse,
    parseQuery = require('querystring').parse,
    each = require('../js/dev/requirer/lib/each'),

    Bundler = require('../js/dev/requirer/components/Bundler'),

    mime = {
        'json': 'application/json',
        'swf' : 'application/x-shockwave-flash',
        'js'  : 'application/javascript',
        'css' : 'text/css',
        'txt' : 'text/plain',
        'html': 'text/html',
        'xml' : 'text/xml',
        'ico' : 'image/x-icon'
    },
    // sourceLoader accepts absolute identifiers that are aliases for relative
    // paths, i.e. '/Grue/infrastructure/Component' in a project's index should
    // typically be treated the same as '../js/infrastructure/Component'
    aliases = {
        'Grue': '../js'
    },
    root = path.resolve(__dirname, '../../');

http.createServer(function (request, response) {
    var url = parseUrl(request.url),
        pathname = url.pathname,
        name = pathname.split('/').pop(),
        type = mime[pathname.slice(pathname.lastIndexOf('.') + 1).toLowerCase()] || 'text/plain',
        bundler, relativeID;

    if (pathname.indexOf('Grue') == 1)
        pathname = path.join(root, pathname);
    else if (pathname == '/' || !pathname)
        pathname = path.join(__dirname,'../project/index.html');
    else
        pathname = path.join(__dirname, '../project', pathname);

// using Bundler to regenerate the modules on every page refresh
    if (request.headers['x-requested-with'] == 'XMLHttpRequest' && name == 'requirer') {
    // 1. create an instance
        bundler = new Bundler();

    // 2. get the starting point
        relativeID = parseQuery(url.query).root;
        if (!/^(?:\.{1,2}|\/)/.test(relativeID))
            relativeID = './' + relativeID;

        bundler.onReady(function (err, modules) {
            if (err) {
                response.writeHead(404, {'content-type':'application/json'});
                response.write('{"error":"Unabled to create module bundle"}');
                response.end();
                console.timeEnd('serving bundle');
                return;
            }

            response.writeHead(200, {
                'content-type': 'application/json',
                'cache-control': 'no-cache, must-revalidate',
                'expires': 'Sat, 26 Jul 1997 05:00:00 GMT'
            });

    // 4. send the modules to the client
            response.write(JSON.stringify(modules));
            response.end();
        });

    // 3. bundle the modules
        return bundler.getModules(path.join(__dirname, '../project'), relativeID, 
                    path.resolve(__dirname, root), aliases, true);
    }

    console.time('serving ' + pathname);

    fs.exists(pathname, function (exists) {
        if (!exists) {
            response.writeHead(404);
            response.write('<html><h1>404 File Not Found</h1></html>');
            response.end();
            console.timeEnd('serving ' + pathname);
            return;
        }

        response.writeHead(200, {
            'content-type': mime[pathname.slice(pathname.lastIndexOf('.') + 1).toLowerCase()],
            'cache-control': 'no-cache, must-revalidate',
            'expires': 'Sat, 26 Jul 1997 05:00:00 GMT'
        });


        return fs.createReadStream(pathname).on('data', function (data) { 
            response.write(data);
        }).on('end', function () {
            response.end();
            console.timeEnd('serving ' + pathname);
        });
    });

}).listen(1337);