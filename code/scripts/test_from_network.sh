#!/bin/bash

CURL='/usr/bin/curl'

for i in {1..50}
do
    #$CURL $CURL_FLAGS $HOST
    $CURL -d "data=Hello World Number $i" http://localhost:3001;
done
exit 0
