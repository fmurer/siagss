#!/bin/bash

CURL='/usr/bin/curl'

if [ "$#" -ne 1 ]; then
    echo "Please pass the signing host as argument!"
	echo "example: ./test_from_network.sh localhost"
	exit 1
fi

for i in {1..100}
do
    #data="{ 'IP': '192.168.0.$i', 'HOST': 'localhost$i'}";
    data="7b20274950273a20273139322e3136382e302e272c2027484f5354273a20276c6f63616c686f7374277d0a";
    from="07/11/2017";
    to="07/12/2017";
    $CURL -d "data=$data&from=$from&to=$to" http://$1:3000 &
    #sleep 0.1
    #echo "";
done
exit 0
