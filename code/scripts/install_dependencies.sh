#!/bin/bash

pwd=`pwd`
ADDITIONAL_SCRIPT_PATH="$pwd/get_additional_libs.sh"


echo "[***]    Install modules for Signee"
cd ../signee/ && npm install

echo "[###]    Install modules for Signer"
cd ../signer/ && npm install

echo "[***]    Install additional modules"
. "$ADDITIONAL_SCRIPT_PATH"
