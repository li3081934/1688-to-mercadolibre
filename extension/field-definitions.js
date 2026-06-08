const MERCADO_LIBRE_TEMPLATE_FIELDS = [
  { column: "A", key: "ml_catalog_code", label: "ML目录代码" },
  { column: "B", key: "title", label: "标题：告知商品、品牌、型号并突出其主要特性*t" },
  { column: "C", key: "title_character_count", label: "字符数" },
  { column: "D", key: "sku", label: "SKU" },
  { column: "E", key: "pictures", label: "照片*t" },
  { column: "F", key: "universal_product_code", label: "Universal product code*t" },
  { column: "G", key: "stock", label: "库存*t" },
  { column: "H", key: "price_mexico", label: "México" },
  { column: "I", key: "listing_type_mexico", label: "México" },
  { column: "J", key: "price_uruguay", label: "Uruguay" },
  { column: "K", key: "listing_type_uruguay", label: "Uruguay" },
  { column: "L", key: "net_income_mexico", label: "México" },
  { column: "M", key: "net_income_type_mexico", label: "México" },
  { column: "N", key: "price_chile", label: "Chile" },
  { column: "O", key: "listing_type_chile", label: "Chile" },
  { column: "P", key: "price_brasil", label: "Brasil" },
  { column: "Q", key: "listing_type_brasil", label: "Brasil" },
  { column: "R", key: "price_argentina", label: "Argentina" },
  { column: "S", key: "listing_type_argentina", label: "Argentina" },
  { column: "T", key: "price_colombia", label: "Colombia" },
  { column: "U", key: "listing_type_colombia", label: "Colombia" },
  { column: "V", key: "description", label: "Descriptiont" },
  { column: "W", key: "warranty_type", label: "Warranty type" },
  { column: "X", key: "warranty_time", label: "Warranty time" },
  { column: "Y", key: "warranty_time_unit", label: "Warranty time 个单位" },
  { column: "Z", key: "brand", label: "Brand*t" },
  { column: "AA", key: "tip_shape", label: "Tip shape*t" },
  { column: "AB", key: "model", label: "Model" },
  { column: "AC", key: "sale_format", label: "Sale format" },
  { column: "AD", key: "units_per_pack", label: "Units per pack" },
  { column: "AE", key: "units_per_package", label: "Units per package" },
  { column: "AF", key: "tip_size", label: "Tip size" },
  { column: "AG", key: "handle_grip_type", label: "Handle grip type" },
  { column: "AH", key: "handle_grip_material", label: "Handle grip material" },
  { column: "AI", key: "screwdriver_shank_length", label: "Screwdriver shank length" },
  { column: "AJ", key: "screwdriver_shank_length_unit", label: "Screwdriver shank length 个单位" },
  { column: "AK", key: "total_length", label: "Total length" },
  { column: "AL", key: "total_length_unit", label: "Total length 个单位" },
  { column: "AM", key: "magnetic_tip", label: "Magnetic tip" },
  { column: "AN", key: "interchangeable_tip", label: "Interchangeable tip" },
  { column: "AO", key: "interchangeable_tips_number", label: "Interchangeable tips number" },
  { column: "AP", key: "package_weight", label: "包裹毛重*t" },
  { column: "AQ", key: "package_weight_unit", label: "Package weight 个单位*t" },
  { column: "AR", key: "package_length", label: "Package length*t" },
  { column: "AS", key: "package_width", label: "Package width*t" },
  { column: "AT", key: "package_height", label: "Package height*t" },
  { column: "AU", key: "package_dimension_unit", label: "包裹长、宽、高的单位*t" },
  { column: "AV", key: "buybox_formula", label: "BUYBOX_FORMULA" },
  { column: "AW", key: "hidden_pictures", label: "HIDDEN_PICTURES" }
];

const MERCADO_LIBRE_FIELD_KEYS = MERCADO_LIBRE_TEMPLATE_FIELDS.map((field) => field.key);

function createEmptyFieldRecord() {
  return MERCADO_LIBRE_FIELD_KEYS.reduce((record, key) => {
    record[key] = "";
    return record;
  }, {});
}

function buildTemplateFieldEntries(record) {
  return MERCADO_LIBRE_TEMPLATE_FIELDS.map((field) => ({
    column: field.column,
    key: field.key,
    label: field.label,
    value: record[field.key] ?? ""
  }));
}