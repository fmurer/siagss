#!/bin/bash

cd pk && rm * && cd ..
touch pk/pk_schedule
touch pk/signer.pub

cd sk && rm * && cd ..
touch sk/auth_key
