import { PrismaClient } from '@prisma/client';
import mongoose from 'mongoose';
import { ProductCatalog } from './src/mongo';

const prisma = new PrismaClient();

const MOCK_PRODUCTS = [
  { name: "Nike Air Max 2024 Limited", slug: "nike-air-max-2024", description: "The ultimate running shoe with dynamic air units.", price: 249.99, imageUrl: "🔥", quantity: 50, category: "Shoes", tags: ["running", "limited"] },
  { name: "PlayStation 6 Pro Bundle", slug: "ps6-pro", description: "Next-generation gaming console.", price: 599.99, imageUrl: "🎮", quantity: 20, category: "Gaming", tags: ["console", "gaming"] },
  { name: "Apple Vision Ultra", slug: "apple-vision-ultra", description: "Spatial computing redefined.", price: 2499.99, imageUrl: "🥽", quantity: 100, category: "Electronics", tags: ["vr", "tech"] },
  { name: "Rolex Submariner Black", slug: "rolex-sub", description: "Classic diver's watch.", price: 8999.99, imageUrl: "⌚", quantity: 10, category: "Watches", tags: ["luxury", "watch"] },
  { name: "Tesla Model S Toy Car", slug: "tesla-toy", description: "For the kids.", price: 149.99, imageUrl: "🚗", quantity: 200, category: "Toys", tags: ["car", "kids"] },
  { name: "Supreme x Louis Vuitton Tee", slug: "supreme-lv-tee", description: "Exclusive streetwear.", price: 899.99, imageUrl: "👕", quantity: 50, category: "Fashion", tags: ["streetwear", "hype"] },
];

async function main() {
  console.log("Connecting to MongoDB...");
  // Connect to MongoDB Atlas (we need to load the URL from .env, but it's passed here or we can use the environment variable directly)
  const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/flashsale";
  await mongoose.connect(mongoUri);

  console.log("Seeding database...");
  for (const p of MOCK_PRODUCTS) {
    const product = await prisma.product.create({
      data: {
        name: p.name,
        description: p.description,
        price: p.price,
        currency: 'INR',
        status: 'ACTIVE',
        imageUrl: p.imageUrl,
        inventory: {
          create: {
            totalQuantity: p.quantity,
            availableQuantity: p.quantity,
            reservedQuantity: 0,
            soldQuantity: 0,
          }
        }
      },
      include: {
        inventory: true
      }
    });
    console.log(`Created PG product: ${product.name}`);

    // Seed MongoDB
    await ProductCatalog.create({
      name: p.name,
      slug: p.slug + "-" + Date.now(),
      description: p.description,
      price: p.price,
      currency: 'INR',
      inventoryId: product.inventory?.id,
      productId: product.id,
      images: [{ url: p.imageUrl, isPrimary: true }],
      category: p.category,
      tags: p.tags,
      flashSale: {
        isFlashSale: true,
        startTime: new Date(Date.now() - 1000 * 60 * 60), // started 1 hour ago
        endTime: new Date(Date.now() + 1000 * 60 * 60 * 24), // ends in 24 hours
        originalPrice: p.price * 1.5,
        flashPrice: p.price,
        maxPerUser: 1,
      },
      status: 'active',
      isVisible: true,
    });
    console.log(`Created MongoDB product: ${product.name}`);
  }
  console.log("Seeding complete!");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await mongoose.disconnect();
  });
