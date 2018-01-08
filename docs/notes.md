# Notes

Just some notes / stuff to remember

Libraries:
* [Curve25519 Algorithm](https://github.com/dchest/tweetnacl-js)
* [QR-generator](https://github.com/kazuhikoarase/qrcode-generator/tree/master/js)
* [jquery QR-Code](https://github.com/lrsjng/jquery-qrcode)
* [QR-Code scanner](https://github.com/schmich/instascan)


# Pay attention

fs.read() returns a buffer and not a string



# Formal Verification

## establish offline key

* init initialization by pressing a button
* quorum of administrators scans a qr-code initializing key generation
* system generates new key pair
* stores public key
* displays private key as qr-code and deletes it locally