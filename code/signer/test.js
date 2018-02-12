var curve = require('tweetnacl');
var crypto = require('crypto');

keypair_1 = curve.sign.keyPair();
keypair_2 = curve.sign.keyPair();

test_message = "Hello world"
nonce = crypto.randomBytes(24).toString('base64');



// send from 1 --> 2
enc = curve.box(Buffer.from(test_message), Buffer.from(nonce, 'base64'), keypair_2.publicKey, keypair_1.secretKey);

msg = curve.box.open(enc, Buffer.from(nonce, 'base64'), keypair_1.publicKey, keypair_2.secretKey);

if (msg) {
	console.log(msg);
} else {
	console.log("ERROR");
}