# Encountered Problems

## Screen alignment
It seems to be very crucial to perfectly align the screens in order for the cameras to capture the QR-code. Already a slight misalignment leads to the camera failing reading the QR-code or at least takes much longer to read it. Also, make sure that you do not use screens that reflect the light, better use mat screens. Also make sure that there is not too much ambient light that disturbs the cameras.

## Single Core Usage
Unfortunately, Node JS is only a single threaded process, thus uses only one CPU core. This reduces performance. However, using a module that enables multicore usage is also not a preferable idea, since those modules do not allow shared values and parallel programming introduces new weaknesses such as race conditions. Also, since the screen displays only one QR-code, this would serialize the whole thing again so multicore computation would only give some performance when de- and encoding the QR-codes and signing.

## authentication
How to authenticate key distributions? Is a pre-shared key necessary (private/public)?
