# Requirements to the system

The listings below contain the requirements to the two systems.

## System One (Signer):
- The system needs to read the incoming requests in form of a QR-code from a screen.
- The system must authenticate incoming requests.
- The system must sign authenticated requests.
- The system must encode the signed request in a QR-code and display it on the screen.
- The system is located in an isolated environment without connection to any network.
- The system must keep its keys secret.
- The system must be able to generate new keypairs.


## System Two (Signee):
- The system needs to receive requests from the network.
- The requests must be encoded to a QR-code and then displayed on a screen.
- The system needs to read the signed request from the screen of the signer.
- The signed requests must be sent back to the originating sender.