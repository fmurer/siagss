#!/bin/bash

echo "[***]    Install modules for Signee"
cd ../signee/ && npm install

echo "[###]    Install modules for Signer"
cd ../signer/ && npm install

./get_additional_libs.sh
