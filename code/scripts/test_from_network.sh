#!/bin/bash

CURL='/usr/bin/curl'

if [ "$#" -ne 1 ]; then
    echo "Please pass the signing host as argument!"
	echo "example: ./test_from_network.sh localhost"
	exit 1
fi

for i in {1..50}
do
	request="{ 'IP': '192.168.0.$i', 'HOST': 'localhost$i'}";
    $CURL -d "data=$request" http://$1:3000 &
    sleep 0.5
    echo "";
done
exit 0
