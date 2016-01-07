# Changelog

## v0.3.1

Thanks to Patrick Marques for:

- [fix] TypeError if no document processed
- [fix] missed op parameter

## v0.3.0

- [new] add license to package.json
- [new] Overall changes to make the code usable as a library too instead of just
  a command line interface
- [new] method `Bucket.createView`: assist creating views which checks that they
  don't exist already, performs operations only when necessary.
- [new] method `Bucket.upgradeView`: assist creating views which creates or
  upgrades a view and only performs operations when necessary.
- [new] method `Bucket.removeView`: assist removing views which only performs
  operations when necessary.
- [upd] improve document manipulatation error handling
- [new] document manipulation: retry mechanism with exponential timeout.
- [upd] executing views: retry mechanism with exponential timeout.
- [upd] fetch stale views only when running a ranges query for the first time or
  querying a view without ranges.
- [upd] add documentation about couchbase-admin as a module instead of just a
  CLI.

## v0.2.0

- [new] `docs delete` command
- [new] `docs --admin-design-document <name>` option to specify the design
  document name used for admin operations
- [new] `docs --iterative` option to enable the use of a view iterator to
  process documents. Valid for `copy`, `move` and `delete` commands.
- [upd] `docs`: fixed some bugs and overall improvement of the document
  management group of commands
- [upd] documentation revision and improvement

## v0.1.0

- [new] `docs` module for managing documents
- [new] `docs copy`: copy docs from one cluster/bucket to another
- [new] `docs move`: move docs from one cluster/bucket to another
- [new] `docs validate`: validate docs in a cluster/bucket by checking if any
  have unknown prefixes
- [upd] `dd diff`: destination can now be a file
- [upd] `dd diff`: option `--verbose` is now required to show ignored design
  documents (e.g.: design documents only present on the destination)

## v0.0.1

First version.

- [new] `dd` or `design-documents` module for managing design documents
- [new] `dd export`: export design documents to a file
- [new] `dd diff`: compare design documents between clusters/buckets or
  previously exported design documents
- [new] `dd upgrade`: upgrade design documents on a destination cluster/bucket
  using a source cluster/bucket or file
