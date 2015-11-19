# Couchbase Admin

A command line couchbase cluster administrator.

The primary reason this project was born was the need to compare design documents between two clusters and upgrade a destination cluster.

## Installation

  $ npm install -g couchbase-admin

## Basics

Basic syntax is: `cb-admin <command group> <command> [<command arguments>]`

The `<command group>` can be either

  * `design-documents` or `dd` for short (see the Design Documents Management section) and allows manipulating design documents between clusters/buckets.
  * `docs` (see the Document Management section) allows checking and manipulating documents between clusters/buckets.

### Full list of command arguments

This is the list of all supported command arguments. Note that some are only supported on some commands and can even be validated differently. For example, the `--src` can be either a connection string for couchbase or path to a file when using the `design-documents diff` command, but if you use the `design-documents export` command it must be a connection string only.

  * `--src <conn or path>`: can be either a couchbase connection string or a path to a file
  * `--dst <conn>`: connection string for the destination cluster
  * `--src-bucket <name>`: the name of the bucket on the source couchbase cluster
  * `--dst-bucket <name>`: the name of the bucket on the destination couchbase cluster
  * `--file <path>`: a file name; this option is only used on the `export` command
  * `--include <name>`: you can provide one or more include filters for design documents, with an include filter only design document names matching the filter will be compared/upgraded.
  * `--exclude <name>`: similar to the include filter, an exclude filter will ignore design documents whose name matches any of the exclude filters.
  * `--admin-design-document <name>`: override the default design document name used for creating views to assist in document operations. The default is `cbadmin`. Note that if the name starts with `dev_` then a development design document is created instead of a production one.
  * `--iterative`: use iterative mode when manipulating documents instead of fetching the entire list of document keys.
  * `--timeout <minutes>`: specify the couchbase timeout for all operations. The unit is minutes. Defaults to 10 minutes.
  * `--overwrite`: if true, then when moving or copying documents, if a document with the same key exists on the destination it is overwritten, otherwise it will abort the copy.

## Design Documents Management

For a quick help run `cb-admin design-documents`. For short you can also use `cb-admin dd`

### The `export` command

***Example:*** Exporting all design documents from a bucket to a JSON file

```
cb-admin dd export \
	--src localhost:8091 \
	--bucket default \
	--file localhost-default.json
```

This will create a file `localhost-default.json` with all the design documents on bucket `default` found on the couchbase cluster at `localhost:8091`.

You can omit specifying the bucket with `--bucket default` when the bucket is named `default` because that is the... erm... default behavior.

### The `diff` command

***Example:*** Checking the differences between two clusters

```
cb-admin dd diff \
	--src localhost:8091 \
	--dst remotehost:8091 \
	--src-bucket default \
	--dst-bucket default
```

***Example:*** Checking the differences between a previously exported file and a Couchbase bucket's design documents

```
cb-admin dd diff \
	--src localhost-default.json \
	--dst remotehost:8091 \
	--dst-bucket default
```

### The `upgrade` command

The upgrade command will always run a diff and prompt for confirmation before doing any changes.

***Example:*** Upgrading a bucket's design documents from another cluster/bucket

```
cb-admin dd upgrade \
	--src src.cb.node:8091 \
	--src-bucket prod \
	--dst dst.cb.node:8091 \
	--dst-bucket test
```

***Example:*** Upgrading a bucket's design documents from a previously exported file

```
cb-admin dd upgrade \
	--src localhost-default.json \
	--dst remotehost:8091 \
	--dst-bucket default
```

## Document Management

This section helps checking that all documents are properly prefixed with known prefixes as well as copying or moving documents matching certain prefixes between clusters/buckets. This group of commands will typically result in a design document (default name `cbadmin`) to be created on your source Couchbase cluster/bucket. Once operations are terminated you can safelly remove the design document.

### Document key prefixes (`--prefix <prefix>` option)

Document key prefixes assume that, first of all, you prefix your documents with a certain string (which is always a good practice) and you also have a special character which you use to split the prefix from the rest of the key. By default this character is `!` but you can change that by passing the option `--prefix-splitter <char>`.

### The `validate` command

The `validate` command checks that *all* documents in a bucket match the given prefixes.

***Example:*** Checking that all documents on bucket `test` match the prefix `test-a` or `test-b`

```
cb-admin docs validate \
	--prefix 'test-a!' \
	--prefix 'test-b!' \
	--src localhost:8091 \
	--src-bucket test
```

### The `check` command

The `check` command verifies that the bucket contains documents matching all the given prefixes.

***Example:*** Checking if there are documents in bucket `test` that match the prefix `test-a` or `test-b`

```
cb-admin docs check \
	--prefix 'test-a!' \
	--prefix 'test-b!' \
	--src localhost:8091 \
	--src-bucket test
```

### The `copy` command

**Note:** When specifying prefixes you must be aware that it will match any key that starts with that prefix. For example, if we used `--prefix 'test-old'` it would match a key named `test-oldsmobile` which could be what we want or not.

***Example:*** Copy all documents matching the prefix `test-old` or `test-older` from bucket `test` in `cluster-a` into bucket `test-old` in `cluster-b`

```
cb-admin docs copy \
	--prefix 'test-old!' \
	--prefix 'test-older!' \
	--src cluster-a.host:8091 \
	--src-bucket test \
	--dst cluster-b.host:8091 \
	--dst-bucket test-old
```

### The `move` commands

The `move` command works just like the `copy` except that it will remove the document from the source after a successful copy.

### The `delete` command

***Example:*** Delete all documents matching the prefix `test-old` or `test-older` from bucket `test` in `cluster-a`

**Note:** When specifying prefixes you must be aware that it will match any key that starts with that prefix. For example, if we used `--prefix 'test-old'` it would match a key named `test-oldsmobile` which could be what we want or not.

```
cb-admin docs delete \
	--prefix 'test-old!' \
	--prefix 'test-older!' \
	--src cluster-a.host:8091 \
	--src-bucket test
```

### The `cleanup` command

This command should be used right after a successful execution of one of the `docs` commands. It cleans the design documents created which are necessary to perform the commands. The cleanup requires the same arguments as the command which generated the views. Alternatively you can remove the design document yourself. The default name is `cbadmin` and it is created as a production design document.

## License

MIT
