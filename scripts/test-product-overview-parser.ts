import assert from "node:assert";
import {
  parseProductOverview,
  parseAccessoryLine,
  parseSpecificationLine,
} from "../src/lib/product-overview-parser";

console.log("=== Running Product Overview Parser Tests ===\n");

// Test 1: Standard Label: Value specifications
{
  const input = `Brand: INALSA
Product Name: Cooker Hood / Kitchen Chimney
Model Number: Feama 60BKMAC
Finish: Black Powder Coated
Colour: Black
Suction Capacity: 1250 m³/hr
Control Type: Touch Control
Warranty: 5 Years Lifetime Warranty
MRP: ₹32,500`;

  const parsed = parseProductOverview(input);
  assert.strictEqual(parsed.isStructured, true, "Should be structured");
  assert.strictEqual(parsed.specifications.length, 9, "Should have 9 specifications");
  assert.strictEqual(parsed.specifications[0].label, "Brand");
  assert.strictEqual(parsed.specifications[0].value, "INALSA");
  assert.strictEqual(parsed.specifications[2].label, "Model Number");
  assert.strictEqual(parsed.specifications[2].value, "Feama 60BKMAC");
  console.log("✓ Test 1 Passed: Standard Label: Value specifications");
}

// Test 2: Values containing additional colons
{
  const input = `Aspect Ratio: 16:9
Timer Settings: 10:00 AM to 08:30 PM
Official Portal: https://example.com/showroom/catalog
Nested Code: AB:CD:EF:12`;

  const parsed = parseProductOverview(input);
  assert.strictEqual(parsed.isStructured, true);
  assert.strictEqual(parsed.specifications.length, 4);
  assert.strictEqual(parsed.specifications[0].label, "Aspect Ratio");
  assert.strictEqual(parsed.specifications[0].value, "16:9");
  assert.strictEqual(parsed.specifications[1].label, "Timer Settings");
  assert.strictEqual(parsed.specifications[1].value, "10:00 AM to 08:30 PM");
  assert.strictEqual(parsed.specifications[2].label, "Official Portal");
  assert.strictEqual(parsed.specifications[2].value, "https://example.com/showroom/catalog");
  assert.strictEqual(parsed.specifications[3].label, "Nested Code");
  assert.strictEqual(parsed.specifications[3].value, "AB:CD:EF:12");
  console.log("✓ Test 2 Passed: Values containing additional colons preserved");
}

// Test 3: Included accessories with quantities
{
  const input = `Brand: Faber
Model: Hood Primus

Included Accessories:
- Main Hood – 1
- Baffle Filters – 2
- Wall Mounting Screws – 4
- Instruction Manual with Warranty Card – 1
- Heavy-Duty Aluminum Duct Pipe - 1 Pc
- Duct Clamps (2 nos)
- Additional Carbon Filter (Qty: 2)
- Exhaust Tape`;

  const parsed = parseProductOverview(input);
  assert.strictEqual(parsed.isStructured, true);
  assert.strictEqual(parsed.specifications.length, 2);
  assert.strictEqual(parsed.accessories.length, 8);

  assert.strictEqual(parsed.accessories[0].accessory, "Main Hood");
  assert.strictEqual(parsed.accessories[0].quantity, "1");

  assert.strictEqual(parsed.accessories[1].accessory, "Baffle Filters");
  assert.strictEqual(parsed.accessories[1].quantity, "2");

  assert.strictEqual(parsed.accessories[2].accessory, "Wall Mounting Screws");
  assert.strictEqual(parsed.accessories[2].quantity, "4");

  assert.strictEqual(parsed.accessories[3].accessory, "Instruction Manual with Warranty Card");
  assert.strictEqual(parsed.accessories[3].quantity, "1");

  assert.strictEqual(parsed.accessories[4].accessory, "Heavy-Duty Aluminum Duct Pipe");
  assert.strictEqual(parsed.accessories[4].quantity, "1 Pc");

  assert.strictEqual(parsed.accessories[5].accessory, "Duct Clamps");
  assert.strictEqual(parsed.accessories[5].quantity, "2 nos");

  assert.strictEqual(parsed.accessories[6].accessory, "Additional Carbon Filter");
  assert.strictEqual(parsed.accessories[6].quantity, "2");

  // No quantity specified: should NOT mistakenly split
  assert.strictEqual(parsed.accessories[7].accessory, "Exhaust Tape");
  assert.strictEqual(parsed.accessories[7].quantity, null);
  console.log("✓ Test 3 Passed: Included accessories with quantities parsed cleanly");
}

// Test 4: Key Features lists
{
  const input = `Brand: Elica
Model: Spot H4

Key Features:
- Filterless technology for hassle-free cooking
- Motion Sensor Gesture Control for hands-free speed adjustment
- 1350 m³/hr powerful suction capacity
- Dual LED energy-saving lamps
- Oil Collector Tray with easy-drain mechanism`;

  const parsed = parseProductOverview(input);
  assert.strictEqual(parsed.isStructured, true);
  assert.strictEqual(parsed.specifications.length, 2);
  assert.strictEqual(parsed.keyFeatures.length, 5);
  assert.strictEqual(
    parsed.keyFeatures[0],
    "Filterless technology for hassle-free cooking"
  );
  assert.strictEqual(
    parsed.keyFeatures[1],
    "Motion Sensor Gesture Control for hands-free speed adjustment"
  );
  console.log("✓ Test 4 Passed: Key Features list cleanly extracted without mixing into specs");
}

// Test 5: Unicode values (currency, exponents, dimensions, symbols)
{
  const input = `MRP: ₹32,500
Selling Price: ₹24,990
Suction Capacity: 1250 m³/hr
Dimensions (L × W × H): 67.5 × 43.5 × 56 cm
Noise Level: ≤ 58 dB
Motor Temperature Tolerance: 150 °C ± 5%
Airflow Rate: 20 m³/min`;

  const parsed = parseProductOverview(input);
  assert.strictEqual(parsed.isStructured, true);
  assert.strictEqual(parsed.specifications.length, 7);
  assert.strictEqual(parsed.specifications[0].value, "₹32,500");
  assert.strictEqual(parsed.specifications[1].value, "₹24,990");
  assert.strictEqual(parsed.specifications[2].value, "1250 m³/hr");
  assert.strictEqual(parsed.specifications[3].value, "67.5 × 43.5 × 56 cm");
  assert.strictEqual(parsed.specifications[4].value, "≤ 58 dB");
  assert.strictEqual(parsed.specifications[5].value, "150 °C ± 5%");
  assert.strictEqual(parsed.specifications[6].value, "20 m³/min");
  console.log("✓ Test 5 Passed: Unicode, currency symbols, and units preserved");
}

// Test 6: Blank lines, Windows newlines (\r\n), unknown labels, duplicate labels
{
  const input = "Brand: Kaff\r\n\r\n\r\nCustom Finish: Brushed Titanium\r\nUnique Motor Spec: BLDC Inverter\r\n\r\nWarranty: 2 Years Comprehensive\r\nWarranty: 10 Years on BLDC Motor\r\n";

  const parsed = parseProductOverview(input);
  assert.strictEqual(parsed.isStructured, true);
  assert.strictEqual(parsed.specifications.length, 5);

  assert.strictEqual(parsed.specifications[1].label, "Custom Finish");
  assert.strictEqual(parsed.specifications[1].value, "Brushed Titanium");

  assert.strictEqual(parsed.specifications[2].label, "Unique Motor Spec");
  assert.strictEqual(parsed.specifications[2].value, "BLDC Inverter");

  // Duplicate labels preserved without dropping
  assert.strictEqual(parsed.specifications[3].label, "Warranty");
  assert.strictEqual(parsed.specifications[3].value, "2 Years Comprehensive");
  assert.strictEqual(parsed.specifications[4].label, "Warranty");
  assert.strictEqual(parsed.specifications[4].value, "10 Years on BLDC Motor");
  console.log("✓ Test 6 Passed: Windows newlines, blank lines, unknown and duplicate labels handled");
}

// Test 7: Descriptions containing both structured and unstructured lines
{
  const input = `Upgrade your kitchen with our flagship Italian-designed cooker hood. Engineered for heavy Indian cooking with continuous high-volume extraction.

Brand: INALSA
Model Number: Feama 60BKMAC
Suction Capacity: 1250 m³/hr

Key Features:
- Gesture control motion sensors
- Heat auto-clean technology

Included Accessories:
- Main Hood – 1
- Duct Pipe – 1

Important Note: Installation charges are additional and payable directly to the technician upon site delivery.`;

  const parsed = parseProductOverview(input);
  assert.strictEqual(parsed.isStructured, true);
  assert.ok(parsed.introText?.includes("Upgrade your kitchen with our flagship Italian-designed cooker hood."));
  assert.strictEqual(parsed.specifications.length, 3);
  assert.strictEqual(parsed.keyFeatures.length, 2);
  assert.strictEqual(parsed.accessories.length, 2);
  assert.ok(parsed.trailingNotes?.includes("Important Note: Installation charges are additional"));
  console.log("✓ Test 7 Passed: Mixed structured and unstructured lines properly segregated");
}

// Test 8: Empty descriptions and legacy free-form descriptions
{
  // 8a: null / undefined / empty
  const empty1 = parseProductOverview(null);
  assert.strictEqual(empty1.isStructured, false);
  assert.strictEqual(empty1.specifications.length, 0);

  const empty2 = parseProductOverview("    ");
  assert.strictEqual(empty2.isStructured, false);
  assert.strictEqual(empty2.specifications.length, 0);

  // 8b: Legacy free-form paragraph with no colons or specs
  const legacy = `Elegant black toughened glass cooktop with high efficiency brass burners and spill-proof design. Features easy-to-clean surface and ergonomic knobs. Ideal for modern modular kitchens.`;

  const parsedLegacy = parseProductOverview(legacy);
  assert.strictEqual(parsedLegacy.isStructured, false);
  assert.strictEqual(parsedLegacy.specifications.length, 0);
  assert.strictEqual(parsedLegacy.keyFeatures.length, 0);
  assert.strictEqual(parsedLegacy.accessories.length, 0);
  assert.strictEqual(parsedLegacy.rawText, legacy);
  console.log("✓ Test 8 Passed: Empty and legacy free-form descriptions correctly identify as unstructured for fallback");
}

console.log("\nAll 8 Product Overview Parser tests passed successfully!\n");
