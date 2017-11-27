#!/bin/bash

node -e 'keyPair = require("../signer/node_modules/tweetnacl").sign.keyPair();
console.log("PUBLIC KEY: ", Buffer.from(keyPair.publicKey).toString("hex"));
console.log("SECRET KEY: ", Buffer.from(keyPair.secretKey).toString("hex"));'
