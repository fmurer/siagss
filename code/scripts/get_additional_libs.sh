#!/bin/bash

instascan_url='https://github.com/schmich/instascan/releases/download/1.0.0/instascan.min.js'
jquery_qrcode_url='https://github.com/lrsjng/jquery-qrcode/raw/master/dist/jquery-qrcode.min.js'


echo "[***]    Download files"
unamestr=`uname`
if [[ "$unamestr" == 'Linux' ]]; then
    wget $instascan_url
    wget $jquery_qrcode_url
elif [[ "$unamestr" == 'Darwin' ]]; then
    CURL='/usr/bin/curl'
    $CURL -L -O $instascan_url
    $CURL -L -O $jquery_qrcode_url
fi

echo "[***]    Create directories"
mkdir -p ../signee/node_modules/instascan
mkdir -p ../signee/node_modules/jquery_qrcode

mkdir -p ../signer/node_modules/instascan
mkdir -p ../signer/node_modules/jquery_qrcode

echo "[***]    Copy files to Signee"
cp ./instascan.min.js ../signee/node_modules/instascan/
cp ./jquery-qrcode.min.js ../signee/node_modules/jquery_qrcode/

echo "[***]    Copy files to Signer"
cp ./instascan.min.js ../signer/node_modules/instascan/
cp ./jquery-qrcode.min.js ../signer/node_modules/jquery_qrcode/

rm ./instascan.min.js
rm ./jquery-qrcode.min.js
