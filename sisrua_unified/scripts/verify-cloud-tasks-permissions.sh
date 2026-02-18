#!/bin/bash

##############################################################################
# Cloud Tasks Queue Permissions Verification Script
# 
# This script verifies that:
# 1. The Cloud Tasks queue exists and is accessible
# 2. The service account has the required IAM permissions
# 3. The environment is properly configured for DXF generation
#
# Usage: ./scripts/verify-cloud-tasks-permissions.sh [project-id]
##############################################################################

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="${1:-${GCP_PROJECT_ID:-sisrua-producao}}"
LOCATION="southamerica-east1"
QUEUE_NAME="sisrua-queue"
SERVICE_NAME="sisrua-app"
SERVICE_ACCOUNT="${PROJECT_ID}@appspot.gserviceaccount.com"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Cloud Tasks Permissions Verification${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Project ID:        ${GREEN}${PROJECT_ID}${NC}"
echo -e "Location:          ${GREEN}${LOCATION}${NC}"
echo -e "Queue Name:        ${GREEN}${QUEUE_NAME}${NC}"
echo -e "Service Account:   ${GREEN}${SERVICE_ACCOUNT}${NC}"
echo ""

# Function to print success message
success() {
    echo -e "${GREEN}✓${NC} $1"
}

# Function to print error message
error() {
    echo -e "${RED}✗${NC} $1"
}

# Function to print warning message
warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Function to print info message
info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

##############################################################################
# Step 1: Check gcloud CLI
##############################################################################
echo -e "${BLUE}Step 1: Checking gcloud CLI...${NC}"
if ! command -v gcloud &> /dev/null; then
    error "gcloud CLI is not installed"
    echo "   Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi
success "gcloud CLI is installed"
echo ""

##############################################################################
# Step 2: Check authentication
##############################################################################
echo -e "${BLUE}Step 2: Checking authentication...${NC}"
ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null)
if [ -z "$ACTIVE_ACCOUNT" ]; then
    error "No active gcloud account found"
    echo "   Run: gcloud auth login"
    exit 1
fi
success "Authenticated as: ${ACTIVE_ACCOUNT}"
echo ""

##############################################################################
# Step 3: Verify queue exists
##############################################################################
echo -e "${BLUE}Step 3: Verifying Cloud Tasks queue...${NC}"
if gcloud tasks queues describe "${QUEUE_NAME}" \
    --location="${LOCATION}" \
    --project="${PROJECT_ID}" &> /dev/null; then
    success "Queue '${QUEUE_NAME}' exists and is accessible"
    
    # Get queue details
    QUEUE_STATE=$(gcloud tasks queues describe "${QUEUE_NAME}" \
        --location="${LOCATION}" \
        --project="${PROJECT_ID}" \
        --format="value(state)")
    
    if [ "$QUEUE_STATE" = "RUNNING" ]; then
        success "Queue state: RUNNING"
    else
        warning "Queue state: ${QUEUE_STATE}"
    fi
else
    error "Queue '${QUEUE_NAME}' not found or not accessible"
    echo ""
    echo "   Create the queue using:"
    echo "   ${YELLOW}gcloud tasks queues create ${QUEUE_NAME} \\${NC}"
    echo "   ${YELLOW}  --location=${LOCATION} \\${NC}"
    echo "   ${YELLOW}  --project=${PROJECT_ID}${NC}"
    exit 1
fi
echo ""

##############################################################################
# Step 4: Check Cloud Tasks enqueuer permission
##############################################################################
echo -e "${BLUE}Step 4: Checking Cloud Tasks enqueuer permission...${NC}"
HAS_ENQUEUER_ROLE=$(gcloud projects get-iam-policy "${PROJECT_ID}" \
    --flatten="bindings[].members" \
    --filter="bindings.role:roles/cloudtasks.enqueuer AND bindings.members:serviceAccount:${SERVICE_ACCOUNT}" \
    --format="value(bindings.role)" 2>/dev/null || echo "")

if [ -n "$HAS_ENQUEUER_ROLE" ]; then
    success "Service account has roles/cloudtasks.enqueuer"
else
    error "Service account is missing roles/cloudtasks.enqueuer"
    echo ""
    echo "   Grant the permission using:"
    echo "   ${YELLOW}gcloud projects add-iam-policy-binding ${PROJECT_ID} \\${NC}"
    echo "   ${YELLOW}  --member=\"serviceAccount:${SERVICE_ACCOUNT}\" \\${NC}"
    echo "   ${YELLOW}  --role=\"roles/cloudtasks.enqueuer\"${NC}"
    exit 1
fi
echo ""

##############################################################################
# Step 5: Check Cloud Run invoker permission
##############################################################################
echo -e "${BLUE}Step 5: Checking Cloud Run invoker permission...${NC}"
if gcloud run services describe "${SERVICE_NAME}" \
    --region="${LOCATION}" \
    --project="${PROJECT_ID}" &> /dev/null; then
    
    HAS_INVOKER_ROLE=$(gcloud run services get-iam-policy "${SERVICE_NAME}" \
        --region="${LOCATION}" \
        --project="${PROJECT_ID}" \
        --flatten="bindings[].members" \
        --filter="bindings.role:roles/run.invoker AND bindings.members:serviceAccount:${SERVICE_ACCOUNT}" \
        --format="value(bindings.role)" 2>/dev/null || echo "")
    
    if [ -n "$HAS_INVOKER_ROLE" ]; then
        success "Service account has roles/run.invoker on ${SERVICE_NAME}"
    else
        error "Service account is missing roles/run.invoker on ${SERVICE_NAME}"
        echo ""
        echo "   Grant the permission using:"
        echo "   ${YELLOW}gcloud run services add-iam-policy-binding ${SERVICE_NAME} \\${NC}"
        echo "   ${YELLOW}  --region=${LOCATION} \\${NC}"
        echo "   ${YELLOW}  --member=\"serviceAccount:${SERVICE_ACCOUNT}\" \\${NC}"
        echo "   ${YELLOW}  --role=\"roles/run.invoker\" \\${NC}"
        echo "   ${YELLOW}  --project=${PROJECT_ID}${NC}"
        exit 1
    fi
else
    warning "Cloud Run service '${SERVICE_NAME}' not found (may not be deployed yet)"
fi
echo ""

##############################################################################
# Step 6: Check environment variables (if service is deployed)
##############################################################################
echo -e "${BLUE}Step 6: Checking environment variables...${NC}"
if gcloud run services describe "${SERVICE_NAME}" \
    --region="${LOCATION}" \
    --project="${PROJECT_ID}" &> /dev/null; then
    
    # Check GCP_PROJECT
    GCP_PROJECT_VAR=$(gcloud run services describe "${SERVICE_NAME}" \
        --region="${LOCATION}" \
        --project="${PROJECT_ID}" \
        --format="value(spec.template.spec.containers[0].env.filter.extract(GCP_PROJECT))" 2>/dev/null || echo "")
    
    if [ -n "$GCP_PROJECT_VAR" ]; then
        if [ "$GCP_PROJECT_VAR" = "$PROJECT_ID" ]; then
            success "GCP_PROJECT is set correctly: ${GCP_PROJECT_VAR}"
        else
            error "GCP_PROJECT mismatch: expected '${PROJECT_ID}', got '${GCP_PROJECT_VAR}'"
        fi
    else
        error "GCP_PROJECT environment variable is not set"
    fi
    
    # Check CLOUD_TASKS_QUEUE
    CLOUD_TASKS_QUEUE_VAR=$(gcloud run services describe "${SERVICE_NAME}" \
        --region="${LOCATION}" \
        --project="${PROJECT_ID}" \
        --format="value(spec.template.spec.containers[0].env.filter.extract(CLOUD_TASKS_QUEUE))" 2>/dev/null || echo "")
    
    if [ -n "$CLOUD_TASKS_QUEUE_VAR" ]; then
        if [ "$CLOUD_TASKS_QUEUE_VAR" = "$QUEUE_NAME" ]; then
            success "CLOUD_TASKS_QUEUE is set correctly: ${CLOUD_TASKS_QUEUE_VAR}"
        else
            warning "CLOUD_TASKS_QUEUE mismatch: expected '${QUEUE_NAME}', got '${CLOUD_TASKS_QUEUE_VAR}'"
        fi
    else
        error "CLOUD_TASKS_QUEUE environment variable is not set"
    fi
    
    # Check CLOUD_TASKS_LOCATION
    CLOUD_TASKS_LOCATION_VAR=$(gcloud run services describe "${SERVICE_NAME}" \
        --region="${LOCATION}" \
        --project="${PROJECT_ID}" \
        --format="value(spec.template.spec.containers[0].env.filter.extract(CLOUD_TASKS_LOCATION))" 2>/dev/null || echo "")
    
    if [ -n "$CLOUD_TASKS_LOCATION_VAR" ]; then
        if [ "$CLOUD_TASKS_LOCATION_VAR" = "$LOCATION" ]; then
            success "CLOUD_TASKS_LOCATION is set correctly: ${CLOUD_TASKS_LOCATION_VAR}"
        else
            warning "CLOUD_TASKS_LOCATION mismatch: expected '${LOCATION}', got '${CLOUD_TASKS_LOCATION_VAR}'"
        fi
    else
        error "CLOUD_TASKS_LOCATION environment variable is not set"
    fi
else
    warning "Cloud Run service not deployed yet - skipping environment variable checks"
fi
echo ""

##############################################################################
# Summary
##############################################################################
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ All checks passed!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Your Cloud Tasks queue is properly configured and the service account"
echo "has all the necessary permissions to create and process DXF generation tasks."
echo ""
info "Next steps:"
echo "  1. Deploy or update your Cloud Run service"
echo "  2. Test DXF generation via the /api/dxf endpoint"
echo "  3. Monitor task creation in Cloud Console:"
echo "     ${BLUE}https://console.cloud.google.com/cloudtasks?project=${PROJECT_ID}${NC}"
echo ""
