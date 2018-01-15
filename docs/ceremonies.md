# Ceremonies

## System Definition
The System is defined to be our prototype signing system consisting of the Signer and the Signee. The Signer is isolated and can only communicate using QR-codes whereas the Signee is attached to a network and receives signing requests from there.

## Role Definition
The following part describes the different roles used in the upcoming ceremonies

### Signer
The Signer `S` is one part of the system and responsible for signing incoming requests. It has the capability of generating new key pairs (public/private key), sign requests, compute hashes. Furthermore, the Signer has a Trusted Platform Module (TPM) with a given key pair `K_{TPM}, K_{TPM}^-1` where `K_{TPM}` denotes the public key.

### Verifier
A Verifier `V` is a small device, for example a tablet or smartphone capable of scanning and decoding a QR-code. Every Verifier `V_i` belongs to exactly one administrator `A_i` and is secured by some kind of authentication mechanism like a PIN which only the corresponding administrator knows. A Verifier is capable of some basic cryptographic operations such as signing and verifying messages, computing hash values of messages.

### Administrator
An Administrator `A` is a human trained in operating security sensitive computer systems. Each administrator `A_i` has a associated verifier `V_i` like defined above and knows the corresponding PIN.


## Ceremonies
In the following, we want to define some protocols, called ceremonies, that include human interaction, i.e., participation of one or more administrators.

### Initialisation
**Purpose**
This ceremony initialises the system, more specifically the Signer. In particular, this ceremony registers all the administrators, defines the quorum threshold, generates the first key pair of the signer and distributes the Signer's public to the Verifiers of the administrators.

**Pre-Condition**
The only pre-condition the Signer has is the given key pair of its TPM, i.e., `K_{TPM}, K_{TPM}^-1`. The Verifiers `V_i` have a predefined configuration file `C_i` which contains the number of participating administrators `N` as well as a quorum threshold `t`. All the administrators know their PIN in order to authenticate with their Verifier device.

**Post-Condition**
The Signer has the following

* A list of all participating administrators `L`
* A quorum threshold `t`
* A public/private key pair `K_S, K_S^-1` 
* Stores a measurement (hash) of `L, K_S, C_i` on the TPM

All the Verifiers `V_i` has the follwoing

* A public/private key pair `K_i, K_i^-1`
* The Signer's public key `K_S`
* Configuration file `C_i`

### Log Verification
**Purpose**
For every action of the Signer gets logged in a file. Furthermore, the Signer also stores an aggregated hash of this log file. The goal of this ceremony to verify if the log is correct. This ceremony can be executed by only one administrator.

**Pre-Condition**
The precondition for this ceremony is a initialised system. 

**Post-Condition**
The administrator can verify whether the log is correct or not.


### Key Backup / Replication
**Purpose**
The purpose of this ceremony is to backup the Signer's private key on another machine. However, this ceremony could also be used to replicate the system if one wants to load balance the reqeusts.

**Pre-Condition**
The precondition is a initialised system. Furthermore, there needs to be a second initialised system (initialised by the same administrators as the original system), the backup system `S_backup` having its public/private key pair `K_B, K_B^-1` for backups.

**Post-Condition**
The private key of the first Signer `K_S^-1` is now stored on the backup machine `S_backup` hence `S` and `S_backup` share the same private key.


