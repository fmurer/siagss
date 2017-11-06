#!/bin/bash

CURL='/usr/bin/curl'
#request='{"Subject": "1-16",\
# "Issuer": "1-13",\
# "TRCVersion": 2,\
# "Version": 0,\
# "Comment": "AS certificate",\
# "CanIssue": false,\
# "IssuingTime": 1480927723,\
# "ExpirationTime": 1512463723,\
# "EncAlgorithm": "curve25519xsalsa20poly1305",\
# "SubjectEncKey": "Gfnet1MzpHGb3aUzbZQga+c44H+YNA6QM7b5p00dQkY=",\
# "SignAlgorithm": "ed25519",\
# "SubjectSignKey": "TqL566mz2H+uslHYoAYBhQeNlyxUq25gsmx38JHK8XA=",\
# "Signature": "IdI4DeNqwa5TPkYwIeBDk3xN36O5EJ/837mYyND1JcfwIOumhBK"}'


if [ "$#" -ne 1 ]; then
    echo "Please pass the signing host as argument!"
	echo "example: ./test_from_network.sh localhost"
	exit 1
fi

for i in {1..50}
do
	request="{ 'IP': '192.168.0.$i', 'HOST': 'localhost$i'}";
    time $CURL -d "data=$request" http://$1:3000 &
    echo "";
done
exit 0
