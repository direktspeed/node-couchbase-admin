#!/usr/bin/env node

'use strict';

var Promise = require('bluebird');
var program = require('commander');
var crypto = require('crypto');
var read = require('read');
var util = require('util');
var colors = require('colors');

var Bucket = require('./lib/bucket');
var ddocs = require('./lib/ddocs');
var cli = require('./lib/helpers/cli');

function collectHash(val, total) {
    total[val] = true;
    return total;
}

function collectArray(val, total) {
    total.push(val);
    return total;
}

program
    .version('0.3.0')
    .option('-s, --src <conn or file>', 'Source cluster connection string or file')
    .option('-d, --dst <conn>', 'Destination cluster connection string')
    .option('--file <file>', 'Write the source cluster design views to a source file')
    .option('-b, --src-bucket <bucket>', 'Source bucket (defaults to default)', 'default')
    .option('-B, --dst-bucket <bucket>', 'Destination bucket (defaults to default)', 'default')
    .option('-i, --include <design doc>', 'Filter in a design document', collectHash, {})
    .option('-e, --exclude <design doc>', 'Filter out a design document', collectHash, {})
    .option('--prefix <prefix>', 'Used for copying or validating documents.', collectHash, {})
    .option('--prefix-splitter <char>', 'Character used to split couchbase keys from their prefix (defaults to "!")', '!')
    .option('--overwrite', 'Overwrite documents when copying and some already exist on the destination bucket.')
    .option('--timeout <timeout>', 'Specify a timeout (in minutes) for couchbase operations (defaults to 10).', 10)
    .option('--admin-design-document <name>', 'Override the default design document name used by cb-admin (defaults to `cbadmin`).', 'cbadmin')
    .option('--iterative', 'Use iterative mode when manipulating documents.')
    .option('-v, --verbose', 'Be verbose.')
    .parse(process.argv);

var ns = program.args[0];
var cmd = program.args[1];

try {
	cli.validateOptions(ns, cmd, program);
} catch (e) {
	print(e.message.red, ' :: use `cb-admin --help`');
	process.exit(1);
}

var logger = {
	debug: print,
	info: print,
	warn: print,
	error: print,
};

var env = {};

// create source bucket instance
if (program.srcConn) {
	print('Source connection [', program.srcConn, '][bucket:', program.srcBucket, ']');
	env.src = new Bucket({
		conn: program.srcConn,
		bucket: program.srcBucket,
		logger: logger,
		timeout: program.timeout * 60 * 1000,
		admin_design_document: program.adminDesignDocument,
	});
}

// create destination bucket instance
if (program.dstConn) {
	print('Destination connection [', program.dstConn, '][bucket:', program.dstBucket, ']');
	env.dst = new Bucket({
		conn: program.dstConn,
		bucket: program.dstBucket,
		logger: logger,
		timeout: program.timeout * 60 * 1000,
		admin_design_document: program.adminDesignDocument,
	});
}

switch (ns) {
	case 'docs':
		docmanagement(cmd);
	break;

	case 'dd':
	case 'design-documents':
		ddmanagement(cmd);
	break;

	default:
		console.log('Usage: cb-admin <namespace> <command> [opts]');
		console.log('Namespaces:');
		console.log('  dd     manage design documents');
		console.log('  docs   check and manipulate documents');
	break;
}

//==============================================================================
function ddmanagement(cmd) {
//==============================================================================
	switch (cmd) {
		case 'export':
			env.src.getDesignDocuments()
			.then(function (design_documents) {
				return ddocs.export(program.file, design_documents)
				.catch(function (err) {
					console.error('export to [' + program.file + '] failed:', err);

					throw err;
				});
			})
			.nodeify(terminate);
		break;

		case 'diff':
			diff(program)
			.nodeify(terminate);
		break;

		case 'upgrade':
			diff(program)
			.catch(terminate)
			.then(upgrade);
		break;

		default:
			console.log('Usage: cb-admin dd <command> [opts]');
			console.log('Commands:');
			console.log('  export');
			console.log('  diff');
			console.log('  upgrade');
		break;
	}
}

//==============================================================================
function docmanagement(cmd) {
//==============================================================================
	var counter = 0;
	var stime, etime, elapsed;

	var _postOperation = function () {
		// initialize the timer on the first iteration
		if (counter === 0) {
			stime = process.hrtime();
		}

		if (++counter % 1e3 === 0) {
			etime = process.hrtime();
			elapsed = (etime[0] - stime[0]) * 1e3 + Math.floor((etime[1] - stime[1]) / 1e6);
			stime = etime;

			switch(cmd) {
				case 'move':
					print('Moved [', counter, '] documents in [' + elapsed + 'ms].');
				break;
				case 'copy':
					print('Copied [', counter, '] documents in [' + elapsed + 'ms].');
				break;
				case 'delete':
					print('Deleted [', counter, '] documents in [' + elapsed + 'ms].');
				break;
			}
		}
	};
	var _finalOperation = function () {
		etime = process.hrtime();
		elapsed = (etime[0] - stime[0]) * 1e3 + Math.floor((etime[1] - stime[1]) / 1e6);
		stime = etime;

		switch(cmd) {
			case 'move':
				print('Moved [', counter, '] documents in [' + elapsed + 'ms].');
			break;
			case 'copy':
				print('Copied [', counter, '] documents in [' + elapsed + 'ms].');
			break;
			case 'delete':
				print('Deleted [', counter, '] documents in [' + elapsed + 'ms].');
			break;
		}
	};

	switch (cmd) {
		case 'copy':
		case 'move':
			// the iterator function
			var _iterator = function (doc) {
				var id = doc.id;

				return env.src.getDocument(id)
				.then(function (doc) {
					// TODO: setup the mutation plugin here!
					if (program.overwrite) {
						return env.dst.upsertDocument(id, doc.value);
					} else {
						return env.dst.insertDocument(id, doc.value);
					}
				})
				.then(function () {
					if (cmd === 'move') {
						return env.src.removeDocument(id);
					}
				})
				.catch(function (err) {
					if (err.code === 13) {
						console.error('document [key:' + id + '] does not exist, skipping... [ec:' + err.code + '][em:' + err.message + ']');
						return true;
					}

					console.error('unexpected error [key:' + id + '][ec:' + err.code + '][em:' + err.message + ']');
					throw err;
				})
				.then(_postOperation);
			};

			return env.src.viewIterator(Object.keys(program.prefix), _iterator, { iterate: !!program.iterative })
			.then(_finalOperation)
			.nodeify(terminate);
		break;

		case 'delete':
			// the iterator function
			var _iterator = function(i) {
				return env.src.removeDocument(i.id)
				.then(_postOperation);
			}

			return env.src.viewIterator(Object.keys(program.prefix), _iterator, { iterate: !!program.iterative })
			.then(_finalOperation)
			.nodeify(terminate);
		break;

		case 'validate':
			return env.src.fetchAllNotMatching(Object.keys(program.prefix))
			.then(function (res) {
				var total = 0;
				var prefixes = {};
				for (var i = 0; i < res.items.length; i++) {
					total++;
					var a = res.items[i].id.split(program.prefixSplitter);
					var pid = a[0];
					if (! (pid in prefixes)) { prefixes[pid] = []; }
					if (prefixes[pid].length < 10) { prefixes[pid].push(res.items[i].id); }
				}
				print('-------------------------------------------------------------------- REPORT');
				if (total) {
					console.log('Total bad docs:'.yellow, ('' + total).red);
					console.log('Bad prefixes (showing up to 10 sample docs per prefix):'.yellow);
					var ps = Object.keys(prefixes).sort();
					for (var i = 0; i < ps.length; i++) {
						console.log(('  [' + ps[i] + ']').red);
						for (var j = 0; j < prefixes[ps[i]].length; j++) {
							console.log('    ', prefixes[ps[i]][j]);
						}
					}
				} else {
					console.log('No invalid prefixes found!'.green);
				}
			})
			.nodeify(terminate);
		break;

		case 'check':
			return env.src.fetchAllMatching(Object.keys(program.prefix))
			.then(function (res) {
				var total = 0;
				var prefixes = {};
				for (var i = 0; i < res.items.length; i++) {
					total++;
					var a = res.items[i].id.split(program.prefixSplitter);
					var pid = a[0];
					if (! (pid in prefixes)) { prefixes[pid] = []; }
					if (prefixes[pid].length < 10) { prefixes[pid].push(res.items[i].id); }
				}
				print('-------------------------------------------------------------------- REPORT');
				if (total) {
					console.log('Total docs:'.yellow, ('' + total).green);
					console.log('Prefixes found (showing up to 10 sample docs per prefix):'.yellow);
					var ps = Object.keys(prefixes).sort();
					for (var i = 0; i < ps.length; i++) {
						console.log(('  [' + ps[i] + ']').green);
						for (var j = 0; j < prefixes[ps[i]].length; j++) {
							console.log('    ', prefixes[ps[i]][j]);
						}
					}
				} else {
					console.log('No prefixes found!'.red);
				}
			})
			.nodeify(terminate);
		break;

		case 'cleanup':
			return env.src.removeFetchAllView(Object.keys(program.prefix), 'not-matching')
			.then(function () {
				return env.src.removeFetchAllView(Object.keys(program.prefix), 'matching')
			})
			.nodeify(terminate);
		break;

		default:
			console.log('Usage: cb-admin docs <command> [opts]');
			console.log('Commands:');
			console.log('  copy');
			console.log('  move');
			console.log('  delete');
			console.log('  validate');
			console.log('  check');
		break;
	}
}

//==============================================================================
function diff(opts) {
//==============================================================================
	var props = {};

	// source can either be a file or a couchbase bucket instance
	if (opts.srcFile) {
		props.src = ddocs.import(opts.srcFile);
	} else {
		props.src = env.src.getDesignDocuments();
	}

	// destination can either be a file or a couchbase bucket instance
	if (opts.dstFile) {
		props.dst = ddocs.import(opts.dstFile);
	} else {
		props.dst = env.dst.getDesignDocuments();
	}

	return Promise.props(props)
	.then(function (r) {
		return ddocs.compare(r.src, r.dst, opts);
	})
	.then(print_report);
}

//==============================================================================
function confirm(message, callback) {
//==============================================================================
	read({ prompt: message, input: process.stdin, output: process.stdout, silent: false }, function (err, data) {
		if (err) { throw err; }

		if (data && data.match(/^(y|yes|1)$/i)) {
			return callback(null, true);
		}

		return callback(null, false);
	});
}

//==============================================================================
function print_report(report) {
//==============================================================================
	var create = report.diff;
	var checked = report.checked;
	var i, j, status;

	print('-------------------------------------------------------------------- REPORT');
	for (i in checked) {
		status = checked[i].status;
		if (status === 'ok') {
			print('design doc [', i.bold.white, '] ', status.green);
		} else {
			print('design doc [', i.bold.white, '] ', status.bold.red);
		}

		for (j in checked[i].params) {
			status = checked[i].params[j].status;
			if (status === 'ok') {
				program.verbose && print('  design doc param [', i, '.', j.bold.white, '] ', status.green);
			} else {
				print('  design doc param [', i, '.', j.bold.white, '] ', status.bold.red);
			}
		}

		for (j in checked[i].views) {
			status = checked[i].views[j].status;
			if (status === 'ok') {
				program.verbose && print('  design doc view [', i, '.', j.bold.white, '] ', status.green);
			} else {
				print('  design doc view [', i, '.', j.bold.white, '] ', status.bold.red);
			}
		}
	}

	return report;
}

//==============================================================================
function upgrade(report) {
//==============================================================================
	var create = report.diff;

	print('-------------------------------------------------------------------- UPGRADE SUMMARY');
	if (Object.keys(create).length >= 1) {
		for (var i in create) {
			print('upgrading design doc [', i.bold.yellow, ']');
		}

		print('--------------------------------------------------------------------');
		return confirm('continue with design document update/creation? (y/N) ', function (err, ok) {
			if (err) { return terminate(err); }
			if (!ok) { return terminate(); }

			print('-------------------------------------------------------------------- UPGRADE STARTED');
			return Promise.map(
				Object.keys(create),
				function (n) {
					return env.dst.installDesignDocument(n, create[n]);
				},
				{
					concurrency: 1
				})
			.then(function () {
				print('-------------------------------------------------------------------- UPGRADE COMPLETE');
			})
			.nodeify(terminate);
		});
	} else {
		print('Nothing to upgrade');
		return terminate();
	}
}

//==============================================================================
function print() {
//==============================================================================
	var args = Array.apply(null, arguments);

	console.log(args.join(''));
}

//==============================================================================
function hash_hex(data) {
//==============================================================================
	var hash = crypto.createHash('sha1');

	if (! (data instanceof Array)) {
		data = [data];
	}

	data.forEach(function (d) {
		this.update(d);
	}.bind(hash));

	return hash.digest('hex');
}


//==============================================================================
function terminate(err) {
//==============================================================================
	print('-------------------------------------------------------------------- TERMINATING');
	Promise.delay(1000)
	.then(function () {
		if (err) {
			console.error(err);
		}
		try {
			if (env.src) { env.src.disconnect(); }
			if (env.dst) { env.dst.disconnect(); }
		} catch (e) {
			console.log('error:', e.message);
		}
		if (err) { throw err; }

		console.log('bye');
	});
}
