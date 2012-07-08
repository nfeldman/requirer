var b = require('./lib/b'),
    c = require('./lib/c'),
    d = require('./lib/a'),
    e;

(function () {
    var g = require('./lib/c'); // this will work but will pulled out to the top scope
                                // which probably is not what we want if we're doing
                                // this here.
    var b = require('./lib/c'); // this will not do the right thing, yet, because
                                // we don't really deal with scope resolution yet. OTH,
                                // arguably, you shouldn't do things like this.
 e =  {
        a:require('./lib/a'), // this won't work yet
        c:g // g isn't going to be what we expect :(
    };
 }());

console.log(b, c, e.a, e.g, d == e.a);