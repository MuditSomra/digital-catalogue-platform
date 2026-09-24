import { PrismaClient, AdminRole, AttributeType, VideoType, InventoryMovementType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding for Kitchen Appliance Showroom (Phase 1)...");

  // 1. Clean existing records in dependency order
  console.log("🧹 Cleaning existing data...");
  await prisma.inventoryMovement.deleteMany({});
  await prisma.inventory.deleteMany({});
  await prisma.productImage.deleteMany({});
  await prisma.productVideo.deleteMany({});
  await prisma.productAttributeValue.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.attributeValue.deleteMany({});
  await prisma.categoryAttribute.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.brand.deleteMany({});
  await prisma.adminUser.deleteMany({});

  // 2. Seed Default Admin User
  console.log("👤 Creating seed admin user...");
  const adminUser = await prisma.adminUser.create({
    data: {
      email: "admin@kitchenshowroom.local",
      name: "System Administrator",
      role: AdminRole.SUPER_ADMIN,
      isActive: true,
      // Note: In Phase 2+, password hash or Supabase auth ID will be populated.
    },
  });

  // 3. Seed Starter Brands
  console.log("🏷️ Creating sample brands...");
  const brandsData = [
    { name: "Prestige", slug: "prestige", description: "India's largest kitchen appliance brand offering innovation and safety." },
    { name: "Faber", slug: "faber", description: "Pioneer in kitchen hoods and European cooking appliances." },
    { name: "Bosch", slug: "bosch", description: "German engineering for premium, durable kitchen appliances." },
    { name: "Philips", slug: "philips", description: "Trusted household brand delivering high-performance food prep appliances." },
    { name: "Glen", slug: "glen", description: "Modern kitchen appliances blending aesthetic design with high utility." },
    { name: "Elica", slug: "elica", description: "Italian design leader in chimneys and built-in hobs." },
  ];

  const brandMap = new Map<string, string>();
  for (const b of brandsData) {
    const created = await prisma.brand.create({ data: b });
    brandMap.set(b.slug, created.id);
  }

  // 4. Seed Category Tree (Strictly NO refrigeration)
  console.log("📂 Creating category hierarchy...");

  // Root Category
  const rootCategory = await prisma.category.create({
    data: {
      name: "Kitchen Appliances",
      slug: "kitchen-appliances",
      description: "Complete range of premium kitchen and cooking appliances",
      sortOrder: 0,
      isActive: true,
    },
  });

  // Level 1 Categories
  const cookingAppliances = await prisma.category.create({
    data: {
      name: "Cooking Appliances",
      slug: "cooking-appliances",
      description: "Gas stoves, hobs, cooktops, ovens, and air fryers",
      parentId: rootCategory.id,
      sortOrder: 1,
      isActive: true,
    },
  });

  const kitchenVentilation = await prisma.category.create({
    data: {
      name: "Kitchen Ventilation",
      slug: "kitchen-ventilation",
      description: "Kitchen chimneys and exhaust systems for clean air",
      parentId: rootCategory.id,
      sortOrder: 2,
      isActive: true,
    },
  });

  const foodPreparation = await prisma.category.create({
    data: {
      name: "Food Preparation",
      slug: "food-preparation",
      description: "Mixer grinders, food processors, juicers, and blenders",
      parentId: rootCategory.id,
      sortOrder: 3,
      isActive: true,
    },
  });

  const waterAppliances = await prisma.category.create({
    data: {
      name: "Water Appliances",
      slug: "water-appliances",
      description: "Water purifiers, dispensers, and electric kettles",
      parentId: rootCategory.id,
      sortOrder: 4,
      isActive: true,
    },
  });

  const dishwashing = await prisma.category.create({
    data: {
      name: "Dishwashing",
      slug: "dishwashing",
      description: "Built-in and free-standing dishwashers",
      parentId: rootCategory.id,
      sortOrder: 5,
      isActive: true,
    },
  });

  const kitchenAccessories = await prisma.category.create({
    data: {
      name: "Kitchen Accessories",
      slug: "kitchen-accessories",
      description: "Genuine accessories, ducts, pipes, and replacement parts",
      parentId: rootCategory.id,
      sortOrder: 6,
      isActive: true,
    },
  });

  // Level 2 Categories under Cooking Appliances
  const gasStoves = await prisma.category.create({
    data: { name: "Gas Stoves", slug: "gas-stoves", parentId: cookingAppliances.id, sortOrder: 1 },
  });
  await prisma.category.create({
    data: { name: "Gas Hobs", slug: "gas-hobs", parentId: cookingAppliances.id, sortOrder: 2 },
  });
  await prisma.category.create({
    data: { name: "Built-in Hobs", slug: "built-in-hobs", parentId: cookingAppliances.id, sortOrder: 3 },
  });
  await prisma.category.create({
    data: { name: "Induction Cooktops", slug: "induction-cooktops", parentId: cookingAppliances.id, sortOrder: 4 },
  });
  await prisma.category.create({
    data: { name: "Electric Cooktops", slug: "electric-cooktops", parentId: cookingAppliances.id, sortOrder: 5 },
  });

  const microwaveOvens = await prisma.category.create({
    data: { name: "Microwave Ovens", slug: "microwave-ovens", parentId: cookingAppliances.id, sortOrder: 6 },
  });
  // Level 3 Categories under Microwave Ovens
  await prisma.category.create({
    data: { name: "Solo", slug: "microwave-ovens-solo", parentId: microwaveOvens.id, sortOrder: 1 },
  });
  await prisma.category.create({
    data: { name: "Grill", slug: "microwave-ovens-grill", parentId: microwaveOvens.id, sortOrder: 2 },
  });
  await prisma.category.create({
    data: { name: "Convection", slug: "microwave-ovens-convection", parentId: microwaveOvens.id, sortOrder: 3 },
  });

  await prisma.category.create({
    data: { name: "OTG Ovens", slug: "otg-ovens", parentId: cookingAppliances.id, sortOrder: 7 },
  });
  await prisma.category.create({
    data: { name: "Air Fryers", slug: "air-fryers", parentId: cookingAppliances.id, sortOrder: 8 },
  });

  // Level 2 Categories under Kitchen Ventilation
  const kitchenChimneys = await prisma.category.create({
    data: { name: "Kitchen Chimneys", slug: "kitchen-chimneys", parentId: kitchenVentilation.id, sortOrder: 1 },
  });
  await prisma.category.create({
    data: { name: "Exhaust Fans", slug: "exhaust-fans", parentId: kitchenVentilation.id, sortOrder: 2 },
  });

  // Level 2 Categories under Food Preparation
  const mixerGrinders = await prisma.category.create({
    data: { name: "Mixer Grinders", slug: "mixer-grinders", parentId: foodPreparation.id, sortOrder: 1 },
  });
  await prisma.category.create({
    data: { name: "Juicers", slug: "juicers", parentId: foodPreparation.id, sortOrder: 2 },
  });
  await prisma.category.create({
    data: { name: "Cold Press Juicers", slug: "cold-press-juicers", parentId: foodPreparation.id, sortOrder: 3 },
  });
  await prisma.category.create({
    data: { name: "Food Processors", slug: "food-processors", parentId: foodPreparation.id, sortOrder: 4 },
  });
  await prisma.category.create({
    data: { name: "Hand Blenders", slug: "hand-blenders", parentId: foodPreparation.id, sortOrder: 5 },
  });
  await prisma.category.create({
    data: { name: "Choppers", slug: "choppers", parentId: foodPreparation.id, sortOrder: 6 },
  });
  await prisma.category.create({
    data: { name: "Hand Mixers", slug: "hand-mixers", parentId: foodPreparation.id, sortOrder: 7 },
  });

  // Level 2 Categories under Water Appliances
  await prisma.category.create({
    data: { name: "Water Purifiers", slug: "water-purifiers", parentId: waterAppliances.id, sortOrder: 1 },
  });
  await prisma.category.create({
    data: { name: "Water Dispensers", slug: "water-dispensers", parentId: waterAppliances.id, sortOrder: 2 },
  });
  await prisma.category.create({
    data: { name: "Electric Kettles", slug: "electric-kettles", parentId: waterAppliances.id, sortOrder: 3 },
  });

  // Level 2 Categories under Dishwashing
  await prisma.category.create({
    data: { name: "Dishwashers", slug: "dishwashers", parentId: dishwashing.id, sortOrder: 1 },
  });

  // Level 2 Categories under Kitchen Accessories
  await prisma.category.create({
    data: { name: "Gas Accessories", slug: "gas-accessories", parentId: kitchenAccessories.id, sortOrder: 1 },
  });
  await prisma.category.create({
    data: { name: "Chimney Accessories", slug: "chimney-accessories", parentId: kitchenAccessories.id, sortOrder: 2 },
  });
  await prisma.category.create({
    data: { name: "Appliance Accessories", slug: "appliance-accessories", parentId: kitchenAccessories.id, sortOrder: 3 },
  });

  // 5. Seed Starter Attributes & Predefined Values
  console.log("⚙️ Creating dynamic category attributes and option values...");

  // Helper map: attributeSlug -> { attributeId, valuesMap: value -> valueId }
  const attrMap = new Map<string, { id: string; valueMap: Map<string, string> }>();

  async function createAttributeWithOptions(
    categoryId: string,
    name: string,
    slug: string,
    type: AttributeType,
    options: string[],
    unit?: string,
    isFilterable = true
  ) {
    const attr = await prisma.categoryAttribute.create({
      data: {
        categoryId,
        name,
        slug,
        type,
        unit,
        isFilterable,
        sortOrder: attrMap.size + 1,
      },
    });

    const valueMap = new Map<string, string>();
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const val = await prisma.attributeValue.create({
        data: {
          attributeId: attr.id,
          value: opt,
          label: opt,
          sortOrder: i + 1,
        },
      });
      valueMap.set(opt, val.id);
    }

    attrMap.set(slug, { id: attr.id, valueMap });
    return attr;
  }

  // --- Gas Stoves Starter Attributes ---
  await createAttributeWithOptions(gasStoves.id, "Burner Count", "burner-count", AttributeType.SELECT, ["2", "3", "4", "5"], "Burners");
  await createAttributeWithOptions(gasStoves.id, "Cooktop Material", "cooktop-material", AttributeType.SELECT, ["Glass", "Stainless Steel"]);
  await createAttributeWithOptions(gasStoves.id, "Ignition", "ignition", AttributeType.SELECT, ["Manual", "Automatic"]);
  await createAttributeWithOptions(gasStoves.id, "Burner Material", "burner-material", AttributeType.SELECT, ["Brass", "Aluminium"]);
  await createAttributeWithOptions(gasStoves.id, "Gas Type", "gas-type", AttributeType.SELECT, ["LPG", "PNG"]);
  await createAttributeWithOptions(gasStoves.id, "Installation Type", "installation-type", AttributeType.SELECT, ["Countertop", "Built-in"]);

  // --- Kitchen Chimneys Starter Attributes ---
  await createAttributeWithOptions(kitchenChimneys.id, "Width", "width", AttributeType.SELECT, ["60 cm", "75 cm", "90 cm"], "cm");
  await createAttributeWithOptions(kitchenChimneys.id, "Suction Capacity", "suction-capacity", AttributeType.SELECT, ["1000 m³/hr", "1200 m³/hr", "1350 m³/hr", "1500 m³/hr"], "m³/hr");
  await createAttributeWithOptions(kitchenChimneys.id, "Filter Type", "filter-type", AttributeType.SELECT, ["Filterless", "Baffle Filter", "Cassette Filter", "Carbon Filter"]);
  await createAttributeWithOptions(kitchenChimneys.id, "Control Type", "control-type", AttributeType.SELECT, ["Touch Control", "Motion Sensor / Gesture", "Push Button"]);
  await createAttributeWithOptions(kitchenChimneys.id, "Auto Clean", "auto-clean", AttributeType.BOOLEAN, ["Yes", "No"]);
  await createAttributeWithOptions(kitchenChimneys.id, "Mount Type", "mount-type", AttributeType.SELECT, ["Wall Mounted", "Island", "Built-in"]);

  // --- Microwave Ovens Starter Attributes ---
  await createAttributeWithOptions(microwaveOvens.id, "Type", "microwave-type", AttributeType.SELECT, ["Solo", "Grill", "Convection"]);
  await createAttributeWithOptions(microwaveOvens.id, "Capacity", "microwave-capacity", AttributeType.SELECT, ["20L", "23L", "28L", "32L"], "Litres");
  await createAttributeWithOptions(microwaveOvens.id, "Power", "microwave-power", AttributeType.SELECT, ["800W", "900W", "1000W"], "Watts");
  await createAttributeWithOptions(microwaveOvens.id, "Control Type", "microwave-control-type", AttributeType.SELECT, ["Feather Touch", "Jog Dial", "Keypad"]);
  await createAttributeWithOptions(microwaveOvens.id, "Child Lock", "microwave-child-lock", AttributeType.BOOLEAN, ["Yes", "No"]);

  // --- Mixer Grinders Starter Attributes ---
  await createAttributeWithOptions(mixerGrinders.id, "Motor Power", "motor-power", AttributeType.SELECT, ["500W", "750W", "1000W", "1200W"], "Watts");
  await createAttributeWithOptions(mixerGrinders.id, "Number of Jars", "number-of-jars", AttributeType.SELECT, ["2 Jars", "3 Jars", "4 Jars", "5 Jars"]);
  await createAttributeWithOptions(mixerGrinders.id, "Jar Material", "jar-material", AttributeType.SELECT, ["Stainless Steel", "Polycarbonate", "Tritan"]);
  await createAttributeWithOptions(mixerGrinders.id, "Speed Settings", "speed-settings", AttributeType.SELECT, ["3 Speed", "4 Speed", "Variable Speed"]);
  await createAttributeWithOptions(mixerGrinders.id, "Pulse Function", "pulse-function", AttributeType.BOOLEAN, ["Yes", "No"]);

  // 6. Seed Sample Products, Attributes, Media, and Inventory
  console.log("📦 Creating realistic sample products with attributes, inventory, and media...");

  // Product 1: Prestige 3-Burner Stainless Steel Auto Gas Stove (Target for filter test: 3 Burner + Stainless Steel + Automatic)
  const p1 = await prisma.product.create({
    data: {
      name: "Prestige Royale Plus 3-Burner Auto Gas Stove",
      slug: "prestige-royale-plus-3-burner-auto-gas-stove",
      sku: "PRE-GS-3B-SS-AUTO",
      modelNumber: "PR-40281",
      description: "Durable stainless steel 3-burner gas stove with high efficiency tri-pin brass burners and seamless auto-ignition.",
      brandId: brandMap.get("prestige")!,
      categoryId: gasStoves.id,
      mrp: 8495.0,
      sellingPrice: 6499.0,
      privatePriceCode: "PR-6499-C88",
      warranty: "2 Years Comprehensive on Product, 5 Years on Brass Burners",
      isFeatured: true,
      isActive: true,
      inventory: {
        create: {
          quantity: 18,
          lowStockThreshold: 5,
        },
      },
      images: {
        create: [
          {
            url: "https://images.unsplash.com/photo-1588854337236-6889d631faa8?auto=format&fit=crop&w=800&q=80",
            altText: "Prestige 3-Burner Stainless Steel Gas Stove Front View",
            sortOrder: 1,
            isPrimary: true,
          },
        ],
      },
      videos: {
        create: [
          {
            videoType: VideoType.YOUTUBE,
            url: "dQw4w9WgXcQ",
            title: "Prestige Royale Plus Demonstration and Installation",
            sortOrder: 1,
          },
        ],
      },
    },
  });

  // Attach dynamic attributes to Product 1
  const p1Attrs = [
    { slug: "burner-count", value: "3", numeric: 3 },
    { slug: "cooktop-material", value: "Stainless Steel" },
    { slug: "ignition", value: "Automatic" },
    { slug: "burner-material", value: "Brass" },
    { slug: "gas-type", value: "LPG" },
    { slug: "installation-type", value: "Countertop" },
  ];
  for (const a of p1Attrs) {
    const meta = attrMap.get(a.slug);
    if (meta) {
      await prisma.productAttributeValue.create({
        data: {
          productId: p1.id,
          attributeId: meta.id,
          attributeValueId: meta.valueMap.get(a.value),
          value: a.value,
          numericValue: a.numeric,
        },
      });
    }
  }

  // Inventory movement audit log for Product 1
  await prisma.inventoryMovement.create({
    data: {
      productId: p1.id,
      quantity: 18,
      movementType: InventoryMovementType.PURCHASE,
      note: "Initial warehouse stocking from Prestige distributor",
      createdById: adminUser.id,
    },
  });

  // Product 2: Glen 4-Burner Glass Top Manual Gas Stove
  const p2 = await prisma.product.create({
    data: {
      name: "Glen 1043 GT 4-Burner Glass Top Gas Stove",
      slug: "glen-1043-gt-4-burner-glass-top-gas-stove",
      sku: "GLN-GS-4B-GL-MAN",
      modelNumber: "GL-1043-GT",
      description: "Sleek 8mm toughened glass 4-burner cooktop with forged brass burners and rich matte black finish.",
      brandId: brandMap.get("glen")!,
      categoryId: gasStoves.id,
      mrp: 11990.0,
      sellingPrice: 8990.0,
      privatePriceCode: "GL-8990-D12",
      warranty: "2 Years Product Warranty, 5 Years Glass Warranty",
      isFeatured: false,
      isActive: true,
      inventory: {
        create: {
          quantity: 10,
          lowStockThreshold: 4,
        },
      },
      images: {
        create: [
          {
            url: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=800&q=80",
            altText: "Glen 4-Burner Glass Top Gas Stove",
            sortOrder: 1,
            isPrimary: true,
          },
        ],
      },
    },
  });

  const p2Attrs = [
    { slug: "burner-count", value: "4", numeric: 4 },
    { slug: "cooktop-material", value: "Glass" },
    { slug: "ignition", value: "Manual" },
    { slug: "burner-material", value: "Brass" },
    { slug: "gas-type", value: "LPG" },
    { slug: "installation-type", value: "Countertop" },
  ];
  for (const a of p2Attrs) {
    const meta = attrMap.get(a.slug);
    if (meta) {
      await prisma.productAttributeValue.create({
        data: {
          productId: p2.id,
          attributeId: meta.id,
          attributeValueId: meta.valueMap.get(a.value),
          value: a.value,
          numericValue: a.numeric,
        },
      });
    }
  }

  await prisma.inventoryMovement.create({
    data: {
      productId: p2.id,
      quantity: 10,
      movementType: InventoryMovementType.PURCHASE,
      note: "Stock received from Glen regional depot",
      createdById: adminUser.id,
    },
  });

  // Product 3: Elica 3-Burner Glass Top Auto Gas Stove
  const p3 = await prisma.product.create({
    data: {
      name: "Elica Pro 3-Burner Toughened Glass Auto Gas Stove",
      slug: "elica-pro-3-burner-toughened-glass-auto-gas-stove",
      sku: "ELC-GS-3B-GL-AUTO",
      modelNumber: "EL-377-PRO",
      description: "Premium European aesthetic glass cooktop with 3 high power brass burners and integrated multi-spark battery ignition.",
      brandId: brandMap.get("elica")!,
      categoryId: gasStoves.id,
      mrp: 9990.0,
      sellingPrice: 7490.0,
      privatePriceCode: "EL-7490-E55",
      warranty: "2 Years Comprehensive",
      isFeatured: true,
      isActive: true,
      inventory: {
        create: {
          quantity: 12,
          lowStockThreshold: 3,
        },
      },
      images: {
        create: [
          {
            url: "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80",
            altText: "Elica Pro 3-Burner Glass Cooktop",
            sortOrder: 1,
            isPrimary: true,
          },
        ],
      },
    },
  });

  const p3Attrs = [
    { slug: "burner-count", value: "3", numeric: 3 },
    { slug: "cooktop-material", value: "Glass" },
    { slug: "ignition", value: "Automatic" },
    { slug: "burner-material", value: "Brass" },
    { slug: "gas-type", value: "LPG" },
    { slug: "installation-type", value: "Countertop" },
  ];
  for (const a of p3Attrs) {
    const meta = attrMap.get(a.slug);
    if (meta) {
      await prisma.productAttributeValue.create({
        data: {
          productId: p3.id,
          attributeId: meta.id,
          attributeValueId: meta.valueMap.get(a.value),
          value: a.value,
          numericValue: a.numeric,
        },
      });
    }
  }

  await prisma.inventoryMovement.create({
    data: {
      productId: p3.id,
      quantity: 12,
      movementType: InventoryMovementType.PURCHASE,
      note: "Direct delivery batch #401",
      createdById: adminUser.id,
    },
  });

  // Product 4: Faber 3-Burner Stainless Steel Built-in Auto Gas Hob
  const p4 = await prisma.product.create({
    data: {
      name: "Faber Hob Cooktop 3-Burner Stainless Steel Auto",
      slug: "faber-hob-cooktop-3-burner-stainless-steel-auto",
      sku: "FBR-HB-3B-SS-AUTO",
      modelNumber: "FB-HB-300SS",
      description: "Heavy duty stainless steel kitchen hob designed for built-in countertop flush fitment with automatic impulse ignition.",
      brandId: brandMap.get("faber")!,
      categoryId: gasStoves.id,
      mrp: 14990.0,
      sellingPrice: 11490.0,
      privatePriceCode: "FB-11490-A01",
      warranty: "2 Years Comprehensive + 5 Years on Valve & Burners",
      isFeatured: true,
      isActive: true,
      inventory: {
        create: {
          quantity: 6,
          lowStockThreshold: 2,
        },
      },
      images: {
        create: [
          {
            url: "https://images.unsplash.com/photo-1590725140246-201e14be2a7a?auto=format&fit=crop&w=800&q=80",
            altText: "Faber 3-Burner Built-in Stainless Steel Hob",
            sortOrder: 1,
            isPrimary: true,
          },
        ],
      },
    },
  });

  const p4Attrs = [
    { slug: "burner-count", value: "3", numeric: 3 },
    { slug: "cooktop-material", value: "Stainless Steel" },
    { slug: "ignition", value: "Automatic" },
    { slug: "burner-material", value: "Brass" },
    { slug: "gas-type", value: "LPG" },
    { slug: "installation-type", value: "Built-in" },
  ];
  for (const a of p4Attrs) {
    const meta = attrMap.get(a.slug);
    if (meta) {
      await prisma.productAttributeValue.create({
        data: {
          productId: p4.id,
          attributeId: meta.id,
          attributeValueId: meta.valueMap.get(a.value),
          value: a.value,
          numericValue: a.numeric,
        },
      });
    }
  }

  await prisma.inventoryMovement.create({
    data: {
      productId: p4.id,
      quantity: 6,
      movementType: InventoryMovementType.PURCHASE,
      note: "Initial stock of premium built-in hobs",
      createdById: adminUser.id,
    },
  });

  // Product 5: Faber 60cm Auto-Clean Kitchen Chimney
  const p5 = await prisma.product.create({
    data: {
      name: "Faber Primus Plus 60cm Auto-Clean Kitchen Chimney",
      slug: "faber-primus-plus-60cm-auto-clean-kitchen-chimney",
      sku: "FBR-CH-60-AC-1200",
      modelNumber: "PRIMUS-PLUS-BK-60",
      description: "Filterless curved glass kitchen chimney with thermal auto-clean technology and motion sensor gesture controls.",
      brandId: brandMap.get("faber")!,
      categoryId: kitchenChimneys.id,
      mrp: 24990.0,
      sellingPrice: 14990.0,
      privatePriceCode: "FB-14990-X99",
      warranty: "2 Years on Product, 12 Years on Motor",
      isFeatured: true,
      isActive: true,
      inventory: {
        create: {
          quantity: 14,
          lowStockThreshold: 4,
        },
      },
      images: {
        create: [
          {
            url: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80",
            altText: "Faber 60cm Auto Clean Chimney",
            sortOrder: 1,
            isPrimary: true,
          },
        ],
      },
    },
  });

  const p5Attrs = [
    { slug: "width", value: "60 cm" },
    { slug: "suction-capacity", value: "1200 m³/hr" },
    { slug: "filter-type", value: "Filterless" },
    { slug: "control-type", value: "Motion Sensor / Gesture" },
    { slug: "auto-clean", value: "Yes", bool: true },
    { slug: "mount-type", value: "Wall Mounted" },
  ];
  for (const a of p5Attrs) {
    const meta = attrMap.get(a.slug);
    if (meta) {
      await prisma.productAttributeValue.create({
        data: {
          productId: p5.id,
          attributeId: meta.id,
          attributeValueId: meta.valueMap.get(a.value),
          value: a.value,
          booleanValue: a.bool,
        },
      });
    }
  }

  await prisma.inventoryMovement.create({
    data: {
      productId: p5.id,
      quantity: 14,
      movementType: InventoryMovementType.PURCHASE,
      note: "Distributor shipment order #8840",
      createdById: adminUser.id,
    },
  });

  // Product 6: Philips 750W Mixer Grinder
  const p6 = await prisma.product.create({
    data: {
      name: "Philips HL7756/00 750W Mixer Grinder with 3 Jars",
      slug: "philips-hl7756-00-750w-mixer-grinder-3-jars",
      sku: "PHP-MG-750-3J",
      modelNumber: "HL7756/00",
      description: "Heavy duty 750W Turbo motor mixer grinder with advanced air ventilation system and leak-proof stainless steel jars.",
      brandId: brandMap.get("philips")!,
      categoryId: mixerGrinders.id,
      mrp: 5295.0,
      sellingPrice: 3899.0,
      privatePriceCode: "PH-3899-K34",
      warranty: "2 Years Product Warranty + 5 Years Motor Warranty",
      isFeatured: true,
      isActive: true,
      inventory: {
        create: {
          quantity: 25,
          lowStockThreshold: 5,
        },
      },
      images: {
        create: [
          {
            url: "https://images.unsplash.com/photo-1570222094114-d054a817e56b?auto=format&fit=crop&w=800&q=80",
            altText: "Philips 750W Mixer Grinder with 3 Jars",
            sortOrder: 1,
            isPrimary: true,
          },
        ],
      },
    },
  });

  const p6Attrs = [
    { slug: "motor-power", value: "750W" },
    { slug: "number-of-jars", value: "3 Jars" },
    { slug: "jar-material", value: "Stainless Steel" },
    { slug: "speed-settings", value: "3 Speed" },
    { slug: "pulse-function", value: "Yes", bool: true },
  ];
  for (const a of p6Attrs) {
    const meta = attrMap.get(a.slug);
    if (meta) {
      await prisma.productAttributeValue.create({
        data: {
          productId: p6.id,
          attributeId: meta.id,
          attributeValueId: meta.valueMap.get(a.value),
          value: a.value,
          booleanValue: a.bool,
        },
      });
    }
  }

  await prisma.inventoryMovement.create({
    data: {
      productId: p6.id,
      quantity: 25,
      movementType: InventoryMovementType.PURCHASE,
      note: "Opening stock purchase from Philips India",
      createdById: adminUser.id,
    },
  });

  console.log("✅ Database seeding completed successfully!");
  console.log(`📊 Seed Summary:`);
  console.log(`   - 1 Admin User (Super Admin)`);
  console.log(`   - 6 Development Brands`);
  console.log(`   - 28 Categories across 3 levels (Strictly 0 refrigeration categories)`);
  console.log(`   - 22 Dynamic Category Attributes with Predefined Values`);
  console.log(`   - 6 Sample Products (including 4 Gas Stoves with diverse combinations for filter testing)`);
  console.log(`   - 6 Active Inventories & 6 Audited Purchase Inventory Movements`);
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
