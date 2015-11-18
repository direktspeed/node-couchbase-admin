# Couchbase Admin

A command line couchbase cluster administrator.

The primary reason this project was born was the need to compare design documents between two clusters and upgrade a destination cluster.

## Installation

  $ npm install -g couchbase-admin

## Design Documents Management

For a quick help run `cb-admin design-documents`. For short you can also use `cb-admin dd`

### The `export` command

**Exporting all design documents from a bucket to a JSON file**

```
cb-admin dd export --src localhost:8091 --bucket default --file localhost-default.json
```

This will create a file `localhost-default.json` with all the design documents on bucket `default` found on the couchbase cluster at `localhost:8091`.

You can omit specifying the bucket with `--bucket default` when the bucket is named `default` because that is the... erm... default behavior.

### The `diff` command

**Checking the differences between two clusters**

```
cb-admin dd diff --src localhost:8091 --dst remotehost:8091 --src-bucket default --dst-bucket default
```

**Checking the differences between a previously exported file and a Couchbase bucket's design documents**

```
cb-admin dd diff --src localhost-default.json --dst remotehost:8091 --dst-bucket default
```

### The `upgrade` command

The upgrade command will always run a diff and prompt for confirmation before doing any changes.

**Upgrading a bucket's design documents from another cluster/bucket**

```
cb-admin dd upgrade --src src.cb.node:8091 --src-bucket prod --dst dst.cb.node:8091 --dst-bucket test
```

**Upgrading a bucket's design documents from a previously exported file**

```
cb-admin dd upgrade --src localhost-default.json --dst remotehost:8091 --dst-bucket default
```

## Document Management

This section helps checking that all documents are properly prefixed with known prefixes as well as copying or moving documents matching certain prefixes between clusters/buckets.

### The `validate` command

**Checking that all documents on bucket `test` match the prefix `test-a` or `test-b`**

**Note:** Document key prefixes assume that, first of all, you prefix your documents with a certain string (which is always a good practice) and you also have a special character which you use to split the prefix from the rest of the key. By default this character is `!` but you can change that by passing the option `--prefix-splitter <char>`.

```
cb-admin docs validate --prefix 'test-a!' --prefix 'test-b!' --src localhost:8091 --src-bucket test
```

### The `copy` and `move` commands

**Copy all documents matching the prefix `test-old` or `test-older` from bucket `test` in `cluster-a` into bucket `test-old` in `cluster-b`**

**Note:** When specifying prefixes you must be aware that it will match any key that starts with that prefix. For example, if we used `--prefix 'test-old'` it would match a key named `test-oldsmobile` which could be what we want or not.

```
cb-admin docs copy --prefix 'test-old!' --prefix 'test-older!' --src cluster-a.host:8091 --src-bucket test --dst cluster-b.host:8091 --dst-bucket test-old
```

The `move` command works just like the `copy` except that it will remove the document from the source after a successful copy.

## Options

  * `--src <conn or path>`: can be either a couchbase connection string or a path to a file
  * `--dst <conn>`: connection string for the destination cluster
  * `--src-bucket <name>`: the name of the bucket on the source couchbase cluster
  * `--dst-bucket <name>`: the name of the bucket on the destination couchbase cluster
  * `--file <path>`: a file name; this option is only used on the `export` command
  * `--include <name>`: you can provide one or more include filters for design documents, with an include filter only design document names matching the filter will be compared/upgraded.
  * `--exclude <name>`: similar to the include filter, an exclude filter will ignore design documents whose name matches any of the exclude filters.

## License

MIT
