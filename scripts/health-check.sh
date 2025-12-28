#!/bin/bash
set -e
ENVIRONMENT=${1:-"production"}
HEALTH_URL="https://all-in-one-business-terminal-${ENVIRONMENT}.vercel.app/api/health"
TIMEOUT=30
RETRY_COUNT=3

echo "Checking health for environment: $ENVIRONMENT"
echo "Health URL: $HEALTH_URL"

for i in $(seq 1 $RETRY_COUNT); do
    echo "Health check attempt $i/$RETRY_COUNT"
    
    if curl -f --max-time $TIMEOUT "$HEALTH_URL"; then
        echo "Health check passed!"
        exit 0
    else
        echo "Health check failed, attempt $i/$RETRY_COUNT"
        if [ $i -lt $RETRY_COUNT ]; then
            echo "Waiting 10 seconds before retry..."
            sleep 10
        fi
    fi
done

echo "Health check failed after $RETRY_COUNT attempts"
exit 1
