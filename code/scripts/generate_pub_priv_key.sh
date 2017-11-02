#!/bin/bash

key_signer=```node -e 'keyPair = require("../signer/node_modules/tweetnacl").sign.keyPair();
pub = Buffer.from(keyPair.publicKey).toString("hex");
priv = Buffer.from(keyPair.secretKey).toString("hex");
console.log("public: " + pub + "\n secret: " + priv);'
```
key_signee=```node -e 'keyPair = require("../signer/node_modules/tweetnacl").sign.keyPair();
pub = Buffer.from(keyPair.publicKey).toString("hex");
priv = Buffer.from(keyPair.secretKey).toString("hex");
console.log("public: " + pub + "\n secret: " + priv);'
```

echo "KEYS FROM SIGNER"
echo $key_signer
echo ""
echo "KEYS FROM SIGNEE"
echo $key_signee
