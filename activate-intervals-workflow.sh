#!/bin/bash

WORKFLOW_ID="1IFMn9sjPXwX7APq"
WORKFLOW_URL="https://apfz.app.n8n.cloud/workflow/${WORKFLOW_ID}"

echo "🔧 Intervals.icu Workflow Activation"
echo ""
echo "Workflow: Coach Tri - Daily Checkin (Intervals.icu)"
echo "ID: ${WORKFLOW_ID}"
echo ""
echo "Opening workflow in browser..."
echo "Please click the 'Inactive' toggle in the top right to activate."
echo ""
echo "URL: ${WORKFLOW_URL}"
echo ""

open "${WORKFLOW_URL}"
