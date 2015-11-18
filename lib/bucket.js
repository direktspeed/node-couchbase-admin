'use strict';

var assert = require('assert');
var couchbase = require('couchbase');
var Promise = require('bluebird');
var helpers = require('./helpers');

var ViewQuery = couchbase.ViewQuery;

Promise.promisifyAll(couchbase);
Promise.promisifyAll(require('couchbase/lib/bucket').prototype);
Promise.promisifyAll(require('couchbase/lib/bucketmgr').prototype);

//==============================================================================
function Bucket(params) {
//==============================================================================
	assert(params);
	assert(params.conn);
	assert(params.bucket);

	this._cluster = new couchbase.Cluster(params.conn);
	this._logger = {
		debug: function () {},
		info: function () {},
		warn: function () {},
		error: function () {}
	};
	this._data = {};

	if (params.logger) {
		assert(params.logger.debug);
		assert(params.logger.info);
		assert(params.logger.warn);
		assert(params.logger.error);

		this._logger = params.logger;
	}

	this._bucket = this._cluster.openBucket(params.bucket);
	this._bucket_manager = this._bucket.manager();

	return this;
}

//==============================================================================
Bucket.prototype.disconnect = function () {
//==============================================================================
	if (this._bucket) {
		this._bucket.disconnect();
	}
}

//==============================================================================
Bucket.prototype.getDesignDocuments = function() {
//==============================================================================
	return this._bucket_manager.getDesignDocumentsAsync();
};

//==============================================================================
Bucket.prototype.installDesignDocument = function (name, data) {
//==============================================================================
	this._logger.info('creating [', name, ']');

	var self = this;

	// create the development design document
	return self._bucket_manager.upsertDesignDocumentAsync('dev_' + name, data)
	.then(function () {
		self._logger.debug('created [', 'dev_' + name, ']');
	})
	// wait for creation to complete
	.delay(2000)
	// index the development design document
	.then(function () {
		var view_names = Object.keys(data.views);

		return self._bucket.queryAsync(ViewQuery.from('dev_' + name, view_names[0]).stale(ViewQuery.Update.BEFORE).full_set(true).key('dummykey'))
		.then(function () {
			self._logger.debug('fetched [', 'dev_' + name + '.' + view_names[0], ']');
		})
		.catch(function (err) {
			self._logger.error(err);
			throw new Error('failed to fetch [dev_' + name + '.' + view_names[0] + ']');
		});
	})
	// publish the development design document
	.then(function () {
		return self._bucket_manager.upsertDesignDocumentAsync(name, data)
		.then(function () {
			self._logger.debug('created [', name, ']');
		})
		.catch(function (err) {
			self._logger.error(err);
			throw new Error('failed to create [' + name + ']');
		});
	})
	// Remove the development design document
	.then(function () {
		return self._bucket_manager.removeDesignDocumentAsync('dev_' + name)
		.then(function () {
			self._logger.debug('removed [', 'dev_' + name, ']');
		})
		.catch(function (err) {
			self._logger.error(err);
			throw new Error('failed to remove [dev_' + name + ']');
		});
	});
};

//============================================================================
Bucket.prototype.fetchAllMatching = function (prefixes) {
//==============================================================================
	return this.createFetchAllView(prefixes, 'matching').then(this.runView.bind(this));
}

//============================================================================
Bucket.prototype.fetchAllNotMatching = function (prefixes) {
//==============================================================================
	return this.createFetchAllView(prefixes, 'not-matching').then(this.runView.bind(this));
}

//============================================================================
Bucket.prototype.createFetchAllView = function (prefixes, type) {
//==============================================================================
	var viewcode = 'function (doc, meta) {';
	if (prefixes) {
		var j = [];
		for (var i = 0; i < prefixes.sort().length; i++) {
			if (type && type === 'not-matching') {
				j.push('meta.id.indexOf(\'' + prefixes[i] + '\') !== 0');
			} else {
				j.push('meta.id.indexOf(\'' + prefixes[i] + '\') === 0');
			}
		}
		if (type && type === 'not-matching') {
			viewcode += 'if (' + j.join(' && ') + ') ';
		} else {
			viewcode += 'if (' + j.join(' || ') + ') ';
		}
		viewcode += '{ emit(doc.id, null); }';
	} else {
		viewcode += 'emit(doc.id, null);';
	}
	viewcode += '}';

	var viewid = 'view_' + helpers.hash_hex(viewcode);

	return this.getDesignDocuments()
	.then(function (ddocs) {
		if (! ddocs.dev_cbadmin) {
			ddocs.dev_cbadmin = { views: {} };
		}
		if (! ddocs.dev_cbadmin.views[viewid]) {
			ddocs.dev_cbadmin.views[viewid] = {
				map: viewcode
			};
			return this.installDevDesignDocument('cbadmin', ddocs.dev_cbadmin)
			.then(function () {
				return viewid;
			});
		}

		return viewid;
	}.bind(this));
}

//============================================================================
Bucket.prototype.viewIterator = function (prefixes, handler) {
//==============================================================================
	var self = this;

	return this.createFetchAllView(prefixes, 'match')
	.then(function (viewid) {
		return self._iterator(viewid, 0, 100, handler);
	});
}

//============================================================================
Bucket.prototype._iterator = function (viewid, from, limit, handler) {
//============================================================================
	var ctx = {
		next: null,
		from: from,
		limit: limit,
		handler: handler,
	};
	var self = this;

	return self.runView(viewid, from, limit)
	.then(function (res) {
		ctx.next = res.meta.next;

		return Promise.map(res.items, function (doc) { return handler(doc); }, { concurrency: 1 });
	})
	.then(function () {
		if (ctx.next === null) {
			return true;
		}

		return self._iterator(viewid, ctx.next, limit, handler);
	});
}

//============================================================================
Bucket.prototype.runView = function (name, from, limit) {
//============================================================================
	var query = ViewQuery.from('dev_cbadmin', name)
		.custom({ full_set: true })
		.order(ViewQuery.Order.ASCENDING)
		.stale(ViewQuery.Update.BEFORE);

	if (from) {
		query.range(from, '\uefff');
	}
	if (limit) {
		query.limit(limit + 1) // Need to get 1 more for the "next"
	}

	return this._bucket.queryAsync(query)
	.spread(function (res, meta) {
		//return {
			//items: res,
			//meta: meta
		//};

		var spliced = [];
		if (limit) {
			 // Remove the "next" from the dataset;
			spliced = res.splice(limit, 1);
			meta.next = spliced.length ? spliced[0].key : null;
		} else {
			meta.next = null;
		}

		return {
			items: res,
			meta: meta
		};
	});
}

//============================================================================
Bucket.prototype.installDevDesignDocument = function (name, data) {
//==============================================================================
	this._logger.info('creating [dev_', name, ']');

	var self = this;

	// create the development design document
	return self._bucket_manager.upsertDesignDocumentAsync('dev_' + name, data)
	.then(function () {
		self._logger.debug('created [', 'dev_' + name, ']');
	})
	// wait for creation to complete
	.delay(2000)
	// index the development design document
	.then(function () {
		var view_names = Object.keys(data.views);

		return self._bucket.queryAsync(ViewQuery.from('dev_' + name, view_names[0]).stale(ViewQuery.Update.BEFORE).full_set(true).key('dummykey'))
		.then(function () {
			self._logger.debug('fetched [', 'dev_' + name + '.' + view_names[0], ']');
		})
		.catch(function (err) {
			self._logger.error(err);
			throw new Error('failed to fetch [dev_' + name + '.' + view_names[0] + ']');
		});
	})
};

//==============================================================================
Bucket.prototype.getDocument = function(key) {
//==============================================================================
	return this._bucket.getAsync(key);
};

//==============================================================================
Bucket.prototype.insertDocument = function(key, value, cas) {
//==============================================================================
	return this._bucket.insertAsync(key, value, { cas: cas });
};

//==============================================================================
Bucket.prototype.upsertDocument = function(key, value, cas) {
//==============================================================================
	return this._bucket.upsertAsync(key, value, { cas: cas });
};

//==============================================================================
Bucket.prototype.removeDocument = function(key) {
//==============================================================================
	return this._bucket.removeAsync(key);
};

module.exports = Bucket;
