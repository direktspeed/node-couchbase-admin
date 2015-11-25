var cbadmin = require('../index.js');

var bucket = new cbadmin.Bucket({
	conn: '10.0.2.16:8091',
	bucket: 'dev_test'
});

// test creating a view
bucket.createView('dev_tests', 'view1', { map: 'function (doc, meta) { emit(meta.id, null); }' })
// test creating the same view, should not end in error
.then(function () {
	console.log('create: OK');

	return bucket.createView('dev_tests', 'view1', { map: 'function (doc, meta) { emit(meta.id, null); }' })
	.then(function () {
		console.log('recreate: OK');
	})
	.catch(function (err) {
		console.log('recreate: NOK');
		throw err;
	});
})
// test creating instead of upgrading, should cause a conflict error
.then(function () {
	return bucket.createView('dev_tests', 'view1', { map: 'function (doc, meta) { emit(doc, null); }' })
	.then(function () {
		console.log('conflict error: NOK');
		throw new Error('expected view creation conflict');
	})
	.catch(function (err) {
		if (err.message === 'VIEW_CONFLICT') {
			console.log('conflict error: OK');
			return true;
		}

		console.log('conflict error: NOK');
		throw err;
	});
})
// test upgrading a view
.then(function () {
	return bucket.upgradeView('dev_tests', 'view1', { map: 'function (doc, meta) { emit(doc, null); }' })
	.then(function () {
		console.log('upgrade: OK');
	})
	.catch(function (err) {
		console.log('upgrade: NOK');
		throw err;
	});
})
.then(function () {
	return bucket.removeView('dev_tests', 'view1')
	.then(function () {
		console.log('remove view: OK');
	})
	.catch(function (err) {
		console.log('remove view: NOK');
		throw err;
	})
})
// test creating a production view
.then(function () {
	return bucket.createView('tests', 'view1', { map: 'function (doc, meta) { emit(meta.id, meta.id); }' })
})
// test creating the same view, should not end in error
.then(function () {
	console.log('create: OK');

	return bucket.createView('tests', 'view1', { map: 'function (doc, meta) { emit(meta.id, meta.id); }' })
	.then(function () {
		console.log('recreate: OK');
	})
	.catch(function (err) {
		console.log('recreate: NOK');
		throw err;
	});
})
// test creating instead of upgrading, should cause a conflict error
.then(function () {
	return bucket.createView('tests', 'view1', { map: 'function (doc, meta) { emit(meta.id, doc); }' })
	.then(function () {
		console.log('conflict error: NOK');
		throw new Error('expected view creation conflict');
	})
	.catch(function (err) {
		if (err.message === 'VIEW_CONFLICT') {
			console.log('conflict error: OK');
			return true;
		}

		console.log('conflict error: NOK');
		throw err;
	});
})
// test upgrading a production view
.then(function () {
	return bucket.upgradeView('tests', 'view1', { map: 'function (doc, meta) { emit(doc, null); }' })
	.then(function () {
		console.log('upgrade: OK');
	})
	.catch(function (err) {
		console.log('upgrade: NOK');
		throw err;
	});
})
.then(function () {
	return bucket.removeView('tests', 'view1')
	.then(function () {
		console.log('remove view: OK');
	})
	.catch(function (err) {
		console.log('remove view: NOK');
		throw err;
	})
})
.then(function () {
	bucket.disconnect();
})
.catch(function (err) {
	console.error(err.stack);
	console.error('tests failed');
	bucket.disconnect();
});
