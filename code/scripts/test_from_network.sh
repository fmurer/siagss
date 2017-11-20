#!/bin/bash

CURL='/usr/bin/curl'

if [ "$#" -ne 1 ]; then
    echo "Please pass the signing host as argument!"
	echo "example: ./test_from_network.sh localhost"
	exit 1
fi

for i in {1..50}
do
    data="{ 'IP': '192.168.0.$i', 'HOST': 'localhost$i'}";
    from="07/11/2017";
    to="07/12/2017";
    $CURL -d "data=$data&from=$from&to=$to" http://$1:3000 &
    #sleep 0.5
    #echo "";
done
exit 0
