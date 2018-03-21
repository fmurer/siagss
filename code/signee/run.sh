#!/bin/bash

INIT_SCRIPT="./init.sh"

. "$INIT_SCRIPT"

node app.js "$@"