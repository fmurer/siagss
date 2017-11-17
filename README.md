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

4. Send a POST request to http://ADDRESS_OF_SIGNEE:3000 with the data you want to send in the parameter `data`.


## Message Format

Quick note on the desired message format.

#### Network -> Signee:
```
data=DATA_TO_SIGN&from=VALID_FROM&to=VALID_TO
```
where this is sent as a POST request.

#### Signee -> Signer:
```
{
    id: SOME_UNIQUE_ID,
    data: { data: DATA_TO_SIGN,
            from: VALID_FROM,
            to: VALID_TO },
    mac: HMAC_OF_DATA
}
```

#### Signer -> Signee:
```
{
    id: SOME_UNIQUE_ID,
    assertion: { data: DATA_TO_SIGN,
                 valid_from: DATE_IN_UTC_FORMAT,
                 valid_until: DATE_IN_UTC_FORMAT },
    signature: SIGNATURE_OF_ASSERTION },
}
```

#### Signee -> Network:
```
{
    assertion: { data: DATA_TO_SIGN,
                 valid_from: DATE_IN_UTC_FORMAT,
                 valid_until: DATE_IN_UTC_FORMAT },
    signature: SIGNATURE_OF_ASSERTION
}
```
