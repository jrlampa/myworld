#!/bin/bash

# Script to create Cloud Tasks queue for sisRUA application
# This script should be run once during initial deployment or if the queue is deleted

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values (can be overridden with environment variables)
PROJECT_ID="${GCP_PROJECT_ID:-sisrua-producao}"
LOCATION="${CLOUD_TASKS_LOCATION:-southamerica-east1}"
QUEUE_NAME="${CLOUD_TASKS_QUEUE:-sisrua-queue}"

echo -e "${YELLOW}======================================${NC}"
echo -e "${YELLOW}Cloud Tasks Queue Setup${NC}"
echo -e "${YELLOW}======================================${NC}"
echo ""
echo -e "Project ID: ${GREEN}${PROJECT_ID}${NC}"
echo -e "Location:   ${GREEN}${LOCATION}${NC}"
echo -e "Queue Name: ${GREEN}${QUEUE_NAME}${NC}"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}ERROR: gcloud CLI is not installed${NC}"
    echo "Please install gcloud from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if user is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
    echo -e "${RED}ERROR: Not authenticated with gcloud${NC}"
    echo "Please run: gcloud auth login"
    exit 1
fi

# Check if queue already exists
echo "Checking if queue '${QUEUE_NAME}' exists..."
if gcloud tasks queues describe "${QUEUE_NAME}" \
    --location="${LOCATION}" \
    --project="${PROJECT_ID}" &> /dev/null; then
    echo -e "${GREEN}✓ Queue '${QUEUE_NAME}' already exists${NC}"
    echo ""
    echo "Queue details:"
    gcloud tasks queues describe "${QUEUE_NAME}" \
        --location="${LOCATION}" \
        --project="${PROJECT_ID}"
    exit 0
fi

# Create the queue
echo -e "${YELLOW}Creating queue '${QUEUE_NAME}'...${NC}"
gcloud tasks queues create "${QUEUE_NAME}" \
    --location="${LOCATION}" \
    --project="${PROJECT_ID}" \
    --max-dispatches-per-second=10 \
    --max-concurrent-dispatches=10

echo ""
echo -e "${GREEN}✓ Queue '${QUEUE_NAME}' created successfully!${NC}"
echo ""
echo "Queue details:"
gcloud tasks queues describe "${QUEUE_NAME}" \
    --location="${LOCATION}" \
    --project="${PROJECT_ID}"

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo "The Cloud Tasks queue is now ready for use."
echo ""
echo "Next steps:"
echo "1. Ensure your Cloud Run service has the 'Cloud Tasks Enqueuer' role"
echo "2. Deploy your application with the following environment variables:"
echo "   - GCP_PROJECT=${PROJECT_ID}"
echo "   - CLOUD_TASKS_LOCATION=${LOCATION}"
echo "   - CLOUD_TASKS_QUEUE=${QUEUE_NAME}"
