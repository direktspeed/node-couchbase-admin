# Couchbase Admin

Couchbase cluster administrator is both a CLI and API for doing administrative tasks on Couchbase clusters.

The primary reason this project was born was the need to compare design documents between two clusters and upgrade a destination cluster. It evolved and the main features now are

  * Export/import design documents into/from a file.
  * Compare and apply differences to design documents between clusters/buckets or files.
  * Create/upgrade/remove views from design documents.
  * Copy/move documents between cluster/buckets.
  * Check document keys that (do or do not) match a set of prefixes.

The project includes an API as well as a CLI. It aims to provide an easy way to perform certain tasks usually required when deploying or upgrading a Couchbase database.

## Installation

### Installing the tool on your system

  $ npm install -g couchbase-admin

### Installing the module to use on your own project

  $ npm install couchbase-admin --save

## CLI

See the [CLI reference](docs/CLI.md).

## API

See the [API reference](docs/API.md). Most API methods will return Promises using [Bluebird](http://bluebirdjs.com/docs/getting-started.html) implementation, please check the link for more information.

## License

MIT
