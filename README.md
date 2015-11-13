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

### Options

  * `--src <conn or path>`: can be either a couchbase connection string or a path to a file
  * `--dst <conn>`: connection string for the destination cluster
  * `--src-bucket <name>`: the name of the bucket on the source couchbase cluster
  * `--dst-bucket <name>`: the name of the bucket on the destination couchbase cluster
  * `--file <path>`: a file name; this option is only used on the `export` command
  * `--include <name>`: you can provide one or more include filters for design documents, with an include filter only design document names matching the filter will be compared/upgraded.
  * `--exclude <name>`: similar to the include filter, an exclude filter will ignore design documents whose name matches any of the exclude filters.

## License

MIT
