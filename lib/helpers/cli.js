'use strict';

function validateOptions(namespace, command, options) {
	switch (namespace) {
		case 'dd':
		case 'design-documents':
			validateDDOptions(command, options);
		break;
	}
}

function validateDDOptions(command, options) {
	switch (command) {
		case 'upgrade':
		case 'diff':
			if (! options.dst) {
				throw new Error('missing --dst option');
			}
			if (options.dst.match(/^[\.\w0-9]+:[0-9]{1,5}$/)) {
				options.dstConn = options.dst;
			} else {
				throw new Error('invalid --dst option, must be a connection string');
			}

			if (! options.src) {
				throw new Error('missing --src option');
			}
			if (options.src.match(/^[\.\w0-9]+:[0-9]{1,5}$/)) {
				options.srcConn = options.src;
			} else {
				// TODO: make sure the file exists
				options.srcFile = options.src;
			}
		break;

		case 'export':
			if (! options.file) {
				throw new Error('missing --file option');
			}

			if (! options.src) {
				throw new Error('missing --src option');
			}
			if (options.src.match(/^[\.\w0-9]+:[0-9]{1,5}$/)) {
				options.srcConn = options.src;
			} else {
				throw new Error('invalid --src option, must be a connection string');
			}
		break;
	}
}

module.exports = {
	validateOptions: validateOptions,
};
