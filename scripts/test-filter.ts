import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const products = await prisma.product.findMany({
        where: {
            AND: [
                {
                    attributeValues: {
                        some: {
                            attribute: {
                                slug: "burner-count",
                            },
                            value: "3",
                        },
                    },
                },
                {
                    attributeValues: {
                        some: {
                            attribute: {
                                slug: "cooktop-material",
                            },
                            value: "Stainless Steel",
                        },
                    },
                },
                {
                    attributeValues: {
                        some: {
                            attribute: {
                                slug: "ignition",
                            },
                            value: "Automatic",
                        },
                    },
                },
            ],
        },

        select: {
            name: true,
            modelNumber: true,

            attributeValues: {
                select: {
                    value: true,
                    attribute: {
                        select: {
                            name: true,
                            slug: true,
                        },
                    },
                },
            },
        },
    });

    console.log("\nMatching products:");
    console.log(JSON.stringify(products, null, 2));
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });