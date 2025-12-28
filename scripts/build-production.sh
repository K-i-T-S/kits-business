#!/bin/bash
set -e
echo "Building for production..."
npm ci --production=false
npm run build
echo "Build completed!"
