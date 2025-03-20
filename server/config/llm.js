const path = require("path");

/**
 * Common LLM configuration settings used across the application
 */
const LLMConfig = {
  // Ollama service configuration
  baseUrl: process.env.OLLAMA_URL || "http://192.168.4.106:11434",
  model: process.env.OLLAMA_MODEL || "gemma3:12b",
};

/**
 * Milvus vector database configuration
 */
const MilvusConfig = {
  address: process.env.MILVUS_ADDRESS || "localhost:19530",
  collection: process.env.MILVUS_COLLECTION || "multimodal_collection_pwllm",
};

/**
 * Storage configuration for images and other files
 */
const StorageConfig = {
  baseImagePath:
    process.env.IMAGE_STORAGE_PATH || path.join(process.cwd(), "uploads"),
  maxImageSize: parseInt(process.env.MAX_IMAGE_SIZE, 10) || 5 * 1024 * 1024, // 5MB
  allowedFormats: ["jpg", "jpeg", "png"],
};

/**
 * Combined configuration object for MultimodalProcessor
 */
const MultimodalConfig = {
  llm: LLMConfig,
  milvus: MilvusConfig,
  storage: StorageConfig,
};

module.exports = {
  LLMConfig,
  MilvusConfig,
  StorageConfig,
  MultimodalConfig,
};