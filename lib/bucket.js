'use strict';

var assert = require('assert');
var couchbase = require('couchbase');
var Promise = require('bluebird');

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

module.exports = Bucket;
