/**
 * @fileOverview A simple testing server that uses requirer to generate a single
 * javascript file, starting from an application's entry point, which must be
 * called 'index.js' and found in the project directory. It also serves all the
 * static resources, like css files, you might need.
 * 
 * This is too simple for anything but development, and should never be used in
 * a production environment.
 * 
 */

// REQUIRER SPECIFIC PORTION IN LINES 55 - 93

var http = require('http'),
    fs   = require('fs'),  
    path = require('path'),
    parseUrl = require('url').parse,
    parseQuery = require('querystring').parse,
    each = require('../js/dev/requirer/lib/each'),

    Bundler = require('../js/dev/requirer/services/Bundler'),

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
    root = path.resolve(__dirname, '../../');

process.on('uncaughtException', function (err) {
    console.log('Caught exception: ' + err);
});


http.createServer(function (request, response) {
    var url = parseUrl(request.url),
        pathname = url.pathname,
        name = pathname.split('/').pop(),
        type = mime[pathname.slice(pathname.lastIndexOf('.') + 1).toLowerCase()] || 'text/plain',
        bundler, relativeID;

    if (pathname.indexOf('Grue') == 1)
        pathname = path.join(__dirname,'../../', pathname);
    else if (pathname == '/' || !pathname)
        pathname = path.join(__dirname,'../project/index.html');
    else
        pathname = path.join(__dirname, '../project', pathname);


// using Bundler to regenerate the modules on every page refresh
    if (request.headers['x-requested-with'] == 'XMLHttpRequest' && name == 'requirer') {
        // 1. create an instance
        bundler = new Bundler();

        console.time('serving bundle');

        // 2. get the starting point
        relativeID = parseQuery(url.query).root;

        if (!/^(?:\.|\/)/.test(relativeID))
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
            console.timeEnd('serving bundle');
        });

        // 3. bundle the modules
        return bundler.getModules(path.join(__dirname, '../project'), relativeID, 
                    path.resolve(__dirname, '../../'), true);
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