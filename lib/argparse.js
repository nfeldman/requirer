/**
 * @fileOverview A quick and dirty little cli args 
 * helper thrown together around 2am one night.
 */


  // I needed an options parser, I didn't feel like
  // using any of the existing ones, I only sort of
  // felt  like  writing one.  This is  the  result.
  // I feel compelled to apologize for this code :(


/** @private */
function nop () {}

/** @private */
function each (list, func) {
    var i = 0, x;
    if (Array.isArray(list))
        for (x = list.length; i < x; i++)
            func.call(null, list[i], i, i);
    else if (typeof list == 'object')
        for (x in list)
            func.call(null, list[x], x, i++);
}

/**
 * Hard wrap a string to multiple lines
 * @private
 * @param  {string} string          A long string to wrap
 * @param  {number} [leftMarginWidth] number of spaces to indent all but the
 *                                    first line.
 * @param  {number} maxLineWidth    Total columns. Attempts to find a break
 *                                  within 5 characters of this limit
 * @return {string}
 */
function splitToLines (string, leftMarginWidth, maxLineWidth) {
    var lines = [],
        line  = [],
        padding = Array(leftMarginWidth||0).join(' '),
        i = 0, // cursor
        p = 0, // left anchor
        m = 0, // counter for searching 5 char wrap zone
        s, // tmpvar
        l = string.length,
        mLen = maxLineWidth - (leftMarginWidth||0) - 5;

    while (l > i) {
        i && line.push(padding);
        !i && (i = maxLineWidth - 5);

        while (i-- > p) {
            s = string.charAt(i);
            if (s == ' ' || s == '-') {
                i++;
                break;
            }
        }

        if (i == p) {
            i += mLen;
            while (string.charAt(i++) != ' ' && 5 > m++);
            if (string.charAt(i) != ' ')
                break;
            else
                m = 0;
        }

        line.push(string.slice(p, i));
        lines.push(line.join(''));
        line.length = 0;
        p = i;
        i += mLen;
    }

    lines.push(padding + string.slice(p));
    return lines.join('\n');
}

var rDash = /^-{0,2}/, 
    n, i, f, lines, lengths, ind, usg;

/**
 * @name argparse
 *     
 * @param  {Object} config An object where each key is the option name and each
 *                         value is  an array containing one or more of:
 *                             alias, true, description, 'required'
 *                               
 * @example
 *      Object based config
 *      {
 *          'XOpt': ['x', 'a required param with an alias', 'required'],
 *          'name2': [true],
 *          'name3': ['this is another option'],
 *          'n': ['this option only has a short name']
 *      }
 *                               
 * @return {Function({Array}[args=process.argv])} A function that, when called, 
 *          returns a map of all passed options (with aliased versions if
 *          declared in config) to their values. Boolean options default to 
 *          false. Throws an error if an argument marked required is absent.
 */
module.exports = function (config) {

    var schema = Object.create(null), 
        bools = [],
        usage = 'Usage: ' + [process.argv[0], process.argv[1].split('/').pop(),' '].join(' '),
        requireds = [],
        argv2, showUse, undef;

    if (!process || !process.argv || process.argv.length < 2)
        return nop;

    argv2 = process.argv.length > 2 ? process.argv[2] : '';

    showUse = /^-{1,2}h(?:elp)?$/.test(argv2) ? argv2.replace(rDash, '') : false;

    each(config, function (arg, name) {
        var i = 0, l = arg.length, key;
        !schema[name] && (schema[name] = {});
        for (; i < l; i++) {
            if (name && arg[i] == 'required') {
                schema[name].required = true;
            } else if (arg[i] !== undef) {
                key = typeof arg[i] === 'boolean' ? ((bools.push(name)), 'bool') : (arg[i].length == 1 ? 'alias' : 'description');
                schema[name][key] = arg[i];
            }
        }
    });
    
    if (showUse) {

        n = ''; 
        i = 0;
        f = '\n\n';
        lines = [];
        lengths = '1111'.split('');


        each(schema, function (obj, name, idx) {
            var len = name.length,
                l = '[', r = ']',
                line = [];

            // add full name and alias switch to the usage string
            if (len > 1 || schema[name].alias == schema[name].name) {
                obj.required && (l = r = '');
                len > 1 && (n += l + '--' + name);
                if (obj.alias)
                    n += (len > 1 ? ' | ' : ' ') + '-' + obj.alias;
                n += r + ' ';
            }

            // TODO explain
            if (name.length > 1 || schema[name].alias == schema[name].name) {
                line.push(' ' + l + '--' + name + r);
                line[0].length > lengths[0] && (lengths[0] = line[0].length);

                line.push(obj.alias ? (l + '-' + obj.alias + r) : ' ');
                line[1].length > lengths[1] && (lengths[1] = line[1].length);

                line.push(obj.bool ? 'bool' : ' ');
                line[2].length > lengths[2] && (lengths[2] = line[2].length);

                line.push(obj.description ? obj.description : ' ');
                line[3].length > lengths[3] && (lengths[3] = line[3].length);

                lines.push(line);
            }
        });
        
        f += lines.map(function (line, i) {
            var ret;
            line = line.map(function (segment, j) {
                var len = segment.length,
                    ret = lengths[j] > len ? segment + Array(lengths[j] - len + 1).join(' ') : segment;
                if (/^\s+$/.test(ret))
                    ret = Array(ret.length + 1).join('░');
                return ret;
            });
            ret = line.join('  ').replace(/\s+$/, '');
            if (ret.length > 80)
                return splitToLines(ret, line.slice(0, 3).join(' ').length + 5, 80);
            return ret;
        }).join('\n');

        console.log('\n',(usage.length + n.length > 80 ? splitToLines(usage + n, usage.length + 1, 80) : (usage + n)), f, '\n');
        process.exit(1);
    }

    return function (args) {
        !args && (args = process.argv);
        args[0] == 'node' && (args = args.slice(2));
        
        var l = args.length, i = 0, ret = {};
        
        each(bools, function (name) {ret[name] = false});

        for (; i < l; i++) {
            (function (arg) {
                var j = arg.indexOf('='), o, v;

                if (j > -1) {
                    arg = arg.split('=');
                    o = arg[0];
                    v = arg[1];
                } else {
                    o = arg;
                }

                if (!schema[o] || typeof schema[o] != 'object' && o != showUse)
                    console.warn('unknown option', o)
                else if (schema[o].bool)
                    ret[o] = true;
                else
                    ret[o] = v !== undef ? v : args[++i];
                if (o.length == 1 && schema[o].name)
                    ret[schema[o].name] = ret[o];
                else if (schema[o].alias)
                    ret[schema[o].alias] = ret[o];
            }(args[i].replace(rDash, '')));
        }

        each(requireds, function (name) {
            if (ret[name] === undef)
                throw new Error('Required option "' + name + '" missing');
        });

        return ret;
    }
};
