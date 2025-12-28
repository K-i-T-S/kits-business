#!/bin/bash
set -e

ENVIRONMENT=${1:-"production"}
LOG_FILE="deployment-monitor.log"
ALERT_THRESHOLD=5

echo "Starting deployment monitoring for: $ENVIRONMENT"

# Check deployment status
DEPLOYMENT_STATUS=$(vercel ls $VERCEL_PROJECT_ID --scope $VERCEL_ORG_ID | grep "$ENVIRONMENT" | head -1 | awk '{print $2}')

echo "Deployment status: $DEPLOYMENT_STATUS"

# Monitor application metrics
echo "Checking application metrics..."

# Check response time
RESPONSE_TIME=$(curl -o /dev/null -s -w '%{time_total}' "https://all-in-one-business-terminal-${ENVIRONMENT}.vercel.app")
echo "Response time: ${RESPONSE_TIME}s"

# Check error rate
ERROR_COUNT=$(curl -s "https://all-in-one-business-terminal-${ENVIRONMENT}.vercel.app/api/health" | grep -c "error" || echo "0")
echo "Error count: $ERROR_COUNT"

# Log results
echo "$(date): Environment=$ENVIRONMENT, Status=$DEPLOYMENT_STATUS, ResponseTime=$RESPONSE_TIME, Errors=$ERROR_COUNT" >> $LOG_FILE

# Send alerts if needed
if (( $(echo "$RESPONSE_TIME > 2.0" | bc -l) )); then
    echo "High response time detected: ${RESPONSE_TIME}s"
    # Send alert logic here
fi

if [ "$ERROR_COUNT" -gt "$ALERT_THRESHOLD" ]; then
    echo "High error rate detected: $ERROR_COUNT errors"
    # Send alert logic here
fi

echo "Monitoring completed"
