#!/bin/bash

keypair="$(node -e 'keyPair = require("../signer/node_modules/tweetnacl").sign.keyPair();
console.log(Buffer.from(keyPair.publicKey).toString("base64"));
console.log(Buffer.from(keyPair.secretKey).toString("base64"));
console.log("");')"

echo "${keypair}"

counter=0
while IFS='' read -r line || [[ -n "$line" ]]; do
	echo "$line" > key_"$counter"
	let counter++
done <<< "${keypair}"

mv ./key_0 ../signer/pk/signer.pub
mv ./key_1 ../signer/sk/sign_key