# Multimodal E-Commerce Store API

This Express.js application provides a backend API for an e-commerce store with advanced search capabilities, including text-based semantic search and image-based visual search powered by vector embeddings.

## Features

- **Product Management**: CRUD operations for product catalog
- **Text Search**: Semantic search with vector embeddings
- **Image Search**: Visual similarity search using image embeddings
- **Multimodal Processing**: Image captioning and embedding generation
- **Vector Database**: Storage and retrieval of high-dimensional vectors

## Tech Stack

- **Server**: Express.js
- **Database**: MongoDB (product data)
- **Vector Database**: Milvus (embeddings for semantic search)
- **AI Processing**: Ollama (for image captioning and text embedding)
- **Image Processing**: Sharp (for image optimization)

## Prerequisites

Before you begin, ensure you have the following installed:

- Node.js (v14.x or later)
- MongoDB (v4.x or later)
- Docker and Docker Compose (for running Milvus)
- Ollama server (for LLM services)

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd <project-folder>/server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Configuration

### Environment Variables

Create a `.env` file in the server directory with the following variables:

```
# MongoDB connection string
MONGODB_URI=mongodb://localhost:27017/store

# Ollama configuration
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=gemma3:12b

# Milvus configuration
MILVUS_ADDRESS=localhost:19530
MILVUS_COLLECTION=multimodal_collection_pwllm

# Optional configurations
IMAGE_STORAGE_PATH=./uploads
MAX_IMAGE_SIZE=5242880
PORT=4001

# Data processing configuration (optional)
BATCH_START=0
BATCH_SIZE=1000
PROCESSING_DELAY_MS=1000
PROCESSING_CONCURRENCY=3
```

## Starting the Infrastructure

### MongoDB

Ensure MongoDB is running:

```bash
# Check if MongoDB is running
mongosh
```

### Milvus Vector Database

Start Milvus using the provided Docker Compose file:

```bash
cd server/docker
docker-compose -f docker-compose-milvus.yml up -d
```

This will start the Milvus server and all its required components (etcd, MinIO, etc.).

### Ollama

Ensure Ollama is running and the required models are available:

```bash
# Check Ollama status
curl http://localhost:11434/api/tags

# Pull the required model if not available
ollama pull gemma3:12b
```

## Data Population

The project includes scripts to populate the database with product data:

1. Reset and populate the database:

```bash
node scripts/data-generators/products/reset-and-migrate.js
```

This script will:
1. Clean up any existing product data in MongoDB
2. Delete the vector collection in Milvus
3. Import product data from the CSV file
4. Generate and store embeddings for each product

## Starting the Server

Once all infrastructure is running and data is populated, start the server:

```bash
npm start
```

The server will start on port 4001 (or the port specified in your `.env` file).

## API Endpoints

### Products

- `GET /api/products` - Get all products (limited to 20)
- `GET /api/products/search?keyword=query` - Search products by keyword
- `POST /api/products/image-search` - Search products by image
  - Request body: `{ "image": "base64-encoded-image" }`
- `GET /api/products/:id` - Get product by ID
- `GET /api/products/category/:category` - Get products by category

### Health Check

- `GET /health` - Check server health

## Development

For development purposes, you can run the server in watch mode:

```bash
npm run dev
```

## Troubleshooting

### MongoDB Connection Issues

If you encounter MongoDB connection issues:
- Verify that MongoDB is running
- Check that your MONGODB_URI is correct in the .env file

### Milvus Connection Issues

If vector search is not working:
- Ensure the Milvus containers are running: `docker ps`
- Check the logs: `docker logs milvus-standalone`
- Verify your MILVUS_ADDRESS in the .env file

### Ollama Connection Issues

If image captioning or text expansion is not working:
- Verify Ollama is running: `curl http://localhost:11434/api/tags`
- Ensure the specified model (e.g., gemma3:12b) is available
- Check your OLLAMA_URL in the .env file

### Data Population Issues

If the data migration script fails:
- Check that both MongoDB and Milvus are running
- Examine the error output for specific issues
- Try running the reset script first: `node scripts/data-generators/products/reset.js`
- Then run the migration script: `node scripts/data-generators/products/migrate.js`

### Image Processing Issues

If image processing fails:
- Ensure the uploads directory exists and has write permissions
- Check if Sharp is properly installed

## License

[MIT License](LICENSE)