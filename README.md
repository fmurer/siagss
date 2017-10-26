# Master Thesis - A Secure, Isolated and Air-Gapped Signing System


## System Overview:
The following picture shows an overview of how the two systems work together.
![System Overview](images/SystemOverview.png "System Overview")

(Step 2 and 3 might be encoded within the same QR-code)


## First small Demo

In order to run a first small demo do the following:

1. Start the signer
```console
node code/signer/app.js
```
2. Start the signee on another machine
```console
node code/signee/app.js
```

3. On both, the signer and the signee, browse to `localhost:3000`

4. Send a POST request to http://ADDRESS_OF_SIGNEE:3001 with the data you want to send in the parameter `data`.
