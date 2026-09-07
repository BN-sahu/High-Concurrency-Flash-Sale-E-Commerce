import mongoose from 'mongoose';

export const connectMongo = async (uri: string) => {
  if (mongoose.connection.readyState >= 1) {
    return;
  }
  return mongoose.connect(uri);
};

// ============ Product Catalog (Read-Only for Transactions) ============
const productCatalogSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, index: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, default: '' },
    shortDescription: { type: String, default: '' },

    // Pricing (source of truth is PostgreSQL, this is denormalized for catalog display)
    price: { type: Number, required: true },
    compareAtPrice: { type: Number }, // Original price for showing discount
    currency: { type: String, default: 'USD' },

    // PostgreSQL inventory reference
    inventoryId: { type: String, required: true, unique: true },
    productId: { type: String, required: true, unique: true }, // PG Product.id

    // Media
    images: [
      {
        url: { type: String, required: true },
        alt: { type: String, default: '' },
        isPrimary: { type: Boolean, default: false },
      },
    ],

    // Categorization
    category: { type: String, index: true },
    tags: [{ type: String }],
    brand: { type: String },

    // Product specifications
    specifications: [
      {
        key: { type: String },
        value: { type: String },
      },
    ],

    // Flash sale configuration
    flashSale: {
      isFlashSale: { type: Boolean, default: false },
      startTime: { type: Date },
      endTime: { type: Date },
      originalPrice: { type: Number },
      flashPrice: { type: Number },
      maxPerUser: { type: Number, default: 1 },
    },

    // Ratings (aggregated)
    ratings: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0 },
    },

    // SEO
    seo: {
      metaTitle: { type: String },
      metaDescription: { type: String },
    },

    // Status
    status: {
      type: String,
      enum: ['active', 'archived', 'coming_soon', 'draft'],
      default: 'active',
      index: true,
    },

    // Visibility
    isVisible: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Text index for search
productCatalogSchema.index({ name: 'text', description: 'text', tags: 'text' });

// Compound index for flash sale queries
productCatalogSchema.index({
  'flashSale.isFlashSale': 1,
  'flashSale.startTime': 1,
  'flashSale.endTime': 1,
  status: 1,
});

export const ProductCatalog =
  mongoose.models.ProductCatalog ||
  mongoose.model('ProductCatalog', productCatalogSchema);
