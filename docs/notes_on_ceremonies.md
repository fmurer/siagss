# Notes on Ceremonies

## Roles

### Signer
The Signer `S` is one part of the system and responsible for signing incoming requests. He has the capability of generating new key pairs (public/private key), sign requests, compute cryptographic hashes. Furthermore, the Signer stores a list of public keys (`L`) of all participating administrators.

### Verifier
A verifier `V` is a small device, for example a tablet or smartphone capable of scanning and decoding a QR-code, hence it needs to have a camera. Moreover, the device also needs a monitor in order to display the self generated QR-codes or other information to the administrator. Every verifier `V_i` belongs to exactly one administrator `A_i` and is locked by some authentication mechanism like a PIN which only the corresponding administrator knows. A verifier is capable of some basic cryptographic operations such as signing and verifying messages and computing cryptographic hashes.

### Administrator
An administrator `A` is a human trained in operating security sensitive computer systems. Most likely, he is a member of the tech staff operating the signing system. Each administrator `A_i` has a associated verifier `V_i` like defined above and knows the corresponding PIN to unlock it.



## Logging
**What to log?**
* operation caused by human interaction
* (Key relevant actions from Signer)

**Who can verify the log?**
* Administrators can verify the log

**Form of Log**
* log file + aggregated hash (epoch identifier)
* <time>||<success/failure>||<operation>||<id>
[adapted from CASTLE paper]


**Purpose**
In order to monitor the interaction between the Signer and human users, but also to discover malicious approaches to interact with the Signer, every human interaction with the Signer gets logged. Next to the log file, the Signer also stores an aggregated hash of this log in order to prevent malicious altering of the log entries. The goal of this ceremony is to verify whether the log, and therefore also the interaction with the Signer so far, is correct. In order to run this ceremony, only one administrator is needed.

**Pre-condition**
The pre-condition for this ceremony is a initialised system, meaning the Signer already knows all the participating administrators and their corresponding public keys. Furthermore, the administrator who wants to verify the log must be authenticated with his verifier device.

**Post-condition**
The administrator can verify whether the log is correct or not by recalculating the aggregated hash of the log-file from the Signer. The administrator has also learned the latest epoch identifier.



## Replication / Backup

**Purpose**
The purpose of this ceremony is to replicate the Signer's private key on another machine that also acts as a Signer. The reason why this would be done is for example a replication of the system because of load balancing. Replicating the system would give us the possibility to distribute the requests to two systems to reduce the system's load. Because of the replication, the signatures would still come from the same signing key, so there will be no noticeable difference for requesters. Moreover, this ceremony could simply be used as a backup mechanism where administrators simply can store the signing key on a second machine that has been initialised as a Signer.

**Pre-condition**
In order to execute this ceremony, we need to have two initialised systems. Thereby, both systems need to be initialised by the same group of administrators to guarantee secure transmission of the key. The second machine, let us call it the replication, also has a public/private key pair `K_B`/`K_B^{-1}`, but unlike to the original Signer, it does not use it for signing, but for encrypting and decrypting the replicated key.

**Post-condition**
After a successful execution of this ceremony, the signing key of the first Signer `K_S^{-1}` has been replicated to the second machine, the replication, hence both Signer's share now the same signing key. Moreover, the signing key must not have been learned during the ceremony by anyone else than the replication.


## Properties to Verify

### Log
* Logs can not be altered without notice

### Replication
* Secrecy of the signing key
* Both systems have the same signing key