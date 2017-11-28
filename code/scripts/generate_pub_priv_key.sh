#!/bin/bash

keypair="$(node -e 'keyPair = require("../signer/node_modules/tweetnacl").sign.keyPair();
console.log("PUBLIC KEY: ", Buffer.from(keyPair.publicKey).toString("hex"));
console.log("SECRET KEY: ", Buffer.from(keyPair.secretKey).toString("hex"));
console.log("");')"

echo "${keypair}"

counter=0
while IFS='' read -r line || [[ -n "$line" ]]; do
	echo "$line" > key_"$counter"
	let counter++
done

mv ./key_0 ../signer/pk/signer.pub
mv ./key_1 ../signer/sk/sign_key