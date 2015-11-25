# Couchbase Administration API

## Synopsis

```JavaScript
var cbadmin = require('couchbase-admin');

var bucket = new cbadmin.Bucket({
	conn: 'localhost:8091',
	bucket: 'default',
	timeout: 10 * 60 * 1000,
	logger: {
		debug: console.log,
		info: console.log,
		warn: console.warn,
		error: console.error,
	},
	admin_design_document
});

var comparison_report = cbadmin.DesignDocuments.compare(src_ddoc, dst_ddoc);

bucket.createView('ddoc_test', 'myview', {
	map: 'function (meta, doc) { emit(meta.id, null); }'
});
```

## Bucket

### new Bucket(parameters : Object)

Creates a new Couchbase bucket connection based on the provided paramenters.

Supported paramenters:

  * `conn`: ***(required)*** a connection string, for example, `localhost:8091`
  * `bucket`: ***(required)*** the bucket to connect to
  * `timeout`: ***(optional)*** operation timeout in miliseconds, defaults to 10 minutes
  * `logger`: ***(optional)*** a logger instance with the methods `debug`, `info`, `warn` and `error`. No other methods are used by the library.
  * `admin_design_document`: ***(optional)*** this is the design document name used by `couchbase-admin` to install views required for certain operations. Note that you can provide a development design document name (prefix `dev_`) but that is not recommended. Defaults to `cbadmin`.

Full options list example:

```JavaScript
var bucket = new cbadmin.Bucket({
	conn: 'localhost:8091',
	bucket: 'default',
	timeout: 10 * 60 * 1000,
	logger: {
		debug: console.log,
		info: console.log,
		warn: console.warn,
		error: console.error,
	},
	admin_design_document: `cbadmin`
});
```

### Bucket.disconnect() : Promise

Call this to terminate the connection.

### Bucket.getDesignDocuments() : Promise

Resolves with an `Object` containing all design documents of the bucket.

### Bucket.installDesignDocument(name : String, data : Object) : Promise

Installs a new design document named `name` using the definition provided by `data`. The `data` must be with the same structure as that obtained from a `Bucket.getDesignDocuments`.

**Development Design Documents**

If the design document is prefixed with `dev_`, which is Couchbase's definition of a development design document then this method only performs the following

  * Create the design document
  * If it contains at leat one view then a query on the view is performed in order to force indexing

**Production Design Documents**

If the design document is not prefixed with `dev_` then this method will

  * Create a development design document first by prefixing `name` with `dev_`
  * If `data` contains at least one view then a query on the first view is executed in order to force indexing the whole design document
  * Publish the development design document to production
  * Remove the development design document

### Bucket.createView(design_doc_name : String, view_name : String, view_code : Object) : Promise

  * `design_doc_name` String
  * `view_name` String
  * `view_code` Object

Creates a new view on the design document provided. If the view already exists and has a different `view_code` then the `Promise` rejects with an `Error` instance. If the view already exists and is the same then nothing is done and the `Promise` resolves.

The `view_code` is something like

```JavaScript
var view_code = {
	map: 'function (meta, doc) { emit(meta.id, doc); }',
};
```
### Bucket.upgradeView(design_doc_name : String, view_name : String, view_code : Object) : Promise

Same as `creatView` except that it will overwrite a view if it is different. Does not upgrade the view if it matches the one already installed.

### Bucket.removeView(design_doc_name : String, view_name : String, view_code : Object) : Promise

Removes a view from a design document. Nothing is done if the view has already been removed from the design document.

### Bucket.fetchAllMatching(prefixes : Array) : Promise

The `prefixes` are a list of document key prefixes. If no prefix is passed then the view will return all documents in the bucket, otherwise it will return all documents matching at least one of the prefixes.

### Bucket.fetchAllNotMatching(prefixes : Array) : Promise

Same as `Bucket.fetchAllMatching` except that it will return all document keys which are not prefixed by any of the provided prefixes.

### Bucket.createFetchAllView(prefixes : Array, type : String) : Promise

Used internally.

### Bucket.removeFetchAllView(prefixes : Array) : Promise

Used internally.

### Bucket.viewIterator(prefixes : Array, iterator : Function [, opts : Object]) : Promise

Run a query on a view and the call `iterator` for each element.

Available options (`opts`):

  * `iterate : Boolean`: If `true` then it will query the view using ranged queries. This is only recommended for very large result sets (millions) or if the result set has enough data to result in a memory problem for the client. Defaults to `false`.

### Bucket.runView(ddoc : String, name : String [, opts : Object]) : Promise

Performs a query on a view. This will also detect timeouts usually result of Couchbase still indexing the view and will retry the operation. Logs will inform about the operation progress.

Available options (`opts`):

  * `order : String` Possible values are `desc` or `asc`. Defaults to `asc`.
  * `key : String` Query for a specific key.
  * `from : String` Used for range queries to mark the starting point of the range. Note that if `from` is defined then it is assumed the view was already queried and therefor indexed. This means that the query will run on a potential stale index.
  * `limit : Number` The max size of the result set.

### Bucket.runAdminView(name : String, from : String, limit : Number) : Promise

Used internally.

### Bucket.getDocument(key : String) : Promise

Fetches a document from Couchbase. Includes a retry mechanism with exponential (base 2) timeouts.

### Bucket.insertDocument(key : String, value : Mixed, cas : Object) : Promise

Inserts a document in Couchbase. This will result in an error if the key already exists. Includes a retry mechanism with exponential (base 2) timeouts.

### Bucket.upsertDocument(key : String, value : Mixed, cas : Object) : Promise

Inserts or updates a document in Couchbase. Includes a retry mechanism with exponential (base 2) timeouts.

### Bucket.removeDocument(key : String) : Promise

Removes a document from Couchbase. This will result in an error if the key already exists.

## DesignDocuments

### DesignDocuments.compare(src : Object, dst : Object, opts : Object) : Object

The return value contains a detailed report about the differences found. Please use the CLI in order to better understand the report before using this method.

### DesignDocuments.export(file : String, data : Object) : Promise

Store `data` as a JSON file named `file`. Note that a `JSON.stringify` is used on `data` in order to generate the text data to write to the file.

### DesignDocuments.import(file : String) : Promise

Reads `file` as a JSON object and returns a Promise which resolves to that object. Note that a `JSON.parse` is used on the text data read from `file`.


