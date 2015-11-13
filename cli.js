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

function collect(val, total) {
    total[val] = true;
    return total;
}

program
    .version('0.1.0')
    .option('-s, --src <conn or file>', 'Source cluster connection string or file')
    .option('-d, --dst <conn>', 'Destination cluster connection string')
    .option('--file <file>', 'Write the source cluster design views to a source file')
    .option('-b, --src-bucket <bucket>', 'Source bucket (defaults to default)', 'default')
    .option('-B, --dst-bucket <bucket>', 'Destination bucket (defaults to default)', 'default')
    .option('-i, --include <design doc>', 'Filter in a design document', collect, {})
    .option('-e, --exclude <design doc>', 'Filter out a design document', collect, {})
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

switch (ns) {
	case 'dd':
	case 'design-documents':
		// create source bucket instance
		if (program.srcConn) {
			print('Source connection [', program.srcConn, '][bucket:', program.srcBucket, ']');
			env.src = new Bucket({ conn: program.srcConn, bucket: program.srcBucket, logger: logger });
		}

		// create destination bucket instance
		if (program.dstConn) {
			print('Destination connection [', program.dstConn, '][bucket:', program.dstBucket, ']');
			env.dst = new Bucket({ conn: program.dstConn, bucket: program.dstBucket, logger: logger });
		}

		ddmanagement(cmd);
	break;

	default:
		console.log('Usage: cb-admin <namespace> <command> [opts]');
		console.log('Namespaces:');
		console.log('  - `dd` or `design-documents`');
	break;
}

function ddmanagement(cmd) {
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
			console.log('  - `export`');
			console.log('  - `diff`');
			console.log('  - `upgrade`');
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

	// destination can only be a couchbase bucket instance
	props.dst = env.dst.getDesignDocuments();

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
	if (env.src) { env.src.disconnect(); }
	if (env.dst) { env.dst.disconnect(); }
	if (err) { throw err; }

	console.log('-------');
	console.log('bye');
}
