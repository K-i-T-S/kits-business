#!/bin/bash

set -e

TARGET_ENV=${1:-"previous"}
BACKUP_COUNT=${2:-5}

echo "Starting rollback process..."

# Get last successful deployment
LAST_SUCCESSFUL=$(vercel ls $VERCEL_PROJECT_ID --scope $VERCEL_ORG_ID | grep -v "CURRENT" | head -n $BACKUP_COUNT | tail -n 1 | awk '{print $1}')

if [ -z "$LAST_SUCCESSFUL" ]; then
    echo "No previous successful deployment found"
    exit 1
fi

echo "Rolling back to deployment: $LAST_SUCCESSFUL"

# Promote previous deployment
vercel promote $LAST_SUCCESSFUL --scope $VERCEL_ORG_ID

# Health check
sleep 30
HEALTH_URL="https://all-in-one-business-terminal.vercel.app/api/health"

if curl -f "$HEALTH_URL"; then
    echo "Rollback completed successfully"
else
    echo "Health check failed after rollback"
    exit 1
fi
