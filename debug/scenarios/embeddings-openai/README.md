# OpenAI Embeddings Scenario

This scenario demonstrates using OpenAI embeddings with VectorDB for semantic search.

## File Structure

The code has been organized into modular files:

- `types.ts` - Type definitions
- `components.tsx` - UI components (Section, Row)
- `openai-service.ts` - OpenAI embedding API integration
- `search-utils.ts` - Search and evaluation utilities
- `config.ts` - Environment variable configuration
- `queries.ts` - Query definitions
- `common.tsx` - Main App component
- `index.tsx` - Entry point exports
- `run-bruteforce.tsx` - Script to run bruteforce strategy
- `run-hnsw.tsx` - Script to run HNSW strategy

## Running the Scenarios

### Prerequisites

Set your OpenAI API key:

```bash
export OPENAI_API_KEY="your-api-key"
```

### Run Bruteforce Strategy

```bash
bun run --env-file=.env debug/scenarios/embeddings-openai/run-bruteforce.tsx
```

### Run HNSW Strategy

```bash
bun run --env-file=.env debug/scenarios/embeddings-openai/run-hnsw.tsx
```

## Configuration Options

You can configure the behavior using environment variables:

- `OPENAI_API_KEY` or `OPENAI_API_KEY_FOR_EMBEDDING` - API key for OpenAI
- `VECTORLITE_METRIC` - Distance metric (cosine, l2, dot)
- `VECTORLITE_ATTR_INDEX` - Attribute index strategy (basic, bitmap)
- `VECTORLITE_HNSW_EF_SEARCH` - HNSW search parameter
- `VECTORLITE_HNSW_M` - HNSW graph connectivity
- `VECTORLITE_IVF_NLIST` - IVF number of clusters
- `VECTORLITE_IVF_NPROBE` - IVF number of probes
- `VECTORLITE_HNSW_FILTER_MODE` - Filter mode (soft, hard)
- `VECTORLITE_HNSW_SEEDS` - Number of seeds or "auto"
- `VECTORLITE_HNSW_BRIDGE` - Bridge budget for filtered search

## Features

- Embeds documents using OpenAI's text-embedding-3-small model
- Indexes documents with metadata (title, category, tags, author, year)
- Performs vector search with optional attribute filtering
- Evaluates recall comparing bruteforce, HNSW, and IVF strategies
- Persists and reloads the index using local crush storage
- Provides recommendations based on performance metrics
