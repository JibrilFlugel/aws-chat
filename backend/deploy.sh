#!/bin/bash

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | sed 's/#.*//g' | xargs)
fi

# Check if ALLOWED_IP is set
if [ -z "$ALLOWED_IP" ]; then
    echo "Error: ALLOWED_IP not set in .env file"
    exit 1
fi

echo "Deploying with allowed IP: $ALLOWED_IP"
cdk deploy --context allowedip="$ALLOWED_IP"