#!/bin/bash

echo "Starting Hello World Demo"
echo ""

echo "  Step 1: Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo "Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi
echo "Docker is running"
echo ""

echo "  Step 2: Starting MongoDB..."
docker-compose up -d
if [ $? -ne 0 ]; then
    echo "Failed to start MongoDB"
    exit 1
fi
echo "MongoDB container started"
echo ""

echo "  Step 3: Waiting for MongoDB to be ready..."
sleep 5
echo "MongoDB should be ready"
echo ""

echo "  Step 4: Installing dependencies (if needed)..."
if [ ! -d "node_modules" ]; then
    npm install
fi
echo "Dependencies ready"
echo ""

echo "  Step 5: Running TypeScript + MongoDB demo..."
echo ""
npm run dev
