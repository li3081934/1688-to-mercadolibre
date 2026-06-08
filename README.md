# 1688 to Mercado Libre

当前仓库已经拆成两部分：

- 第一步：Chrome 扩展，在 1688 商品详情页采集商品并下载 ZIP 包。
- 第二步：Next.js 本地管理系统，按商品分类维护 Excel 模板和 mapper JS，并把 ZIP 内容导出成对应分类的 Excel。

## 目录

- `docs/List-06-05-06_21_03.xlsx`: 字段来源模板
- `docs/category-mapper.example.cjs`: 分类 mapper 示例
- `extension/`: Chrome 扩展源码
- `app/`: Next.js 管理系统页面与接口
- `lib/`: SQLite、ZIP 解析、Excel 导出等服务层
- `storage/`: 运行时数据库、上传 ZIP、解压目录、分类模板和 mapper 存储目录

## 第一步：采集 ZIP 包

- 仅在 `https://detail.1688.com/offer/*` 页面启用扩展按钮
- 点击弹窗按钮后，采集当前页面可获得的商品标题、图片、价格、描述、品牌、型号、库存、部分尺寸重量字段
- 下载的 ZIP 包含：
  - 主商品 JSON
  - 每个 SKU 单独的 JSON
  - 商品图片；若所有 SKU 共用同一套图片，则只下载一份共享图片，避免 ZIP 体积失控
- 生成的 JSON 包含：
  - `fields`: 内部标准键名，方便后续程序写入 Excel
  - `templateFields`: 保留列号、表头和字段值的数组，避免重复表头被覆盖
  - `skuPackages`: 每个 SKU 的导出数据，用于拆分下载和后续处理
  - `raw`: 页面原始图片和规格数据，方便后续补充规则
- 采集不到的字段先保留为空字符串

  ### 使用方式

1. 打开 Chrome，进入 `chrome://extensions`
2. 开启“开发者模式”
3. 选择“加载已解压的扩展程序”
4. 选择项目中的 `extension` 目录
5. 打开一个 1688 商品详情页，例如 `https://detail.1688.com/offer/...`
6. 点击扩展图标，选择“采集并下载 ZIP”

## 第二步：分类驱动导出管理系统

### 当前实现

- 商品分类管理
  - 维护分类名称、分类编码、Excel 模板、工作表名、mapper JS
  - 支持替换模板和 mapper
- 商品管理
  - 上传 ZIP 时必须选择分类
  - 系统会自动解压 ZIP，识别主 JSON 和 `skus/` 目录
  - 商品默认状态为“未上架”
  - 每个商品都有“导出 Excel”按钮
- 导出能力
  - 导出时读取商品绑定分类的模板和 mapper
  - 由 mapper 决定如何把 ZIP 中的 JSON 写入 Excel

### 启动方式

1. 安装依赖：`npm install`
2. 启动开发环境：`npm run dev`
3. 打开浏览器访问 `http://localhost:3000`
4. 先进入“商品分类管理”创建分类
5. 再进入“商品管理”上传 ZIP 并导出 Excel

### 分类 mapper 约定

- 分类 mapper 文件使用 CommonJS，示例见 `docs/category-mapper.example.cjs`
- 需要导出固定函数：`mapProductToWorkbook(context)`
- `context` 至少包含：
  - `workbook`
  - `category`
  - `product`
  - `mainProduct`
  - `skuProducts`
  - `extractedDir`
  - `sharedImagesDir`
  - `sharedImagePaths`
  - `helpers.getWorksheetOrThrow`
  - `helpers.findNextWritableRow`
  - `helpers.writeTemplateFieldsRow`
  - `helpers.writeTemplateFieldsRows`

## 兼容脚本

旧的 Node CLI 仍保留在 `scripts/json-to-xlsx.js`，可以继续作为单模板兼容工具使用。

### CLI 用法

1. 安装依赖：`npm install`
2. 执行默认写入：`npm run json-to-xlsx -- --json 931027992821.html-2026-06-08T08-00-34-638Z.json`
3. 输出文件默认生成到 `output/mercado-libre-filled.xlsx`

可选参数：

- `--json <path>`: 指定一个或多个 JSON 文件
- `--template <path>`: 指定 Excel 模板路径
- `--output <path>`: 指定输出 xlsx 路径
- `--sheet <name>`: 指定工作表名称，默认 `Screwdrivers`
- `--start-row <num>`: 指定起始写入行，默认 `6`

## 已知限制

- 1688 页面结构会随类目和店铺模板变化，当前使用的是通用选择器和规格表启发式提取
- 各国家价格、链接类型、BUYBOX 等字段暂时不会从 1688 自动推断
- 当前管理系统首版只支持“单商品导出单个 Excel”，还没有做批量导出
- 当前 mapper 运行在本地服务端，默认信任上传的 JS 文件，适合单机自用工作流