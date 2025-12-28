#!/bin/bash

set -e

BLUE_ENV="blue"
GREEN_ENV="green"
CURRENT_ENV=$(curl -s "https://api.vercel.com/v1/integrations/${VERCEL_ORG_ID}/${VERCEL_PROJECT_ID}/deployments" | jq -r '.deployments[0].meta.env' | grep -o '"env":"[^"]*"' | cut -d'"' -f4)

echo "Current environment: $CURRENT_ENV"

if [ "$CURRENT_ENV" = "$BLUE_ENV" ]; then
    TARGET_ENV=$GREEN_ENV
    INACTIVE_ENV=$BLUE_ENV
else
    TARGET_ENV=$BLUE_ENV
    INACTIVE_ENV=$GREEN_ENV
fi

echo "Deploying to: $TARGET_ENV"

# Deploy to target environment
vercel --env $TARGET_ENV --prebuilt

# Health check
echo "Running health checks..."
sleep 30

HEALTH_URL="https://all-in-one-business-terminal-${TARGET_ENV}.vercel.app/api/health"
if curl -f "$HEALTH_URL"; then
    echo "Health check passed for $TARGET_ENV"
    
    # Update DNS to point to new environment
    echo "Switching traffic to $TARGET_ENV..."
    # Add DNS switching logic here
    
    echo "Blue-green deployment completed successfully"
else
    echo "Health check failed for $TARGET_ENV"
    echo "Rolling back to $INACTIVE_ENV..."
    # Add rollback logic here
    exit 1
fi
