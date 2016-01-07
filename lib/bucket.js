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
	this._timeout = 0;
	this._maxRetries = 10;
	this._op_cnt = 0;

	if (params.logger) {
		assert(params.logger.debug);
		assert(params.logger.info);
		assert(params.logger.warn);
		assert(params.logger.error);

		this._logger = params.logger;
	}

	this._admin_design_document = params.admin_design_document || 'cbadmin';

	this._bucket = this._cluster.openBucket(params.bucket);
	this._bucket_manager = this._bucket.manager();

	couchbase.operationTimeout = params.timeout || (10 * 60 * 1000); // 10 minutes

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

	// if it is a development design document then we just create it and run the
	// first view without publishing it
	if (name.match(/^dev_/)) {
		// create the development design document
		return self._bucket_manager.upsertDesignDocumentAsync(name, data)
		.then(function () {
			self._logger.debug('created [', name, ']');
		})
		// wait for creation to complete
		.delay(2000)
		// index the development design document
		.then(function () {
			if ('views' in data) {
				var view_names = Object.keys(data.views);

				return self.runView(name, view_names[0], { key: 'dummykey' });
			}
		});
	}

	// create the development design document
	return self._bucket_manager.upsertDesignDocumentAsync('dev_' + name, data)
	.then(function () {
		self._logger.debug('created [', 'dev_' + name, ']');
	})
	// wait for creation to complete
	.delay(2000)
	// index the development design document
	.then(function () {
		if ('views' in data) {
			var view_names = Object.keys(data.views);

			return self.runView('dev_' + name, view_names[0], { key: 'dummykey' });
		}
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
/**
 * Creates a new view on the provided design document.
 *
 * Also creates the design document if none exists. Note that if the design doc
 * name begins with 'dev_' a Development view is created instead of a Production
 * one.
 *
 * The promise rejects with an Error if there is a view with the same name but
 * different definition.
 *
 * @param {String} design_doc_name The design document name to use
 * @param {String} view_name       The name of the view
 * @param {String} view_code       The view's code
 *
 * @returns {Promise}
 */
Bucket.prototype.createView = function (design_doc_name, view_name, view_code) {
//==============================================================================
	return this.getDesignDocuments()
	.then(function (ddocs) {
		if (ddocs[design_doc_name]) {
			if ('views' in ddocs[design_doc_name]) {
				if (view_name in ddocs[design_doc_name].views) {
					//var src_hash = helpers.hash_hex(ddocs[design_doc_name].views[view_name]);
					//var dst_hash = helpers.hash_hex(view_code);
					if (ddocs[design_doc_name].views[view_name].map !== view_code.map) {
						throw new Error('VIEW_CONFLICT');
					}
					return true;
				}
			} else {
				ddocs[design_doc_name].views = {};
			}

			ddocs[design_doc_name].views[view_name] = view_code;
		} else {
			ddocs[design_doc_name] = { views: { } };
			ddocs[design_doc_name].views[view_name] = view_code;
		}

		return this.installDesignDocument(design_doc_name, ddocs[design_doc_name]);
	}.bind(this));
}

//============================================================================
/**
 * Installs (or upgrades) a view.
 *
 * First it compares the view with any view with the same name, if it finds one
 * then it checks if the code is different. Only if the view is different will
 * it create the view.
 *
 * @param {String} design_doc_name The design document name to use
 * @param {String} view_name       The name of the view
 * @param {String} view_code       The view's code
 *
 * @returns {Promise}
 */
Bucket.prototype.upgradeView = function (design_doc_name, view_name, view_code) {
//==============================================================================
	return this.getDesignDocuments()
	.then(function (ddocs) {
		if (ddocs[design_doc_name]) {
			if ('views' in ddocs[design_doc_name]) {
				if (view_name in ddocs[design_doc_name].views) {
					//var src_hash = helpers.hash_hex(ddocs[design_doc_name].views[view_name]);
					//var dst_hash = helpers.hash_hex(view_code);
					if (ddocs[design_doc_name].views[view_name].map === view_code.map) {
						return true;
					}
				}
			} else {
				ddocs[design_doc_name].views = {};
			}

			ddocs[design_doc_name].views[view_name] = view_code;
		} else {
			ddocs[design_doc_name] = { views: { } };
			ddocs[design_doc_name].views[view_name] = view_code;
		}

		return this.installDesignDocument(design_doc_name, ddocs[design_doc_name]);
	}.bind(this));
}

//============================================================================
/**
 * Removes a view.
 *
 * @param {String} design_doc_name The design document name to use
 * @param {String} view_name       The name of the view
 *
 * @returns {Promise}
 */
Bucket.prototype.removeView = function (design_doc_name, view_name) {
//==============================================================================
	return this.getDesignDocuments()
	.then(function (ddocs) {
		if (ddocs[design_doc_name]
			&& 'views' in ddocs[design_doc_name]
			&& view_name in ddocs[design_doc_name].views) {
			// remove the view from the design doc
			delete ddocs[design_doc_name].views[view_name];
			// cleanup the design doc if there are no more views
			if (Object.keys(ddocs[design_doc_name].views).length < 1) {
				delete ddocs[design_doc_name].views;
			}
			// install the design doc
			return this.installDesignDocument(design_doc_name, ddocs[design_doc_name]);
		}

	}.bind(this));
}

//============================================================================
Bucket.prototype.fetchAllMatching = function (prefixes) {
//==============================================================================
	return this.createFetchAllView(prefixes, 'matching')
	.then(this.runAdminView.bind(this));
}

//============================================================================
Bucket.prototype.fetchAllNotMatching = function (prefixes) {
//==============================================================================
	return this.createFetchAllView(prefixes, 'not-matching')
	.then(this.runAdminView.bind(this));
}

//============================================================================
function generateFetchAllView(prefixes, type) {
//============================================================================
	var code = 'function (doc, meta) {';
	if (prefixes && prefixes.length > 0) {
		var j = [];
		for (var i = 0; i < prefixes.sort().length; i++) {
			if (type && type === 'not-matching') {
				j.push('meta.id.indexOf(\'' + prefixes[i] + '\') !== 0');
			} else {
				j.push('meta.id.indexOf(\'' + prefixes[i] + '\') === 0');
			}
		}
		if (type && type === 'not-matching') {
			code += 'if (' + j.join(' && ') + ') ';
		} else {
			code += 'if (' + j.join(' || ') + ') ';
		}
		code += '{ emit(meta.id, null); }';
	} else {
		code += 'emit(meta.id, null);';
	}
	code += '}';

	var id = 'view_' + helpers.hash_hex(code);

	return {
		id: id,
		code: code
	};
}

//============================================================================
Bucket.prototype.createFetchAllView = function (prefixes, type) {
//==============================================================================
	var view = generateFetchAllView(prefixes, type);

	var self = this;
	var name = this._admin_design_document;

	return this.getDesignDocuments()
	.then(function (ddocs) {
		if (! ddocs[name]) {
			ddocs[name] = { views: {} };
		}
		if (! ddocs[name].views[view.id]) {
			ddocs[name].views[view.id] = {
				map: view.code
			};
			return this.installDesignDocument(name, ddocs[name])
		}
	}.bind(this))
	.then(function () {
		return view.id;
	});
}

//============================================================================
Bucket.prototype.removeFetchAllView = function (prefixes, type) {
//==============================================================================
	var view = generateFetchAllView(prefixes, type);

	var self = this;
	var name = this._admin_design_document;

	return this.getDesignDocuments()
	.then(function (ddocs) {
		if (ddocs[name]) {
			var views = ddocs[name].views || {};
			var view_names = Object.keys(views);

			if (views[view.id]) {
				delete views[view.id];
			}

			if (view_names.length < 1) {
				return self._bucket_manager.removeDesignDocumentAsync(name);
			}

			return self._bucket_manager.upsertDesignDocumentAsync(name, ddocs[name]);
		}
	});
}

//============================================================================
Bucket.prototype.viewIterator = function (prefixes, iterator, opts) {
//==============================================================================
	var self = this;
	var _opts = opts || {};

	if (opts.iterate) {
		return this.createFetchAllView(prefixes, 'match')
		.then(function (viewid) {
			return self._iterator(viewid, 0, 100000, iterator);
		});
	}

	return this.fetchAllMatching(prefixes)
	.then(function (res) {
		// concurrency must be set to 1 due to handling the Couchbase timeout error
		// when spamming the server
		return Promise.map(res.items, iterator, { concurrency: 1 });
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

	return self.runAdminView(viewid, from, limit)
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
Bucket.prototype.runView = function (ddoc, name, opts) {
//============================================================================
	var query = ViewQuery.from(ddoc, name)
		.custom({ full_set: true })
		.stale(ViewQuery.Update.BEFORE)
		.reduce(false);

	if (opts.order) {
		query.order(opts.order === 'desc' ? ViewQuery.Order.DESCENDING : ViewQuery.Order.ASCENDING);
	}
	if (opts.key) {
		query.key(opts.key);
	}
	if (opts.from) {
		query.range(opts.from, '\uefff');
	} else {
		// we fetch a non stale version unless we are already in the middle of an
		// iteration
		query.stale(ViewQuery.Update.BEFORE);
	}
	if (opts.limit) {
		query.limit(opts.limit + 1) // Need to get 1 more for the "next"
	}

	var ok = function(res, meta) {
		this._timeout = 0;

		var spliced = [];
		if (opts.limit) {
			 // Remove the "next" from the dataset;
			spliced = res.splice(opts.limit, 1);
			meta.next = spliced.length ? spliced[0].key : null;
		} else {
			meta.next = null;
		}

		return {
			items: res,
			meta: meta
		};
	};

	var nok = function(e) {
		if (e.message && e.message.match(/^unknown error : error parsing failed/)) {
			e.code = 999;
		}
		switch (e.code) {
			// code 11: temporary failure, try again later
			case 11:
				this._logger.error('Query view: server temporary failure [ec:' + e.code + '][em:' + e.message + ']');
				this._timeout++;
			break;
			// code 23: client timeout exceeded for operation
			case 23:
				this._logger.error('Query view: client timeout [ec:' + e.code + '][em:' + e.message + ']');
				this._timeout++;
			break;
			case 999:
				this._logger.error('Query view: client parse error, possible timeout [ec:' + e.code + '][em:' + e.message + ']');
				this._timeout++;
			break;
			default:
				this._logger.error('Query view: unexpected error [ec:' + e.code + '][em:' + e.message + ']');
				throw e;
			break;
		}

		if (this._timeout >= this._maxRetries) {
			throw new Error('Query view: max retries for operation exceeded');
		}

		return this.runView(ddoc, name, opts);
	};

	if (this._timeout) {
		var to = Math.pow(2, this._timeout) * 5000;
		this._logger.warn('Query view: waiting [' + to + 'ms] before continuing.');

		return Promise.delay(to)
		.then(function () {
			return this._bucket.queryAsync(query);
		}.bind(this))
		.spread(ok.bind(this))
		.catch(nok.bind(this));
	}

	return this._bucket.queryAsync(query)
	.spread(ok.bind(this))
	.catch(nok.bind(this));
}

//============================================================================
Bucket.prototype.runAdminView = function (name, from, limit) {
//============================================================================
	var opts = {
		from: from,
		limit: limit,
	};

	return this.runView(this._admin_design_document, name, opts);
}

//==============================================================================
Bucket.prototype.getDocument = function(key, op) {
//==============================================================================
	if (!op) {
		op = this._op_cnt++;
	}

	var ok = function(doc) {
		this._timeout = 0;

		return doc;
	};

	var nok = function(e) {
		switch (e.code) {
			// code 11: temporary failure, try again later
			case 11:
				this._logger.error('Get document: server temporary failure [key:' + key + '][op:' + op + '][ec:' + e.code + '][em:' + e.message + ']');
				this._timeout++;
			break;
			// code 13: key does not exist
			//case 13:
			//break;
			// code 23: client timeout exceeded for operation
			case 23:
				this._logger.error('Get document: client timeout [key:' + key + '][op:' + op + '][ec:' + e.code + '][em:' + e.message + ']');
				this._timeout++;
			break;
			default:
				this._logger.error('Get document: unexpected error [key:' + key + '][op:' + op + '][ec:' + e.code + '][em:' + e.message + ']');
				throw e;
			break;
		}

		if (this._timeout >= this._maxRetries) {
			throw new Error('Get document: max retries for operation exceeded [key:' + key + '][op:' + op + ']');
		}

		return this.getDocument(key, op);
	};

	if (this._timeout) {
		var to = Math.pow(2, this._timeout) * 50;
		this._logger.warn('Get document: waiting [' + to + 'ms] before continuing [key:' + key + '][op:' + op + ']');

		return Promise.delay(to)
		.then(function () {
			return this._bucket.getAsync(key);
		}.bind(this))
		.then(ok.bind(this))
		.catch(nok.bind(this));
	}

	return this._bucket.getAsync(key)
	.then(ok.bind(this))
	.catch(nok.bind(this));
};

//==============================================================================
Bucket.prototype.insertDocument = function(key, value, cas, op) {
//==============================================================================
	if (!op) {
		op = this._op_cnt++;
	}

	var ok = function(res) {
		this._timeout = 0;

		return res;
	};

	var nok = function(e) {
		switch (e.code) {
			// code 11: temporary failure, try again later
			case 11:
				this._logger.error('Insert document: server temporary failure [key:' + key + '][op:' + op + '][ec:' + e.code + '][em:' + e.message + ']');
				this._timeout++;
			break;
			// code 13: key does not exist
			//case 13:
			//break;
			// code 23: client timeout exceeded for operation
			case 23:
				this._logger.error('Insert document: client timeout [key:' + key + '][op:' + op + '][ec:' + e.code + '][em:' + e.message + ']');
				this._timeout++;
			break;
			default:
				this._logger.error('Insert document: unexpected error [key:' + key + '][op:' + op + '][ec:' + e.code + '][em:' + e.message + ']');
				throw e;
			break;
		}

		if (this._timeout >= this._maxRetries) {
			throw new Error('Insert document: max retries for operation exceeded [key:' + key + '][op:' + op + ']');
		}

		return this.insertDocument(key, value, { cas: cas }, op);
	};

	if (this._timeout) {
		var to = Math.pow(2, this._timeout) * 50;
		this._logger.warn('Insert document: waiting [' + to + 'ms] before continuing [key:' + key + '][op:' + op + ']');

		return Promise.delay(to)
		.then(function () {
			return this._bucket.insertAsync(key, value, { cas: cas });
		}.bind(this))
		.then(ok.bind(this))
		.catch(nok.bind(this));
	}

	return this._bucket.insertAsync(key, value, { cas: cas })
	.then(ok.bind(this))
	.catch(nok.bind(this));
};

//==============================================================================
Bucket.prototype.upsertDocument = function(key, value, cas, op) {
//==============================================================================
	if (!op) {
		op = this._op_cnt++;
	}

	var ok = function(res) {
		this._timeout = 0;

		return res;
	};

	var nok = function(e) {
		switch (e.code) {
			// code 11: temporary failure, try again later
			case 11:
				this._logger.error('Upsert document: server temporary failure [key:' + key + '][op:' + op + '][ec:' + e.code + '][em:' + e.message + ']');
				this._timeout++;
			break;
			// code 13: key does not exist
			//case 13:
			//break;
			// code 23: client timeout exceeded for operation
			case 23:
				this._logger.error('Upsert document: client timeout [key:' + key + '][op:' + op + '][ec:' + e.code + '][em:' + e.message + ']');
				this._timeout++;
			break;
			default:
				this._logger.error('Upsert document: unexpected error [key:' + key + '][op:' + op + '][ec:' + e.code + '][em:' + e.message + ']');
				throw e;
			break;
		}

		if (this._timeout >= this._maxRetries) {
			throw new Error('Upsert document: max retries for operation exceeded [key:' + key + '][op:' + op + ']');
		}

		return this.upsertDocument(key, value, { cas: cas });
	};

	if (this._timeout) {
		var to = Math.pow(2, this._timeout) * 50;
		this._logger.warn('Upsert document: waiting [' + to + 'ms] before continuing [key:' + key + '][op:' + op + ']');

		return Promise.delay(to)
		.then(function () {
			return this._bucket.upsertAsync(key, value, { cas: cas });
		}.bind(this))
		.then(ok.bind(this))
		.catch(nok.bind(this));
	}

	return this._bucket.upsertAsync(key, value, { cas: cas })
	.then(ok.bind(this))
	.catch(nok.bind(this));
};

//==============================================================================
Bucket.prototype.removeDocument = function(key) {
//==============================================================================
	return this._bucket.removeAsync(key)
	.catch(function (e) {
		console.log('[code:', e.code, '][msg:', e.message, ']');
		throw e;
	});
};

module.exports = Bucket;
