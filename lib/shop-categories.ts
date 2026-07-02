export const CATEGORY_LABELS: Record<string, string> = {
  GROCERY:             "Grocery / General Store",
  SUPERMARKET:         "Supermarket",
  PHARMACY:            "Pharmacy / Medical",
  CLOTHING:            "Clothing",
  FASHION_ACCESSORIES: "Fashion & Accessories",
  MOBILE_PHONES:       "Mobile Phone Shop",
  ELECTRONICS:         "Electronics / Computers",
  SALON:               "Beauty Salon / Hair",
  FOOD_BEVERAGE:       "Food & Beverage / Cafe",
  HARDWARE:            "Hardware / Tools",
  STATIONERY:          "Stationery / Books",
  FURNITURE:           "Furniture / Home Decor",
  JEWELLERY:           "Jewellery",
  OTHER:               "Other",
};

export const SHOP_CATEGORIES = Object.entries(CATEGORY_LABELS).map(
  ([value, label]) => ({ value, label })
);
