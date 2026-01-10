#!/bin/bash
# ============================================
# Quick Deploy Script for Hermes Assessment
# ============================================
# This script helps you push the Docker image to GitHub Container Registry

set -e

echo "🚀 Hermes Assessment - Quick Deploy"
echo "===================================="
echo ""

# Check if logged into GitHub Container Registry
if ! docker info 2>/dev/null | grep -q "ghcr.io"; then
    echo "📝 Please login to GitHub Container Registry first:"
    echo ""
    echo "   export GITHUB_TOKEN=<your-github-token>"
    echo "   echo \$GITHUB_TOKEN | docker login ghcr.io -u <username> --password-stdin"
    echo ""
    read -p "Press Enter after logging in..."
fi

# Get version
echo "📦 What version are you deploying?"
echo "   Examples: v1.0.0, v1.0.1, latest"
read -p "Version: " VERSION

if [ -z "$VERSION" ]; then
    VERSION="latest"
fi

# Confirm
echo ""
echo "Deploying:"
echo "  Image: hermes-assessment:latest"
echo "  Registry: ghcr.io/hermes-startup/hermes-assessment"
echo "  Tag: $VERSION"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 1
fi

# Tag the image
echo "🏷️  Tagging image..."
docker tag hermes-assessment:latest ghcr.io/hermes-startup/hermes-assessment:$VERSION
docker tag hermes-assessment:latest ghcr.io/hermes-startup/hermes-assessment:latest

# Push to registry
echo "📤 Pushing to GitHub Container Registry..."
docker push ghcr.io/hermes-startup/hermes-assessment:$VERSION
docker push ghcr.io/hermes-startup/hermes-assessment:latest

echo ""
echo "✅ Successfully deployed!"
echo ""
echo "Image URLs:"
echo "  ghcr.io/hermes-startup/hermes-assessment:$VERSION"
echo "  ghcr.io/hermes-startup/hermes-assessment:latest"
echo ""
echo "Next steps:"
echo "  1. Make the package public in GitHub repo settings"
echo "  2. Update your container orchestration to use this image"
echo "  3. Test deployment with: docker pull ghcr.io/hermes-startup/hermes-assessment:$VERSION"
