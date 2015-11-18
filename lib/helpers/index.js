var crypto = require('crypto');

//==============================================================================
function hash_hex(data) {
//==============================================================================
	var hash = crypto.createHash('sha1');

	if (! (data instanceof Array)) {
		data = [data];
	}

	data.forEach(function (d) {
		this.update(d);
	}.bind(hash));

	return hash.digest('hex');
}

module.exports = {
	hash_hex: hash_hex,
};
