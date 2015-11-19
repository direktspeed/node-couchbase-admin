'use strict';

function validateOptions(namespace, command, options) {
	switch (namespace) {
		case 'docs':
			validateDocsOptions(command, options);
		break;
		case 'dd':
		case 'design-documents':
			validateDDOptions(command, options);
		break;
	}
}

function validateDocsOptions(command, options) {
	switch (command) {
		case 'copy':
		case 'move':
			if (! options.prefix) {
				throw new Error('missing --prefix option');
			}

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
				throw new Error('invalid --src option, must be a connection string');
			}
		break;

		case 'delete':
			if (! options.prefix) {
				throw new Error('missing --prefix option');
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

		case 'validate':
		case 'check-prefix':
		case 'cleanup':
			if (! options.prefix) {
				throw new Error('missing --prefix option');
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

function validateDDOptions(command, options) {
	switch (command) {
		case 'upgrade':
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

		case 'diff':
			if (! options.dst) {
				throw new Error('missing --dst option');
			}
			if (options.dst.match(/^[\.\w0-9]+:[0-9]{1,5}$/)) {
				options.dstConn = options.dst;
			} else {
				// TODO: make sure the file exists
				options.dstFile = options.dst;
				//throw new Error('invalid --dst option, must be a connection string');
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
