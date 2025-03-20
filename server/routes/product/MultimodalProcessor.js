const { MilvusClient } = require("@zilliz/milvus2-sdk-node");
const sharp = require("sharp");
const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");

// Error handling
class AppError extends Error {
  constructor(message, details) {
    super(message);
    this.name = "AppError";
    this.details = details;
  }
}

// Logger
const logger = {
  info: (message, data = {}) => {
    console.log(`[INFO] ${message}`, data);
  },
  error: (message, error) => {
    console.error(`[ERROR] ${message}`, error);
  },
  success: (message, data = {}) => {
    console.log(`[SUCCESS] ${message}`, data);
  },
  debug: (message, data = {}) => {
    // Always log debug messages during troubleshooting
    console.log(`[DEBUG] ${message}`, data);
  },
};

// Default configuration object for LLM services
const DEFAULT_CONFIG = {
  llm: {
    // Ollama service configuration
    ollama: {
      baseUrl: "http://192.168.4.106:11434",
      models: {
        multimodal: "gemma3:12b", // For image+text tasks
        text: "gemma3:12b", // For text-only tasks
        coder: "gemma3:12b", // For code-related tasks
      },
    },
    // Which service to use by default
    defaultProvider: "ollama",
  },
  milvus: {
    address: "localhost:19530",
    collection: "multimodal_collection_pwllm",
  },
  storage: {
    baseImagePath:
      process.env.IMAGE_STORAGE_PATH || path.join(process.cwd(), "uploads"),
    maxImageSize: 5 * 1024 * 1024, // 5MB
    allowedFormats: ["jpg", "jpeg", "png"],
  },
};

class MultimodalProcessor {
  constructor(config = {}) {
    // Merge provided config with defaults
    this.config = {
      llm: { ...DEFAULT_CONFIG.llm, ...(config.llm || {}) },
      milvus: { ...DEFAULT_CONFIG.milvus, ...(config.milvus || {}) },
      storage: { ...DEFAULT_CONFIG.storage, ...(config.storage || {}) },
    };

    // Initialize Milvus client
    this.milvusClient = new MilvusClient({
      address: this.config.milvus.address,
    });
    this.collectionName = this.config.milvus.collection;
    this.storageConfig = this.config.storage;

    this.clipModel = null;
    this.pipeline = null;
    this.embeddingModel = null;

    // Log initialization
    console.log("MultimodalProcessor initialized with config:", {
      llmProvider: this.config.llm.defaultProvider,
      milvusAddress: this.config.milvus.address,
      collectionName: this.collectionName,
    });
  }

  // Get the appropriate LLM service URL based on the current configuration
  getLLMServiceUrl(endpoint = "chat/completions") {
    const provider = this.config.llm.defaultProvider;
    const baseUrl = this.config.llm[provider].baseUrl;

    // Different endpoints for different providers
    if (provider === "ollama") {
      return `${baseUrl}/api/chat`;
    }

    return `${baseUrl}/v1/${endpoint}`;
  }

  // Get the appropriate model name for the task
  getModelName(task = "text") {
    const provider = this.config.llm.defaultProvider;
    return (
      this.config.llm[provider].models[task] ||
      this.config.llm[provider].models.text
    );
  }

  async init() {
    try {
      // Dynamically import transformers
      const { pipeline } = await import("@xenova/transformers");
      this.pipeline = pipeline;

      // Initialize models with smaller, public versions
      this.clipModel = await this.pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2"
      );
      // Initialize the embedding model
      this.embeddingModel = await this.pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2"
      );

      console.log("Models initialized successfully");

      // Verify LLM service connection
      await this.testLLMConnection();
    } catch (error) {
      console.error("Error initializing models:", error);
      throw error;
    }
  }

  // Test connection to LLM provider
  async testLLMConnection() {
    const provider = this.config.llm.defaultProvider;
    try {
      if (provider === "ollama") {
        const response = await axios.get(
          `${this.config.llm.ollama.baseUrl}/api/tags`
        );
        console.log(
          `Connected to Ollama, available models: ${response.data.models.length}`
        );
      } else {
        // Test alternative provider
        const response = await axios.get(
          `${this.config.llm.alternative.baseUrl}/v1/models`
        );
        console.log(
          `Connected to alternative LLM provider, available models: ${response.data.data.length}`
        );
      }
      return true;
    } catch (error) {
      console.error(
        `Failed to connect to LLM provider (${provider}):`,
        error.message
      );
      console.log("Attempting to switch to fallback provider...");
      // Attempt to switch to fallback provider
      this.config.llm.defaultProvider =
        provider === "ollama" ? "alternative" : "ollama";
      return false;
    }
  }

  /**
   * Get image buffer from various input types (file path, URL, buffer)
   * @param {String|Buffer} imageInput - Image input (path, URL, or buffer)
   * @returns {Promise<Buffer>} Image buffer
   */
  async getImageBuffer(imageInput) {
    try {
      // If input is already a buffer, return it
      if (Buffer.isBuffer(imageInput)) {
        return imageInput;
      }

      // If input is a URL, download it first
      if (typeof imageInput === "string") {
        if (
          imageInput.startsWith("http://") ||
          imageInput.startsWith("https://")
        ) {
          const response = await axios.get(imageInput, {
            responseType: "arraybuffer",
          });
          return Buffer.from(response.data, "binary");
        } else {
          // Assume it's a file path
          return await fs.readFile(imageInput);
        }
      }

      throw new Error("Unsupported image input type");
    } catch (error) {
      console.error("Error getting image buffer:", error);
      throw error;
    }
  }

  async storeImage(imageInput, filename) {
    try {
      const imageId =
        new Date().getTime() + "_" + Math.random().toString(36).substring(7);
      const storagePath = path.join(this.storageConfig.baseImagePath, imageId);

      // Ensure directory exists
      await fs.mkdir(this.storageConfig.baseImagePath, { recursive: true });

      // Process and optimize image
      const imageBuffer = await this.getImageBuffer(imageInput);
      await sharp(imageBuffer)
        .resize(800, 800, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(storagePath + ".webp");

      // Also save thumbnail for quick preview
      await sharp(imageBuffer)
        .resize(200, 200, { fit: "cover" })
        .webp({ quality: 60 })
        .toFile(storagePath + "_thumb.webp");

      return {
        imageId,
        originalName: filename,
        mainPath: `${imageId}.webp`,
        thumbnailPath: `${imageId}_thumb.webp`,
      };
    } catch (error) {
      console.error("Error storing image:", error);
      throw error;
    }
  }

  async convertImageToBase64(imagePath) {
    try {
      console.log("convertImageToBase64(): imagePath:", imagePath);
      const imageBuffer = await sharp(imagePath)
        .resize(384, 384, {
          fit: "contain",
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .toFormat("jpg")
        .toBuffer();
      // convert to base64
      const base64Data = imageBuffer.toString("base64");
      return base64Data;
    } catch (error) {
      console.error("Error preprocessing image:", error);
      throw error;
    }
  }

  async downloadImage(id, imageUrl) {
    console.log("downloadImage(): imageUrl:", imageUrl);

    await fs.mkdir(this.storageConfig.baseImagePath, { recursive: true });

    const localImagePath = path.join(
      this.storageConfig.baseImagePath,
      `${id}.jpg`
    );

    try {
      await fs.access(localImagePath);
      console.log("downloadImage(): image already exists:", localImagePath);
      return localImagePath;
    } catch {
      const response = await axios.get(imageUrl, {
        responseType: "arraybuffer",
      });
      const imageBuffer = Buffer.from(response.data, "binary");
      await fs.writeFile(localImagePath, imageBuffer);
      return localImagePath;
    }
  }

  async generateCompletionSync(prompts) {
    console.log("generateCompletionSync(): prompts:", prompts);

    const provider = this.config.llm.defaultProvider;
    let response;

    try {
      if (provider === "ollama") {
        // Format for Ollama API - need to handle the image format differently
        // Check if any prompt contains an image
        const hasImage = prompts.some((p) =>
          p.content?.some?.((c) => c.type === "image_url")
        );
        const modelName = this.getModelName(hasImage ? "multimodal" : "text");

        console.log("generateCompletionSync(): using model:", modelName);

        if (hasImage) {
          // For prompts with images, need to format them specifically for Ollama
          const formattedPrompts = prompts.map((prompt) => {
            if (Array.isArray(prompt.content)) {
              // Format image content differently for Ollama
              const textParts = [];
              let imageBase64 = null;

              prompt.content.forEach((content) => {
                if (content.type === "text") {
                  textParts.push(content.text);
                } else if (
                  content.type === "image_url" &&
                  content.image_url?.url
                ) {
                  // Extract base64 data from the URL
                  const base64Match = content.image_url.url.match(
                    /^data:image\/[a-zA-Z]+;base64,(.+)$/
                  );
                  if (base64Match && base64Match[1]) {
                    imageBase64 = base64Match[1];
                  }
                }
              });

              // Return formatted content for Ollama
              const formattedPrompt = {
                role: prompt.role,
                content: textParts.join("\n"),
              };

              // Add image if present
              if (imageBase64) {
                formattedPrompt.images = [imageBase64];
              }

              return formattedPrompt;
            }
            return prompt;
          });

          console.log("Using Ollama multimodal format");

          response = await axios({
            method: "post",
            url: this.getLLMServiceUrl(),
            headers: {
              "Content-Type": "application/json",
            },
            data: {
              model: modelName,
              messages: formattedPrompts,
              temperature: 0.7,
              stream: false,
            },
          });
        } else {
          // For text-only prompts, the format is simpler
          response = await axios({
            method: "post",
            url: this.getLLMServiceUrl(),
            headers: {
              "Content-Type": "application/json",
            },
            data: {
              model: modelName,
              messages: prompts,
              temperature: 0.7,
              stream: false,
            },
          });
        }
      } else {
        // Original/alternative provider format
        response = await axios({
          method: "post",
          url: this.getLLMServiceUrl(),
          headers: {
            "Content-Type": "application/json",
          },
          data: {
            model: this.getModelName(
              prompts.some((p) =>
                p.content?.some?.((c) => c.type === "image_url")
              )
                ? "multimodal"
                : "text"
            ),
            messages: prompts,
            temperature: 0.7,
            stream: false,
          },
        });
      }

      const output = response.data;
      console.log("generateCompletionSync(): output:", output);

      return output;
    } catch (error) {
      console.error(
        `Error generating completion with ${provider}:`,
        error.message
      );

      // If this is the first attempt and we haven't tried the fallback provider yet
      if (!prompts._retried) {
        console.log("Attempting with fallback provider...");
        // Switch to fallback provider
        this.config.llm.defaultProvider =
          provider === "ollama" ? "alternative" : "ollama";
        // Mark as retried to prevent infinite loop
        prompts._retried = true;
        // Try again with the new provider
        return this.generateCompletionSync(prompts);
      }

      throw error;
    }
  }

  async generateCaption(id, imagePath, productName) {
    console.log("generateCaption(): imagePath:", imagePath);

    try {
      let localImagePath = imagePath;

      // Handle both URL and local file paths
      if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
        console.log("generateCaption(): downloading image...");
        localImagePath = await this.downloadImage(id, imagePath);
      } else if (!path.isAbsolute(imagePath)) {
        // If path is relative, make it absolute
        localImagePath = path.resolve(process.cwd(), imagePath);
      }

      // Verify file exists
      try {
        await fs.access(localImagePath);
        console.log(
          "generateCaption(): confirmed image exists at:",
          localImagePath
        );
      } catch (error) {
        throw new Error(`Image file not found at path: ${localImagePath}`);
      }

      const imageBase64 = await this.convertImageToBase64(localImagePath);
      console.log("generateCaption(): imageBase64:", imageBase64.length);
      const prompts = [];
      const prompt = {
        role: "user",
        content: [
          {
            type: "text",
            text: `Generate a caption in a single sentence for a product in this image, describing its type, color, material, and any notable features. Do not make assumptions about the product's use case or audience and do not again include your words (eg. Here is your caption).`,
          },
        ],
      };
      if (localImagePath) {
        const img = {
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${imageBase64}`,
          },
        };
        prompt.content.push(img);
      }

      prompts.push(prompt);

      const output = await this.generateCompletionSync(prompts);
      const responseContent =
        this.config.llm.defaultProvider === "ollama"
          ? output.message.content
          : output.choices[0].message.content;

      console.log("generateCaption(): image caption:", {
        caption: responseContent,
        img: localImagePath,
      });

      return responseContent;
    } catch (error) {
      console.error("Error generating caption:", error);
      throw error;
    }
  }

  async expandTextWithVLLM(text) {
    console.log("expandTextWithVLLM(): text:", text);
    try {
      // Check if this is a search query (no pipe separators) or product data
      const isSearchQuery = !text.includes("|");

      let systemPrompt, prompt;

      if (isSearchQuery) {
        // For search queries - optimize for finding relevant products
        systemPrompt = `You are a search query optimizer for a product search engine. Your task is to expand brief search queries into comprehensive search terms that will help find relevant products. Include synonyms, related categories, common features, materials, and use cases. Focus on extracting and enhancing the intent behind the search without changing its core meaning. Your expansion should capture both specific attributes and general product categories.`;

        prompt = `Transform this brief search query '${text}' into a comprehensive set of search terms that will help find relevant products. Include synonyms, related product categories, and typical features that users searching for this might be looking for. Format as a comma-separated list of key terms and phrases.`;
      } else {
        // For product data - optimize for searchability
        systemPrompt = `You are a product description optimizer. Your task is to analyze product data and extract the most important search-relevant features and attributes. Focus on identifying key aspects like product type, category, color, material, features, and use cases. Create a structured set of terms that would make this product discoverable through search. Be specific and factual, using only information present in the provided text.`;

        prompt = `Analyze this product information and extract the most important search-relevant terms and phrases: '${text}'. Focus on key product attributes, categories, features, and potential use cases. Format your response as a comma-separated list of key terms and phrases.`;
      }

      console.log("expandTextWithVLLM(): prompt:", prompt);

      const prompts = [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ];

      const output = await this.generateCompletionSync(prompts);
      let vllmResponseText;

      if (this.config.llm.defaultProvider === "ollama") {
        vllmResponseText = output.message.content;
      } else {
        vllmResponseText = output.choices[0].message.content;
      }

      console.log(`Expanded "${text}" to: ${vllmResponseText}`);
      return vllmResponseText;
    } catch (error) {
      console.error("Error expanding text:", error);
      // Return the original text in case of error
      return text;
    }
  }

  async getEmbedding(text, useExpansion = false) {
    try {
      if (!this.embeddingModel) {
        throw new Error(
          "Embedding model not initialized. Please call init() first."
        );
      }

      if (typeof text !== "string") {
        throw new Error("Input must be a string");
      }

      const cleanText = text.trim();
      if (!cleanText) {
        throw new Error("Input text cannot be empty");
      }

      // Always expand search queries (which are typically short)
      // but not product data (which is typically longer)
      const shouldExpand = useExpansion;

      const textToEmbed = shouldExpand
        ? await this.expandTextWithVLLM(cleanText)
        : cleanText;

      // Log for debugging
      logger.debug("Generating embedding for text:", {
        originalLength: cleanText.length,
        expandedLength: textToEmbed.length,
        wasExpanded: textToEmbed !== cleanText,
        firstFewWords: textToEmbed.substring(0, 50),
      });

      const output = await this.embeddingModel(textToEmbed, {
        pooling: "mean",
        normalize: true,
      });

      return Array.from(output.data);
    } catch (error) {
      logger.error("Error getting text embedding:", error);
      throw error;
    }
  }

  async initializeCollection() {
    try {
      const collections = await this.milvusClient.listCollections();
      console.log("Existing collections:", collections);

      const collectionExists = collections.collection_names.includes(
        this.collectionName
      );

      if (collectionExists) {
        console.log(`Collection ${this.collectionName} exists, loading...`);
        await this.milvusClient.loadCollection({
          collection_name: this.collectionName,
        });
        const stats = await this.getCollectionStats();
        console.log("Collection loaded with stats:", stats);
        return true;
      }

      console.log(`Creating new collection: ${this.collectionName}`);
      const dimensionSize = 384; // MiniLM-L6-v2 embedding dimension

      await this.milvusClient.createCollection({
        collection_name: this.collectionName,
        fields: [
          {
            name: "id",
            description: "ID field",
            data_type: "Int64",
            is_primary_key: true,
            auto_id: true,
          },
          {
            name: "product_name_vector",
            description: "Product name embedding vector",
            data_type: "FloatVector",
            dim: dimensionSize,
          },
          {
            name: "image_vector",
            description: "Image embedding vector",
            data_type: "FloatVector",
            dim: dimensionSize,
          },
          {
            name: "metadata",
            description: "Metadata field",
            data_type: "JSON",
          },
        ],
      });

      // Create indices for both vector fields
      await Promise.all([
        this.milvusClient.createIndex({
          collection_name: this.collectionName,
          field_name: "product_name_vector",
          index_type: "IVF_FLAT",
          metric_type: "COSINE",
          params: { nlist: 1024 },
        }),
        this.milvusClient.createIndex({
          collection_name: this.collectionName,
          field_name: "image_vector",
          index_type: "IVF_FLAT",
          metric_type: "COSINE",
          params: { nlist: 1024 },
        }),
      ]);

      await this.milvusClient.loadCollection({
        collection_name: this.collectionName,
      });

      console.log("Collection initialized successfully");
      return true;
    } catch (error) {
      console.error("Error initializing collection:", error);
      throw error;
    }
  }

  async getImageEmbedding(imagePath) {
    try {
      if (!this.clipModel) {
        throw new Error(
          "CLIP model not initialized. Please call init() first."
        );
      }

      // Convert image to base64
      const imageBase64 = await this.convertImageToBase64(imagePath);

      // Get image embedding using CLIP model
      const output = await this.clipModel(
        `data:image/jpeg;base64,${imageBase64}`,
        {
          pooling: "mean",
          normalize: true,
        }
      );

      return Array.from(output.data);
    } catch (error) {
      logger.error("Error getting image embedding:", error);
      throw error;
    }
  }

  async storeProductEmbedding(productId, product) {
    try {
      // Get expanded text for the product name
      const expandedText = await this.expandTextWithVLLM(product.name);

      let caption = "";
      let imageEmbedding = null;

      // Handle image processing if available
      if (product.images && product.images[0]) {
        const imagePath = product.images[0].startsWith("http")
          ? await this.downloadImage(productId, product.images[0])
          : path.join(this.storageConfig.baseImagePath, product.images[0]);

        // Generate caption and image embedding in parallel
        [caption, imageEmbedding] = await Promise.all([
          this.generateCaption(productId, imagePath),
          this.getImageEmbedding(imagePath),
        ]);
      }

      // Combine name and expanded text for embedding
      const textToEmbed = `${product.name} ${expandedText} ${caption}`.trim();
      const textEmbedding = await this.getEmbedding(textToEmbed, false);

      const insertData = {
        collection_name: this.collectionName,
        fields_data: [
          {
            id: parseInt(
              Date.now().toString() + Math.floor(Math.random() * 1000)
            ),
            product_name_vector: textEmbedding,
            image_vector: imageEmbedding || new Array(384).fill(0), // Use zero vector if no image
            metadata: {
              productId,
              created_at: new Date().toISOString(),
            },
          },
        ],
      };

      const { IDs } = await this.milvusClient.insert(insertData);
      await this.milvusClient.flush({
        collection_names: [this.collectionName],
      });

      return { textEmbedding, imageEmbedding, expandedText, caption, IDs };
    } catch (error) {
      logger.error(`Error storing product embedding for ${productId}:`, error);
      throw error;
    }
  }

  async processAndStore(imageInput, originalText = "", filename = "") {
    try {
      // Store the image first
      const imageInfo = await this.storeImage(imageInput, filename);

      // Generate caption
      const generatedCaption = await this.generateCaption(imageInput);

      // Get embeddings
      const [imageEmbedding, captionEmbedding, textEmbedding] =
        await Promise.all([
          this.getEmbedding(imageInput, "image"),
          this.getEmbedding(generatedCaption),
          originalText
            ? this.getEmbedding(originalText)
            : this.getEmbedding(generatedCaption),
        ]);

      // Store in Milvus with enhanced metadata
      await this.milvusClient.insert({
        collection_name: this.collectionName,
        fields_data: [
          {
            image_vector: imageEmbedding,
            caption_vector: captionEmbedding,
            text_vector: textEmbedding,
            metadata: {
              imageId: imageInfo.imageId,
              originalName: imageInfo.originalName,
              mainPath: imageInfo.mainPath,
              thumbnailPath: imageInfo.thumbnailPath,
              generated_caption: generatedCaption,
              original_text: originalText || generatedCaption,
              created_at: new Date().toISOString(),
              file_size: Buffer.byteLength(
                await this.getImageBuffer(imageInput)
              ),
            },
          },
        ],
      });

      return {
        imageInfo,
        caption: generatedCaption,
        metadata: {
          original_text: originalText,
        },
      };
    } catch (error) {
      console.error("Error processing and storing:", error);
      throw error;
    }
  }

  async search(
    query,
    queryType = "text",
    searchFields = ["image_vector", "caption_vector", "text_vector"],
    limit = 5
  ) {
    try {
      const queryVector = await this.getEmbedding(query, queryType);

      // Search across all specified vector fields
      const searchPromises = searchFields.map((field) =>
        this.milvusClient.search({
          collection_name: this.collectionName,
          vector: queryVector,
          field_name: field,
          limit: limit,
          params: { nprobe: 10 },
        })
      );

      const results = await Promise.all(searchPromises);

      // Combine and deduplicate results
      const combinedResults = results.flat().sort((a, b) => b.score - a.score);
      const uniqueResults = Array.from(
        new Map(
          combinedResults.map((item) => [item.metadata.image_path, item])
        ).values()
      );

      return uniqueResults.slice(0, limit);
    } catch (error) {
      console.error("Error searching:", error);
      throw error;
    }
  }

  async searchProductEmbedding(searchText, limit = 5) {
    try {
      logger.debug("searchProductEmbedding(): searchText:", searchText);

      // Get embedding for the search query
      // Setting useExpansion to false for search queries
      const queryVector = await this.getEmbedding(searchText, false);

      // Perform parallel searches on both text and image vectors
      const [textSearchResults, imageSearchResults] = await Promise.all([
        // Search against product text data
        this.milvusClient.search({
          collection_name: this.collectionName,
          vector: queryVector,
          field_name: "product_name_vector",
          limit: limit * 2,
          params: { nprobe: 16 }, // Higher nprobe for better recall
          output_fields: ["metadata"],
        }),

        // Search against product image data
        this.milvusClient.search({
          collection_name: this.collectionName,
          vector: queryVector,
          field_name: "image_vector",
          limit: limit,
          params: { nprobe: 16 },
          output_fields: ["metadata"],
        }),
      ]);

      logger.debug("Vector search results count:", {
        textResults: textSearchResults.results.length,
        imageResults: imageSearchResults.results.length,
      });

      // Process text search results
      const textResults = textSearchResults.results.map((result) => ({
        productId: result.metadata.productId,
        score: result.score,
        created_at: result.metadata.created_at,
        searchType: "text",
      }));

      // Process image search results
      const imageResults = imageSearchResults.results.map((result) => ({
        productId: result.metadata.productId,
        score: result.score * 0.9, // Slightly lower weight for image results
        created_at: result.metadata.created_at,
        searchType: "image",
      }));

      // Combine results
      const combinedResults = [...textResults, ...imageResults];

      // Create a Map to merge duplicate products and keep the higher score
      const productMap = new Map();

      combinedResults.forEach((result) => {
        const existing = productMap.get(result.productId);
        if (!existing || existing.score < result.score) {
          productMap.set(result.productId, result);
        }
      });

      // Convert back to array, sort by score, and limit results
      const processedData = Array.from(productMap.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      logger.debug("Final search results for:", searchText, {
        count: processedData.length,
        topScore: processedData.length > 0 ? processedData[0].score : 0,
        bottomScore:
          processedData.length > 0
            ? processedData[processedData.length - 1].score
            : 0,
      });

      return processedData;
    } catch (error) {
      logger.error("Error searching product embedding:", error);
      throw error;
    }
  }

  async getCollectionStats() {
    try {
      // Get collection statistics
      const stats = await this.milvusClient.getCollectionStatistics({
        collection_name: this.collectionName,
      });

      console.log("Collection Stats:", {
        rowCount: stats.row_count,
        collectionName: this.collectionName,
      });

      return stats;
    } catch (error) {
      console.error("Error getting collection stats:", error);
      throw error;
    }
  }

  async listAllProducts(limit = 100) {
    try {
      const results = await this.milvusClient.query({
        collection_name: this.collectionName,
        filter: "", // empty string means no filter
        output_fields: ["metadata"],
        limit,
      });

      console.log("Products in Milvus:", results);
      return results;
    } catch (error) {
      console.error("Error listing products:", error);
      throw error;
    }
  }

  async testConnection() {
    try {
      const version = await this.milvusClient.getVersion();
      console.log("Connected to Milvus version:", version);
      return true;
    } catch (error) {
      console.error("Failed to connect to Milvus:", error);
      throw error;
    }
  }

  async searchByMetadata(metadata) {
    try {
      const expr = `json_contains(metadata, '${JSON.stringify(metadata)}')`;
      const results = await this.milvusClient.query({
        collection_name: this.collectionName,
        filter: expr,
        output_fields: ["metadata"],
        limit: 1,
      });

      console.log(
        `searchByMetadata results for ${JSON.stringify(metadata)}:`,
        results
      );
      return results;
    } catch (error) {
      logger.error("Error searching by metadata:", error);
      throw error;
    }
  }

  async deleteCollection() {
    try {
      const exists = await this.milvusClient.hasCollection({
        collection_name: this.collectionName,
      });

      if (exists) {
        await this.milvusClient.dropCollection({
          collection_name: this.collectionName,
        });
        console.log(`Collection ${this.collectionName} deleted successfully`);
      } else {
        console.log(`Collection ${this.collectionName} does not exist`);
      }
    } catch (error) {
      logger.error("Error deleting collection:", error);
      throw error;
    }
  }

  async semanticSearch(userQuery, contextSize = 5) {
    try {
      // First, understand the intent of the query using VLLM
      const searchQuery = await vllmClient.generateCompletion(`
Convert this user question into a search-optimized query. 
Keep only the essential search terms.
User question: "${userQuery}"`);

      const queryResponseText = searchQuery.choices[0].message.content;

      // Get expanded results
      const results = await this.searchProductEmbedding(
        queryResponseText,
        contextSize
      );

      console.log("semanticSearch(): results:", results);

      // Format results for chatbot context
      const context = results.map((r) => ({
        content: r.name,
        score: r.score,
        metadata: r.metadata,
      }));

      return {
        originalQuery: userQuery,
        searchQuery,
        results: context,
      };
    } catch (error) {
      logger.error("Error in semantic search:", error);
      throw error;
    }
  }

  async ragSearch(Product, query, limit = 10) {
    try {
      logger.info("Starting RAG search for query:", { query });

      // Perform multiple search strategies in parallel
      const [exactResults, semanticResults] = await Promise.all([
        // Direct keyword search in MongoDB (as fallback)
        Product.find({
          $or: [
            { name: { $regex: query, $options: "i" } },
            { category: { $regex: query, $options: "i" } },
            { description: { $regex: query, $options: "i" } },
          ],
        }).limit(limit),

        // Vector search with original query
        this.searchProductEmbedding(query, limit * 2),
      ]);

      logger.debug("Search results count:", {
        exactMatches: exactResults.length,
        semanticMatches: semanticResults.length,
      });

      // Extract product IDs from vector search results
      const semanticProductIds = semanticResults.map(
        (result) => result.productId
      );

      // Fetch complete product details for semantic results
      const semanticProducts = await Product.find({
        sourceId: { $in: semanticProductIds },
      });

      // Combine results with proper ordering (semantic first, then exact matches)
      // and remove duplicates
      const combinedProductMap = new Map();

      // Add semantic search results first (they are sorted by relevance score)
      semanticProductIds.forEach((productId, index) => {
        const product = semanticProducts.find((p) => p.sourceId === productId);
        if (product && !combinedProductMap.has(product.sourceId)) {
          // Add score information to help with debugging
          const result = semanticResults[index];
          product._searchScore = result ? result.score : 0;
          product._searchMethod = "semantic";
          combinedProductMap.set(product.sourceId, product);
        }
      });

      // Then add any exact matches that weren't already included
      exactResults.forEach((product) => {
        if (!combinedProductMap.has(product.sourceId)) {
          product._searchMethod = "exact";
          combinedProductMap.set(product.sourceId, product);
        }
      });

      // Convert to array and limit results
      const allResults = Array.from(combinedProductMap.values()).slice(
        0,
        limit
      );

      logger.info("RAG search completed", {
        query,
        resultCount: allResults.length,
        semanticCount: semanticResults.length,
        exactCount: exactResults.length,
      });

      return allResults;
    } catch (error) {
      logger.error("Error in RAG search:", error);
      throw error;
    }
  }

  async searchByImage(imagePath, limit = 5) {
    try {
      const imageEmbedding = await this.getImageEmbedding(imagePath);

      const searchResults = await this.milvusClient.search({
        collection_name: this.collectionName,
        vector: imageEmbedding,
        field_name: "image_vector",
        limit: limit,
        params: { nprobe: 16 },
        output_fields: ["metadata"],
      });

      const processedResults = searchResults.results.map((result) => ({
        productId: result.metadata.productId,
        score: result.score,
        metadata: result.metadata,
      }));

      console.log(
        "searchByImage(): processedResults:",
        processedResults.length
      );

      return processedResults;
    } catch (error) {
      logger.error("Error searching by image:", error);
      throw error;
    }
  }

  async convertBufferToBase64(imageBuffer) {
    try {
      const processedBuffer = await sharp(imageBuffer)
        .resize(384, 384, {
          fit: "contain",
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .toFormat("jpg")
        .toBuffer();

      return processedBuffer.toString("base64");
    } catch (error) {
      console.error("Error preprocessing image buffer:", error);
      throw error;
    }
  }

  async getImageEmbeddingFromBuffer(imageBuffer) {
    try {
      if (!this.clipModel) {
        throw new Error(
          "CLIP model not initialized. Please call init() first."
        );
      }

      // Convert buffer to base64
      const imageBase64 = await this.convertBufferToBase64(imageBuffer);

      // Get image embedding using CLIP model
      const output = await this.clipModel(
        `data:image/jpeg;base64,${imageBase64}`,
        {
          pooling: "mean",
          normalize: true,
        }
      );

      return Array.from(output.data);
    } catch (error) {
      logger.error("Error getting image embedding from buffer:", error);
      throw error;
    }
  }

  async searchByImageBuffer(imageBuffer, limit = 10) {
    try {
      console.log("searchByImageBuffer(): imageBuffer:", imageBuffer);
      const imageEmbedding = await this.getImageEmbeddingFromBuffer(
        imageBuffer
      );

      const searchResults = await this.milvusClient.search({
        collection_name: this.collectionName,
        vector: imageEmbedding,
        field_name: "image_vector",
        limit: limit,
        params: { nprobe: 16 },
        output_fields: ["metadata"],
      });

      const processedResults = searchResults.results.map((result) => ({
        productId: result.metadata.productId,
        score: result.score,
        metadata: result.metadata,
      }));

      return processedResults;
    } catch (error) {
      logger.error("Error searching by image buffer:", error);
      throw error;
    }
  }

  async generateDetailedImageAnalysis(imageInput, productName) {
    try {
      let imageBase64;
      if (Buffer.isBuffer(imageInput)) {
        imageBase64 = await this.convertBufferToBase64(imageInput);
      } else {
        // Assuming imageInput is a path if not a buffer
        imageBase64 = await this.convertImageToBase64(imageInput);
      }

      const analysisPrompt = {
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyze the provided product image and extract key visual features to describe it as if it were a user search query. Create a concise, two-to-five-word phrase that captures the most relevant attributes, such as color, category, purpose, or unique features of the product. The generated phrase should mimic how a user might search for this product.`,
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`,
            },
          },
        ],
      };

      const response = await this.generateCompletionSync([analysisPrompt]);
      let analysis;
      try {
        analysis = response.choices[0].message.content;
      } catch (e) {
        // If JSON parsing fails, use the raw response
        console.log("generateDetailedImageAnalysis(): error:", e);
      }

      console.log("generateDetailedImageAnalysis(): analysis:", analysis);

      return analysis;
    } catch (error) {
      console.error("Error generating detailed image analysis:", error);
      throw error;
    }
  }

  async searchByImageEmbedding(imageInput, limit = 5) {
    try {
      console.log("searchByImageEmbedding(): imageInput:", imageInput);
      let imageEmbedding;
      if (Buffer.isBuffer(imageInput)) {
        imageEmbedding = await this.getImageEmbeddingFromBuffer(imageInput);
      } else {
        imageEmbedding = await this.getImageEmbedding(imageInput);
      }

      const searchResults = await this.milvusClient.search({
        collection_name: this.collectionName,
        vector: imageEmbedding,
        field_name: "image_vector",
        limit: limit * 2, // Get more results initially for better filtering
        params: { nprobe: 16 },
        output_fields: ["metadata"],
      });

      return searchResults.results.map((result) => ({
        productId: result.metadata.productId,
        score: result.score,
        metadata: result.metadata,
        matchType: "visual",
      }));
    } catch (error) {
      console.error("Error in image embedding search:", error);
      throw error;
    }
  }

  calculateColorSimilarity(color1, color2) {
    // Convert color names to a simple similarity score
    // This is a basic implementation - could be enhanced with actual color space calculations
    if (color1.toLowerCase() === color2.toLowerCase()) return 1.0;

    // Check for color family matches (e.g., "dark blue" and "navy")
    const color1Words = color1.toLowerCase().split(" ");
    const color2Words = color2.toLowerCase().split(" ");
    const commonColors = color1Words.filter((c) => color2Words.includes(c));

    return commonColors.length > 0 ? 0.5 : 0;
  }

  calculateFeatureMatch(analysis1, analysis2) {
    let score = 0;
    const weights = {
      productType: 0.3,
      style: 0.2,
      material: 0.2,
      pattern: 0.15,
      brand: 0.15,
    };

    // Compare product type
    if (
      analysis1.productType?.toLowerCase() ===
      analysis2.productType?.toLowerCase()
    ) {
      score += weights.productType;
    }

    // Compare style
    if (analysis1.style?.toLowerCase() === analysis2.style?.toLowerCase()) {
      score += weights.style;
    }

    // Compare material
    if (
      analysis1.material?.toLowerCase() === analysis2.material?.toLowerCase()
    ) {
      score += weights.material;
    }

    // Compare patterns
    if (analysis1.pattern?.toLowerCase() === analysis2.pattern?.toLowerCase()) {
      score += weights.pattern;
    }

    // Compare brand
    if (analysis1.brand?.toLowerCase() === analysis2.brand?.toLowerCase()) {
      score += weights.brand;
    }

    return score;
  }

  async enhancedImageSearch(Product, imageInput, limit = 10) {
    try {
      // 1. Generate detailed analysis of the search image
      const searchImageAnalysis = await this.generateDetailedImageAnalysis(
        imageInput
      );

      console.log(
        "enhancedImageSearch(): searchImageAnalysis:",
        searchImageAnalysis
      );

      // 2. Perform parallel searches
      const [visualResults, semanticResults] = await Promise.all([
        this.searchByImageBuffer(imageInput, limit),
        this.searchProductEmbedding(searchImageAnalysis, limit),
      ]);

      // 3. Merge and rank results
      const combinedResults = [...visualResults, ...semanticResults];

      console.log("combinedResults:", combinedResults);

      // 4. Get full product details for top results
      const topProductIds = combinedResults
        // .slice(0, limit)
        .map((result) => result.productId);

      const products = await Product.find({
        sourceId: { $in: topProductIds },
      });

      // // 5. Add search scores to product results
      // const enhancedProducts = products.map(product => {
      //   const searchResult = combinedResults.find(
      //     r => r.productId === product.sourceId
      //   );
      //   return {
      //     ...product.toObject(),
      //     searchScores: {
      //       visualScore: searchResult.visualScore,
      //       semanticScore: searchResult.semanticScore,
      //       featureScore: searchResult.featureScore,
      //       totalScore: searchResult.totalScore
      //     }
      //   };
      // });

      // // Sort by total score
      // enhancedProducts.sort((a, b) =>
      //   b.searchScores.totalScore - a.searchScores.totalScore
      // );

      return products;
    } catch (error) {
      console.error("Error in enhanced image search:", error);
      throw error;
    }
  }
}

module.exports = MultimodalProcessor;
