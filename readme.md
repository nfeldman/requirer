# requirer version 0.0.0

Write node style requires (and eventually optionally inline code via 
annotations and rewrite source to ES3) and build single files for the browser.

## About

Requirer is intended to be an ECMAScript build tool and preprocessor with
some "transpilation" capabilities.

It is very, _very_, *very*, *_very_* new and raw and somewhat embarrassing
right now, but if someone does happen to stumble across this repository, feed-
back or contributions are welcome.

If I can figure out how to do so reliably, I want to convert ES5+ syntax 
features to ES3, when there are semantically equivalent constructs available. 
Mostly because I hate having to write set('foo', 'bar') or setFoo('bar') when 
ES5 lets you create a setter, but the performance of setters in all but IE  
appears atrocious. http://jsperf.com/setter-v-no-setter 


## Background

I began working on it as a build tool for the rewrite of Fortinbras, a 
library/framework for web apps and sites. The impetus was a desire to 
use Node style requires in individual source files but generate a single,
browser optimized file with minimal effort. As of version 0.0.0, this is
the only feature that works, and only for relatively simple source programs. 

Several observations led me to attempt this project:

1 that no project I have seen will make the following promises:

   I. If two modules both depend on a third module and import it with the
  same identifier, and they exist within a shared scope or one is contained
  within the scope of the other, the third module will be included once, 
  not twice (which may entail moving its declaration up the scope chain) 
  and at the correct level so as to be visible to both requiring modules.

  II. Similar to #1, if multiple modules have identical variable declarations,
  only one should be left in the output. I want to write more granular 
  modules, but this can lead to things like repeatedly dereferencing methods
  of global prototypes, e.g. var hasOwn = Object.prototype.hasOwnProperty, 
  in individual files. Assuming several of these modules might be required
  by a program and they are a short distance from each other in the scope
  chain, it is a waste of bits to preserve multiple identical declarations.

2 Additional source rewriting should be possible and even somewhat safe if
a full ECMAScript parser (the brilliant Esprima) is used. The conversion I want 
first is to rewrite ES5 setters and getters to setProp and getProp functions.

3 While I could attempt to fully understand the source of some of the existing 
tools (of which several polished and feature rich examples currently exist) and 
figure out whether they manage this or not, I'm more interested in working out how
to do it for myself.

## Goals

  1) Be able to make the 2 claims listed above under the first observation
  without requiring boilerplate code

  2) Add preprocessor like functionality both to rewrite values and to 
  optionally "compile" some ES5 and possibly ES6 features down to ES3.

Version 0.0.1 will be achieved when it can more or less reliably create
a single file and correctly inline all of the code required while removing
all duplicate code, creating the flattest safe scope chain.
