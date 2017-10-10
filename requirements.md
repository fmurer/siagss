# Requirements to the system

The listings below contain a first draft of the requirements to the two systems starting with the functional requirements followed by the non-functional requirements.

## Functional Requirements:
The following points describe the functional requirements for the two systems.
### System One (Signer):
The signer must be able to
- read the incoming requests in form of a QR-code from a screen (using a camera).
- authenticate incoming requests.
- only accept valid requests and ignore all malformed requests.
- sign authenticated requests.
- encode the signed request in a QR-code and display it on the screen.
- generate new key-pairs.


### System Two (Signee):
The signee must be able to
- receive requests from the network.
- encode the requests to a QR-code and display it on a screen.
- read the signed request from the screen of the signer.
- send back the signed requests to the originating sender.


## Non-Functional Requirements:
The following points describe the non-functional requirements for the two systems.
### System One (Signer):
- The system is located in an isolated environment without connection to any network.
- The system must keep its keys secret.
- The system should be able to sign approximately 2 million signatures a day (23 signatures per second)
### System Two (Signee):

### Both systems:
- Both systems must run on a recent browser
- Both systems must be secure against an active and passive attacker sitting in the network.



## TODO:
- Keep in mind the key rollover


## System Overview:
The following picture shows an overview of how the two systems work together.
![System Overview](images/SystemOverview.png "System Overview")

(Step 2 and 3 might be encoded within the same QR-code)
