#!/bin/bash

# Setup IAM Permissions for Cloud Run and Cloud Tasks
# This script grants the necessary IAM permissions for the sisrua-producao project

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="${1:-sisrua-producao}"
REGION="${2:-southamerica-east1}"
SERVICE_NAME="${3:-sisrua-app}"
QUEUE_NAME="${4:-sisrua-queue}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Cloud Run IAM Setup Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}Project ID:${NC} $PROJECT_ID"
echo -e "${YELLOW}Region:${NC} $REGION"
echo -e "${YELLOW}Service:${NC} $SERVICE_NAME"
echo -e "${YELLOW}Queue:${NC} $QUEUE_NAME"
echo ""

# Step 1: Get project number
echo -e "${BLUE}Step 1: Getting project number...${NC}"
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)" 2>/dev/null)
if [ -z "$PROJECT_NUMBER" ]; then
    echo -e "${RED}✗ Failed to get project number. Make sure you have access to project $PROJECT_ID${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Project number: $PROJECT_NUMBER${NC}"
echo ""

# Step 2: Construct service account emails
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
APPENGINE_SA="${PROJECT_ID}@appspot.gserviceaccount.com"

echo -e "${BLUE}Step 2: Service accounts identified${NC}"
echo -e "${YELLOW}  Compute SA:${NC} $COMPUTE_SA"
echo -e "${YELLOW}  App Engine SA:${NC} $APPENGINE_SA"
echo ""

# Step 3: Verify service accounts exist
echo -e "${BLUE}Step 3: Verifying service accounts exist...${NC}"

if gcloud iam service-accounts describe "$COMPUTE_SA" --project="$PROJECT_ID" >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Compute service account exists${NC}"
else
    echo -e "${RED}✗ Compute service account not found${NC}"
    exit 1
fi

if gcloud iam service-accounts describe "$APPENGINE_SA" --project="$PROJECT_ID" >/dev/null 2>&1; then
    echo -e "${GREEN}✓ App Engine service account exists${NC}"
    APPENGINE_EXISTS=true
else
    echo -e "${YELLOW}⚠ App Engine service account not found (this is OK if not using App Engine)${NC}"
    APPENGINE_EXISTS=false
fi
echo ""

# Step 4: Grant Cloud Tasks Enqueuer role
echo -e "${BLUE}Step 4: Granting Cloud Tasks Enqueuer role...${NC}"

# Grant to Compute service account
echo -e "  Granting to ${COMPUTE_SA}..."
if gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$COMPUTE_SA" \
    --role="roles/cloudtasks.enqueuer" \
    --condition=None \
    --quiet >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Granted roles/cloudtasks.enqueuer to Compute SA${NC}"
else
    echo -e "${YELLOW}⚠ May already have permission (or error occurred)${NC}"
fi

# Grant to App Engine service account if it exists
if [ "$APPENGINE_EXISTS" = true ]; then
    echo -e "  Granting to ${APPENGINE_SA}..."
    if gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:$APPENGINE_SA" \
        --role="roles/cloudtasks.enqueuer" \
        --condition=None \
        --quiet >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Granted roles/cloudtasks.enqueuer to App Engine SA${NC}"
    else
        echo -e "${YELLOW}⚠ May already have permission (or error occurred)${NC}"
    fi
fi
echo ""

# Step 5: Check if Cloud Run service exists
echo -e "${BLUE}Step 5: Checking if Cloud Run service exists...${NC}"
if gcloud run services describe "$SERVICE_NAME" \
    --region="$REGION" \
    --project="$PROJECT_ID" >/dev/null 2>&1; then
    SERVICE_EXISTS=true
    echo -e "${GREEN}✓ Service $SERVICE_NAME exists${NC}"
else
    SERVICE_EXISTS=false
    echo -e "${YELLOW}⚠ Service $SERVICE_NAME does not exist yet${NC}"
    echo -e "${YELLOW}  You'll need to deploy the service first, then run this script again${NC}"
fi
echo ""

# Step 6: Grant Cloud Run Invoker role (only if service exists)
if [ "$SERVICE_EXISTS" = true ]; then
    echo -e "${BLUE}Step 6: Granting Cloud Run Invoker role...${NC}"
    
    # Grant to Compute service account
    echo -e "  Granting to ${COMPUTE_SA}..."
    if gcloud run services add-iam-policy-binding "$SERVICE_NAME" \
        --region="$REGION" \
        --member="serviceAccount:$COMPUTE_SA" \
        --role="roles/run.invoker" \
        --project="$PROJECT_ID" \
        --quiet >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Granted roles/run.invoker to Compute SA${NC}"
    else
        echo -e "${YELLOW}⚠ May already have permission (or error occurred)${NC}"
    fi
    
    # Grant to App Engine service account if it exists
    if [ "$APPENGINE_EXISTS" = true ]; then
        echo -e "  Granting to ${APPENGINE_SA}..."
        if gcloud run services add-iam-policy-binding "$SERVICE_NAME" \
            --region="$REGION" \
            --member="serviceAccount:$APPENGINE_SA" \
            --role="roles/run.invoker" \
            --project="$PROJECT_ID" \
            --quiet >/dev/null 2>&1; then
            echo -e "${GREEN}✓ Granted roles/run.invoker to App Engine SA${NC}"
        else
            echo -e "${YELLOW}⚠ May already have permission (or error occurred)${NC}"
        fi
    fi
else
    echo -e "${BLUE}Step 6: Skipping Cloud Run Invoker role (service doesn't exist)${NC}"
    echo -e "${YELLOW}  Deploy the service first, then run: $0 $PROJECT_ID $REGION $SERVICE_NAME${NC}"
fi
echo ""

# Step 7: Verify permissions
echo -e "${BLUE}Step 7: Verifying permissions...${NC}"

echo -e "${YELLOW}Cloud Tasks Enqueuer permissions:${NC}"
gcloud projects get-iam-policy "$PROJECT_ID" \
    --flatten="bindings[].members" \
    --filter='bindings.role=roles/cloudtasks.enqueuer' \
    --format="table(bindings.members)" 2>/dev/null | grep -E "(compute|appspot)" || echo "  (none found)"

if [ "$SERVICE_EXISTS" = true ]; then
    echo ""
    echo -e "${YELLOW}Cloud Run Invoker permissions:${NC}"
    gcloud run services get-iam-policy "$SERVICE_NAME" \
        --region="$REGION" \
        --project="$PROJECT_ID" \
        --flatten="bindings[].members" \
        --filter='bindings.role=roles/run.invoker' \
        --format="table(bindings.members)" 2>/dev/null | head -10
fi
echo ""

# Step 8: Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ Cloud Tasks Enqueuer role granted${NC}"
if [ "$SERVICE_EXISTS" = true ]; then
    echo -e "${GREEN}✓ Cloud Run Invoker role granted${NC}"
    echo -e "${GREEN}✓ Setup complete!${NC}"
else
    echo -e "${YELLOW}⚠ Cloud Run Invoker role NOT granted (service doesn't exist)${NC}"
    echo -e "${YELLOW}  Next steps:${NC}"
    echo -e "${YELLOW}    1. Deploy the Cloud Run service${NC}"
    echo -e "${YELLOW}    2. Run this script again to grant invoker permissions${NC}"
fi
echo ""

echo -e "${BLUE}Next Steps:${NC}"
if [ "$SERVICE_EXISTS" = false ]; then
    echo -e "  1. Deploy the service:"
    echo -e "     ${YELLOW}cd sisrua_unified && gcloud run deploy $SERVICE_NAME --source=. --region=$REGION --project=$PROJECT_ID${NC}"
    echo -e "  2. Run this script again:"
    echo -e "     ${YELLOW}./scripts/setup-iam-permissions.sh $PROJECT_ID $REGION $SERVICE_NAME${NC}"
else
    echo -e "  1. Test the deployment:"
    echo -e "     ${YELLOW}curl \$(gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(status.url)' --project=$PROJECT_ID)/health${NC}"
    echo -e "  2. Test DXF generation through the application"
fi
echo ""

exit 0
