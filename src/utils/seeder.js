const ProductMapping = require("../models/product-mapping.model");

const defaultMappings = [
  {
    sku: "11423",
    description: "Spicy Veg Momos 24.0 Pieces",
    aliases: ["11423", "19022010", "spicy veg momos", "cheesy spicy veg momos 24.0 pieces", "cheesy spicy vegetable momos 24pcs"]
  },
  {
    sku: "11797",
    description: "Meatigo Hot Wings 250.0 g",
    aliases: ["11797", "02071400", "FG-M-F-1703", "meatigo hot wings", "meatigo hot wings 250.0 g", "meatigo rtc meatigo hot wings 250g"]
  },
  {
    sku: "18003",
    description: "Meatigo Chicken Curry Cut Skinless Frozen 450.0 g",
    aliases: ["18003", "02071300", "FG-M-F-0620", "meatigo chicken curry cut skinless frozen", "meatigo chicken curry cut skin less frozen 450 .0 g", "meatigo chicken curry cuts 450g (5%)"]
  },
  {
    sku: "18004",
    description: "Meatigo Chicken Boneless Breast Frozen 450.0 g",
    aliases: ["18004", "02071300", "FG-M-F-0619", "meatigo chicken boneless breast frozen", "meatigo chicken boneless breas t frozen 450.0 g", "meatigo chicken boneless breast 450g (5%)"]
  },
  {
    sku: "205950",
    description: "Pork Pepperoni Salami 100.0 g",
    aliases: ["205950", "16010000", "FG-P-F-0581", "pork pepperoni salami 100.0 g", "frozen pork pepperoni salami 100g"]
  },
  {
    sku: "253430",
    description: "Pork Plain Salami 200.0 g",
    aliases: ["253430", "16010000", "FG-P-F-0249", "pork sa lami 200.0 g", "pork plain salami 200g"]
  },
  {
    sku: "33387",
    description: "Frozen Chicken Chilli Salami 200.0 g",
    aliases: ["33387", "16010000", "FG-P-F-0234", "frozen chicken chilli salami 200.0 g", "frozen chicken chilli salami 200g"]
  },
  {
    sku: "33390",
    description: "Chicken Seekh Kebab 500.0 g",
    aliases: ["33390", "16010000", "FG-P-F-0413", "chicken seekh kebab 50 0.0 g", "frozen chicken seekh kabab 500g"]
  },
  {
    sku: "398656",
    description: "Meatigo Chicken Drumsticks 450.0 g",
    aliases: ["398656", "02071400", "FG-M-F-0602", "meatigo chicken drumsticks 450 .0 g", "meatigo chicken drumsticks 450g (5%)"]
  },
  {
    sku: "414867",
    description: "Chinese Veg Spring Rolls 240.0 g",
    aliases: ["414867", "20049000", "FG-P-F-0513", "chinese veg spring rol ls 240.0 g", "spring roll - chinese veg 240g"]
  },
  {
    sku: "432518",
    description: "Meatigo Chicken Kheema 450.0 g",
    aliases: ["432518", "02071400", "FG-P-F-1707", "meatigo chicken kheema 450.0 g", "meatigo chicken keema (mince) 450g (5%)"]
  },
  {
    sku: "4459",
    description: "Original Chicken Momos 24.0 Pieces",
    aliases: ["4459", "21069099", "FG-P-F-0505", "origina l chicken momos 24.0 pieces", "chicken momos 24.0 pieces", "chicken momos 24pcs"]
  },
  {
    sku: "4460",
    description: "Spicy Chicken Momos 24.0 Pieces",
    aliases: ["4460", "21069099", "FG-P-F-0512", "spicy c hicken momos 24 .0 pieces", "chicken momos 24.0 pieces", "spicy chicken momos 24pcs"]
  },
  {
    sku: "4461",
    description: "Veg & Paneer Momos 24.0 Pieces",
    aliases: ["4461", "21069099", "FG-P-F-0514", "veg & p aneer momos 24. 0 pieces", "paneer momos 24.0 pieces", "vegetable & paneer momos 24pcs"]
  },
  {
    sku: "453259",
    description: "Cheese & Onion Sausage 250.0 g",
    aliases: ["453259", "16010000", "FG-P-F-0335", "cheese & onion sausage 250.0 g", "chicken cheese & onion sausage"]
  },
  {
    sku: "4694",
    description: "Original Chicken Momos 10.0 Pieces",
    aliases: ["4694", "21069099", "FG-P-F-0504", "origina l chicken momos 10.0 pieces", "chicken momos 10.0 pieces", "chicken momos 10pcs"]
  },
  {
    sku: "4697",
    description: "Veg & Paneer Momos 10.0 Pieces",
    aliases: ["4697", "21069099", "FG-P-F-0513", "veg & p aneer momos 10. 0 pieces", "paneer momos 10.0 pieces", "vegetable & paneer momos 10pcs"]
  },
  {
    sku: "469735",
    description: "Meatigo Everyday Chicken Breast 150.0 g",
    aliases: ["469735", "16021000", "FG-M-F-1728", "meatigo everyda y chicken breas t (frozen) 150. 0 g", "meatigo everyday chicken breast (frozen) 150.0 g", "meatigo rtc everyday chicken breast 150g"]
  },
  {
    sku: "4699",
    description: "Pork Sausage 250.0 g",
    aliases: ["4699", "16010000", "FG-P-F-0323", "pork sa usage 250.0 g", "sausage 250.0 g", "frozen pork sausage 250g"]
  },
  {
    sku: "4700",
    description: "Pork Ham 200.0 g",
    aliases: ["4700", "16024900", "FG-P-F-0236", "pork ha m 200.0 g", "200.0 g", "frozen pork ham 200g"]
  },
  {
    sku: "4701",
    description: "Pork Breakfast Bacon 150.0 g",
    aliases: ["4701", "16024900", "FG-P-F-0580", "pork br eakfast bacon 3 00.0 g", "breakfast bacon 150.0 g", "frozen pork breakfast bacon 150g"]
  }
];

async function seedProductMappings() {
  try {
    const count = await ProductMapping.countDocuments();
    if (count === 0) {
      console.log("[Seeder] Seeding product mappings...");
      await ProductMapping.insertMany(defaultMappings);
      console.log("[Seeder] Successfully seeded product mappings.");
    }
  } catch (error) {
    console.error("[Seeder] Failed to seed product mappings:", error);
  }
}

module.exports = {
  seedProductMappings,
};
