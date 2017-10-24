# Authentication

This file lists some thoughts about how to authenticate the requests on the signer

- simply sign the requests
    - do a key exchange when the root key is newly generated
    - also use Curve25519 Algorithm (only one library needed)
        - leads to double sign (overkill?)

- no authentication at all
    - put the assumption, that the two systems are in a secure environment where only authorized people have access to.
