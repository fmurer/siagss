#!/bin/bash

unamestr=`uname`

echo "Get jquery-qrcode"
echo "-------------------------------------------------"
if [[ "$unamestr" == 'Linux' ]]; then
    wget https://raw.githubusercontent.com/lrsjng/jquery-qrcode/master/dist/jquery-qrcode.js;
    wget https://raw.githubusercontent.com/lrsjng/jquery-qrcode/master/dist/jquery-qrcode.min.js
elif [[ "$unamestr" == 'Darwin' ]]; then
    curl -O https://raw.githubusercontent.com/lrsjng/jquery-qrcode/master/dist/jquery-qrcode.js;
    curl -O https://raw.githubusercontent.com/lrsjng/jquery-qrcode/master/dist/jquery-qrcode.min.js
fi

mkdir -p ../signer/node_modules/jquery_qrcode/
mkdir -p ../signee/node_modules/jquery_qrcode/

cp jquery-qrcode.js ../signer/node_modules/jquery_qrcode/
mv jquery-qrcode.js ../signee/node_modules/jquery_qrcode/
cp jquery-qrcode.min.js ../signer/node_modules/jquery_qrcode/
mv jquery-qrcode.min.js ../signee/node_modules/jquery_qrcode/
