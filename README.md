# Master Thesis - A Secure, Isolated and Air-Gapped Signing System

## About
Keeping the signing key save and secure is a crucial part in a public key infrastructure (PKI). If an attacker manages to steal a signing key, he is able to sign requests by himself and making everyone believe that this request has been certified by the original key holder. Whereas today, signing certificates is done by qualified certificate authorities (CA) like [**Symantec**](https://www.symantec.com/ "Symantec") or [**Verisign**](https://www.verisign.com/ "Verisign"), in the new Internet architecture [**SCION**](https://www.scion-architecture.net/ "SCION Architecture"), medium sized businesses will take over the part of a CA. In this thesis we want to develop a prototype of an easy deployable and low cost signing system that uses commodity hardware, which eventually can be applied in an authority service in RAINS (see [**SCION-Book**](https://www.scion-architecture.net/pdf/SCION-book.pdf "SCION-Book")) or in the control-plane PKI of a SCION isolation domain. The proposed system would not only eliminate the need of highly technical and secure infrastructure, but also reduces the number of qualified administrators who operate the new certificate signing system. 


## System Overview
The following picture shows an overview of how the two systems work together.
![System Overview](images/SystemOverview.png "System Overview")


## First small Demo

In order to run the signing system, do the following:

1. Start the signer
```console
./code/signer/run.sh
```
2. Initialise the Signer using the Verifier App in `./code/verifier/`

3. Start the signee on another machine
```console
./code/signee/run.sh
```

4. Pair the two systems by pressing the `p` key on the Signee's keyboard

5. Send a POST request to http://ADDRESS_OF_SIGNEE:3000 with the data you want to send in the parameter `data`.


## Message Format

Quick note on the desired message format.

#### Network -> Signee
```
data=DATA_TO_SIGN&from=VALID_FROM&to=VALID_TO
```
where this is sent as a POST request.

#### Signee -> Signer
```
{
    data: {
        0: {
            data: DATA_TO_SIGN,
            from: VALID_FROM,
            to: VALID_TO,
            id: UNIQUE_ID
        },
        ...
        i: {
            data: DATA_TO_SIGN,
            from: VALID_FROM,
            to: VALID_TO,
            id: UNIQUE_ID
        }
    },
    auth: HASH_OF_DATA
}
```

#### Signer -> Signee
```
{
    data: {
        0: {
            id: UNIQUE_ID,
            assertion: {
                data: DATA_TO_SIGN,
                from: VALID_FROM_IN_UTC,
                to: VALID_TO_IN_UTC
            },
            signature: SIGNATURE_OF_ASSERTION
        },
        ...
        i: {
            id: UNIQUE_ID,
            assertion: {
                data: DATA_TO_SIGN,
                from: VALID_FROM_IN_UTC,
                to: VALID_TO_IN_UTC
            },
            signature: SIGNATURE_OF_ASSERTION
        }
    },
    auth: HMAC_OF_DATA
}
```

#### Signee -> Network
```
{
    assertion: { data: DATA_TO_SIGN,
                 valid_from: DATE_IN_UTC_FORMAT,
                 valid_until: DATE_IN_UTC_FORMAT },
    signature: SIGNATURE_OF_ASSERTION
}
```
