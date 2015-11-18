'use strict';

var fs = require('fs');
var Promise = require('bluebird');

Promise.promisifyAll(fs);

//==============================================================================
/**
 * Compare two design documents structures and return a report and a diff.
 *
 * The diff includes all the design documents from <src> which did not match the
 * <dst> structure. This diff is a structure ready to be written to couchbase.
 *
 * The report includes details on everything that was checked and the respective
 * status. The status codes are
 *
 * - ok: full match
 * - new: something that only exists on the <src>
 * - update: the <src> and <dst> do not match
 * - dst-only: the design document exists only on the <dst> and is ignored from
 *   the diff
 * - delete: indicates that the diff  remove this part from <dst>
 *
 * @param {Object} src
 * @param {Object} dst
 * @param {Object} opts
 *        {Array}  [opts.include]
 *        {Array}  [opts.exclude]
 * @return {Object}
 */
function compare(src, dst, opts) {
//==============================================================================
	// normalize options
	opts = opts || {};

	// accessors and internal variables
	var include = opts.include;
	var exclude = opts.exclude;
	var i, j, k;
	var report = {
		diff: {},
		checked: {},
	};
	var diff = {};

	for (i in dst) {
		if (Object.keys(include).length > 0 && !include[i]) { continue; }
		if (Object.keys(exclude).length > 0 && exclude[i]) { continue; }

		if (!src[i] && !!opts.verbose) {
			report.checked[i] = { status: 'dst-only (ignored)', dst: dst[i] };
		}
	}

	for (i in src) {
		// skip any filtered design docs
		if (Object.keys(include).length > 0 && !include[i]) { continue; }
		if (Object.keys(exclude).length > 0 && exclude[i]) { continue; }

		if (! dst[i]) {
			report.checked[i] = { status: 'new', src: src[i] };
			report.diff[i] = src[i];
		} else {
			report.checked[i] = { status: 'ok', src: src[i], dst: dst[i], params: {}, views: {} };
			for (j in src[i]) {
				if (!dst[i][j]) {
					report.checked[i].status = 'update';
					report.checked[i].params[i] = { status: 'new' };
					report.diff[i] = src[i];
				}
			}

			if (src[i].views) {
				for (j in src[i].views) {
					if (! dst[i].views[j]) {
						report.checked[i].status = 'update';
						report.checked[i].views[j] = { status: 'new', src: src[i].views[j] };
						report.diff[i] = src[i];
					} else {
						report.checked[i].views[j] = { status: 'ok', src: src[i].views[j], dst: dst[i].views[j] };
						var src_view = src[i].views[j];
						var dst_view = dst[i].views[j];
						for (k in src_view) {
							if (! dst_view[k]) {
								report.checked[i].status = 'update';
								report.checked[i].views[j] = { status: 'update', src: src[i].views[j], dst: dst[i].views[j] };
								report.diff[i] = src[i];
							} else {
								if (src_view[k] !== dst_view[k]) {
									report.checked[i].status = 'update';
									report.checked[i].views[j] = { status: 'update', src: src[i].views[j], dst: dst[i].views[j] };
									report.diff[i] = src[i];
								}
							}
						}
					}
				}
			}

			// check for extra views on the destination
			if (dst[i].views) {
				for (j in dst[i].views) {
					if (! src[i].views[j]) {
						report.checked[i].status = 'update';
						report.checked[i].views[j] = { status: 'delete', dst: dst[i].views[j] };
						report.diff[i] = src[i];
					}
				}
			}
		}
	}

	return report;
}

//==============================================================================
function exportDesignDocuments(file, data) {
//==============================================================================
	return fs.writeFileAsync(file, JSON.stringify(data, null, 2));
}

//==============================================================================
function importDesignDocuments(file) {
//==============================================================================
	return fs.readFileAsync(file)
	.then(function (data) {
		return JSON.parse(data);
	});
}

module.exports = {
	compareSync: compare,
	compare: Promise.method(compare),
	import: importDesignDocuments,
	export: exportDesignDocuments,
};
