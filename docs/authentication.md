# Authentication

This file lists some thoughts about how to authenticate the requests on the signer

- simply sign the requests
    - do a key exchange when the root key is newly generated
        - key exchange over QR-code not possible since we then would have the same issue as without authentication
    - also use Curve25519 Algorithm (only one library needed)
        - leads to double sign (overkill?)

- no authentication at all
    - put the assumption, that the two systems are in a secure environment where only authorized people have access to.

- sign every request using keys that are exchanged during the setup. Reissuing keys must be done manually
    - drawback: now automation for key issuing
    - how often do we need to renew the keys?
    - where to store key on signee?

- use HMACs
    - shared key
    - how often do we need to renew the key
    - how to distribute the key? (distribute on setup -> how to do on a renew?)

## Taken Approach
I finally choose to authenticate the requests from the signee using HMACs. The shared keys are distributed over the Diffie-Hellmann protocol using the same air-gapped channel. 
--> This is now done by simply using the old shared key. On the very first setup, which is done by a trusted administrator, the pairing is not signed!