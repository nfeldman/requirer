# Requirer

Load client side projects written with node/common js style requires. 

This is not a complete module loading solution, but the core components of one.

## Features
 - write modules the way you do in node
 - get a single file containing all of your modules
 - using the example client and server, or something similar, have the correct line numbers during debugging

Use `components/sourceLoader` to gather all dependencies in a project and rewrite all module identifiers to absolute paths, optionally removing some initial portion of the path. `sourceLoader` can also return a poset of the module identifiers by calling its `getSorted` method. Use `components/Bundler` to create an object containing the slightly modified sources (each require is modified to use the full path to the module, modulo a leading path, e.g. `require('../lib/thingy/foo')` might become `require('my-awesome-app/js/lib/thingy/foo')`) of all the dependencies with the normalized identifiers as their keys, and a special key, `__root`, which has the name of the main or index file as its value.

For quick dev, throw together a simple server like the one in `server-example.js` and use the provided minimal loader implementation from `clients/requirer.js` by adding a script tag like the following to your app:

    <script src="path/to/requirer.js" id="requirer" data-index="./index" data-share="false"></script>

and you can write all of your modules the way you would on the server.

In production, just update the tag to point to a snapshot of the output you used during development, and you're good to go.

## TODO 

 - Write a utility to run Bundler and write the output to disk for use as a build step
 - Add optional module identifier shortening
 - Add an Uglify option to the as yet unwritten utility to run Bundler as a build step

#### Note to those familiar with earlier versions

This is completely different from what requirer was, but is intended to serve the same purpose. A tool to make it easy to use client side javascript written as nodejs modules.
