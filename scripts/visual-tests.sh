#!/bin/bash

echo "Running visual regression tests..."

# Build Storybook
echo "Building Storybook..."
npm run build-storybook

# Run Storybook tests
echo "Running Storybook visual tests..."
npm run test-storybook

# Run Playwright visual tests
echo "Running Playwright visual tests..."
npx playwright test --config=playwright.visual.config.ts

echo "Visual regression tests complete!"
