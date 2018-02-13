#!/bin/bash

cd pk && rm * && cd ..
touch pk/pk_schedule
touch pk/signer.pub
touch pk/verifier_keys

cd sk && rm * && cd ..
touch sk/sk_schedule
touch sk/sign_key
touch sk/auth_key

cd logs && rm * && cd ..
touch logs/signer.log
touch logs/signer_log.hash
touch logs/log_counter
