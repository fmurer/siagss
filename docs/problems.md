# Encountered Problems

## Screen alignment
It seems to be very crucial to perfectly align the screens in order for the cameras to capture the QR-code. Already a small misalignment results in either the camera taking longer to read the QR-code or not being able to read it at all. Also, the distance from camera to the screen seems to play a bigger role. As soon as the QR-codes get larger, the camera cannot read the QR-code when it is too far away.

```
Screen Alignment turned out not to be that important as assumed in the beginning! More important is the screen brightness. I have always used a to bright screen such that there was not enought contrast for the QR-code, meaning that the bright parts burned out the black parts. Because of this, the camera could not recognice the whole QR-code.
```


## Single Core Usage
Unfortunately, Node JS is only a single threaded process, thus uses only one CPU core. This reduces performance. Although there are some methods in node with which one can use all cores, it is not recommended in this case, because those modules do not support shared variables which would be needed in our case. Furthermore, it also does not really make sense, because we can only handle one request after the other which means that we again process the requests in sequence and not in parallel. The only benefit we would have by using every core would be faster QR-decoding (when done on the server instead of the browser), faster QR-generation and siging.

## Key Schedule
How to make sure the signee has received the new key schedule? Currently, on every new key schedule generation, the signer shows its qr-code. However, if this happens during processing new reqeusts, the signer might refresh the QR-code even before the signee could read the new key schedule.

Also, currently the signee can only read a QR-code that consists of a key schedule of length 3, i.e., three public keys with start and end date.

## authentication
How to authenticate key distributions? Is a pre-shared key necessary (private/public)?
