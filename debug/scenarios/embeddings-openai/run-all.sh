#!/bin/bash
# Run all strategies for the OpenAI embeddings scenario

echo "Running OpenAI Embeddings Scenario - All Strategies"
echo "=================================================="

if [ -z "$OPENAI_API_KEY" ]; then
    echo "Error: OPENAI_API_KEY environment variable is not set"
    echo "Please run: export OPENAI_API_KEY=your-api-key"
    exit 1
fi

echo ""
echo "1. Running Bruteforce Strategy..."
echo "---------------------------------"
bun run --env-file=.env debug/scenarios/embeddings-openai/index.tsx runBruteforce

echo ""
echo "2. Running HNSW Strategy..."
echo "---------------------------"
bun run --env-file=.env debug/scenarios/embeddings-openai/index.tsx runHNSW

echo ""
echo "3. Running IVF Strategy..."
echo "--------------------------"
bun run --env-file=.env debug/scenarios/embeddings-openai/index.tsx runIVF

echo ""
echo "All strategies completed!"