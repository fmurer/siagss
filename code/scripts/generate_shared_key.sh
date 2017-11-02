#!/bin/bash

key_signee='../signee/sk/auth_key'
key_signer='../signer/sk/auth_key'
key=`node -e 'console.log(Buffer.from(require("../signer/node_modules/tweetnacl").sign.keyPair().secretKey).toString("hex"))'`

echo $key > $key_signee
echo $key > $key_signer
