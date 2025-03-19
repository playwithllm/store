const { MilvusClient } = require("@zilliz/milvus2-sdk-node");
const sharp = require("sharp");
const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");


const MODEL = {
  INTERN_VL2_5_1B_MPO: "OpenGVLab/InternVL2_5-1B-MPO",
  GEMMA3_12B: 'gemma3:12b',
};

class MultimodalProcessor {
  constructor() {
    this.milvusClient = new MilvusClient({
      address: "localhost:19530",
    });
    this.collectionName = "multimodal_collection_pwllm";
    this.storageConfig = {
      baseImagePath:
        process.env.IMAGE_STORAGE_PATH || path.join(process.cwd(), "uploads"),
      maxImageSize: 5 * 1024 * 1024, // 5MB
      allowedFormats: ["jpg", "jpeg", "png"],
    };

    this.clipModel = null;
    this.pipeline = null;
    this.embeddingModel = null;
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
    } catch (error) {
      console.error("Error initializing models:", error);
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
    const response = await axios({
      method: "post",
      url: "http://192.168.4.28:8000/v1/chat/completions",
      headers: {
        "Content-Type": "application/json",
      },
      data: {
        model: MODEL.INTERN_VL2_5_1B_MPO,
        messages: prompts,
        // max_completion_tokens: 100,
        temperature: 0.7,
        stream: false,
      },
    });

    const output = response.data;

    console.log("generateCompletionSync(): output:", output);

    return output;
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
            text: `Generate a detailed caption in a single sentence for a product in this image, describing its type, color, material, and any notable features.`,
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
      console.log("generateCaption(): image caption:", {
        caption: output.choices[0].message.content,
        img: localImagePath,
      });

      return output.choices[0].message.content;
    } catch (error) {
      console.error("Error generating caption:", error);
      throw error;
    }
  }

  async expandTextWithVLLM(text) {
    console.log("expandTextWithVLLM(): text:", text);
    try {
      const systemPrompt = `You are a product description optimizer. Your task is to enhance product titles by expanding them into meaningful, search-friendly sentences. Focus on including relevant details like product type, features, color, material, target audience, and popular use cases (e.g., Halloween, cosplay, parties, or events). Ensure the expansion remains concise, factually accurate, and avoids adding unverified claims. Always write the expansion as a single, well-constructed sentence.`;
      const prompt = `Take the product title '${text}' and expand it into a meaningful, single-sentence description that includes relevant details about the product, such as type, color, features, target audience, and potential use cases.`;
      console.log("expandTextWithVLLM(): prompt:", prompt);

      const prompts = [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ];

      const output = await this.generateCompletionSync(prompts);
      console.log("expandTextWithVLLM(): output:", output);

      const vllmResponseText = output.choices[0].message.content;
      console.log(`Expanded "${text}" to: ${vllmResponseText}`);
      return vllmResponseText;
    } catch (error) {
      console.error("Error expanding text:", error);
      throw error;
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

      // Only expand text if flag is true and text isn't too long
      const textToEmbed =
        useExpansion && cleanText.length < 100
          ? await this.expandTextWithVLLM(cleanText)
          : cleanText;

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
      console.log("searchProductEmbedding(): searchText:", searchText);
      // For search queries, we want to be more aggressive with expansion
      // const expandedQuery = await this.expandTextWithVLLM(searchText);
      // console.log('searchProductEmbedding(): expandedQuery:', expandedQuery);
      const queryVector = await this.getEmbedding(searchText);
      const searchResults = await this.milvusClient.search({
        collection_name: this.collectionName,
        vector: queryVector,
        field_name: "product_name_vector",
        limit: limit * 2, // Get more results initially for better filtering
        params: { nprobe: 16 }, // Increased from 10 for better recall
        output_fields: ["metadata"],
      });

      console.log(
        "searchProductEmbedding(): searchResults:",
        searchResults.results
      );

      // Process and rank results considering semantic similarity
      const processedData = searchResults.results
        .map((result) => ({
          productId: result.metadata.productId,
          score: result.score,
          created_at: result.metadata.created_at,
        }))
        // Optional: Additional relevance scoring logic here
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      logger.debug("Search results for:", searchText, processedData);
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
      // Search in Milvus
      const searchResults = await this.searchProductEmbedding(query, limit);

      console.log("ragSearch(): searchResults:", searchResults);

      // Get product IDs from results
      const productIds = searchResults.map((result) => result.productId);

      console.log("ragSearch(): productIds:", productIds);

      //       // Fetch full product details from MongoDB
      //       const products = await Product.find({ sourceId: { $in: productIds } });

      //       // Prepare context for LLM
      //       const context = products.map(p => `
      // Product ID: ${p.sourceId} \n
      // Name: ${p.name} \n
      // Category: ${p.category} \n
      // `).join('\n---\n');

      //       const systemPrompt = `You are a helpful assistant that searches for products based on user queries. Your task is to analyze the user's query and find the most relevant products from the provided list. Prioritize products that are semantically similar to the query. Match on product type, category, or context, not just keywords. For example:

      //   - If the query mentions clothing-related terms like 'dress' or 'outfit,' prioritize products such as costumes, apparel, or accessories over unrelated items.
      //   - If the query mentions electronics, match devices, gadgets, or components that fit the context.
      //   - Always aim to identify the product(s) that best align with the intent of the query, even if the exact words do not match. Use all available product information, including names, descriptions, and image captions, to determine relevance.`;

      //       // Generate LLM prompt
      //       const prompt = `User Query: "${query}"

      // Available Products:
      // ${context}

      // Based on the user's query, analyze these products and return ONLY the product IDs that best match the query.
      // Format your response as a comma-separated list of product IDs, nothing else.
      // Example response format: ["123", "456", "789"]`;

      //       const prompts = [
      //         {
      //           role: 'system',
      //           content: systemPrompt
      //         },
      //         {
      //           role: 'user',
      //           content: prompt
      //         }
      //       ]

      //       // Get LLM response
      //       const llmResponse = await this.generateCompletionSync(prompts);

      //       console.log('ragSearch(): LLM response:', llmResponse.choices[0].message);

      //       // Extract product IDs from LLM response
      //       const recommendedIds = llmResponse.choices[0].message.content
      //         .split(',')
      //         .map(id => id.trim())
      //         .filter(Boolean);

      //       console.log('ragSearch(): recommendedIds:', recommendedIds);

      // Fetch final products in order of recommendation
      const finalProducts = await Product.find({
        sourceId: { $in: productIds },
      });

      // Sort products according to LLM's recommendation order
      const sortedProducts = productIds
        .map((id) => finalProducts.find((p) => p.sourceId === id))
        .filter(Boolean);

      console.log("ragSearch(): sortedProducts:", sortedProducts.length);

      return sortedProducts;
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
