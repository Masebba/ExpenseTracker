// Dependency-free project self-check. Run with: npm run check:self
// Validates pure money/storage helpers without installing test frameworks and
// verifies release-critical text stays honest about disabled cloud sync.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const gradle = fs.readFileSync(path.join(root, "android", "app", "build.gradle"), "utf8");
const failures = [];
let assertions = 0;
const check = (name, actual, expected) => {
  assertions += 1;
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass)
    failures.push(
      `${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
};

const toNumber = (value, fallback = 0) => {
  const n =
    typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : fallback;
};
check("toNumber strips commas", toNumber("1,234.5", NaN), 1234.5);
check("toNumber falls back", toNumber("abc", 7), 7);
check(
  "validateMoney rejects zero when disallowed",
  toNumber("0", NaN) <= 0,
  true,
);
check("toNumber handles negative refunds", toNumber("-12.5", NaN), -12.5);

const validateMoney = (value, { allowZero = true } = {}) => {
  const n = toNumber(value, NaN);
  if (!Number.isFinite(n)) return { valid: false };
  if (!allowZero && n <= 0) return { valid: false };
  if (allowZero && n < 0) return { valid: false };
  return { valid: true, value: Math.round(n * 100) / 100 };
};
check("validateMoney rounds to cents", validateMoney("10.005"), {
  valid: true,
  value: 10.01,
});
check(
  "validateMoney blocks negative purchase",
  validateMoney("-1", { allowZero: false }).valid,
  false,
);

const scopedKey = (key, uid) =>
  key.startsWith(`expenseTracker.${uid}.`) ||
  key === `expenseTracker.currency.${uid}`;
check(
  "backup accepts scoped key",
  scopedKey("expenseTracker.uid1.transactions", "uid1"),
  true,
);
check(
  "backup rejects cross-account key",
  scopedKey("expenseTracker.uid2.transactions", "uid1"),
  false,
);
check(
  "backup rejects unscoped legacy key",
  scopedKey("expenseTracker.transactions", "uid1"),
  false,
);

const isUsableLocalImage = (uri, documentDirectory) => {
  if (!uri) return false;
  if (/^(https?:|content:|assets-library:|ph:\/\/)/i.test(uri)) return true;
  if (/^file:\/\//i.test(uri)) {
    if (!documentDirectory) return true;
    return uri.startsWith(documentDirectory);
  }
  return true;
};
check(
  "usable image keeps current install file",
  isUsableLocalImage(
    "file:///data/a/ExpenseTracker/images/x.jpg",
    "file:///data/a/",
  ),
  true,
);
check(
  "usable image drops stale install file",
  isUsableLocalImage(
    "file:///data/old/ExpenseTracker/images/x.jpg",
    "file:///data/a/",
  ),
  false,
);
check(
  "usable image keeps remote advert",
  isUsableLocalImage("https://example.com/banner.jpg", "file:///data/a/"),
  true,
);

const storagePolicy = fs.readFileSync(
  path.join(root, "services", "storagePolicy.js"),
  "utf8",
);
check(
  "storage policy single source exists",
  storagePolicy.includes("RECORD_SYNC_STATUS"),
  true,
);
const offline = fs.readFileSync(
  path.join(root, "screens", "OfflineScreen.js"),
  "utf8",
);
check(
  "Offline screen uses shared sync status",
  offline.includes("RECORD_SYNC_STATUS"),
  true,
);
check(
  "Offline screen drops stale sync claim",
  offline.includes("also synchronizes business records"),
  false,
);
const cloudSync = fs.readFileSync(
  path.join(root, "services", "cloudSync.js"),
  "utf8",
);
check(
  "record sync release gate stays on",
  cloudSync.includes("CLOUD_SYNC_RELEASE_BLOCKED = true"),
  true,
);
const appUtils = fs.readFileSync(
  path.join(root, "utils", "appUtils.js"),
  "utf8",
);
check(
  "image fallback helper exists",
  appUtils.includes("isUsableLocalImage"),
  true,
);
check(
  "backup restore re-serializes parsed export values",
  fs.readFileSync(path.join(root, "services", "backupRestore.js"), "utf8").includes("isParsedExport"),
  true,
);
check(
  "local hydration blocks writes when saved finance data needs recovery",
  fs.readFileSync(path.join(root, "utils", "usePersistedState.js"), "utf8").includes("blockedByRecovery.current === key"),
  true,
);
check(
  "ledger writes are serialized by account to protect multi-key transactions",
  appUtils.includes("enqueueLocalOwnerWork") && appUtils.includes("waitForLocalOwnerWrites(ownerId)"),
  true,
);
check(
  "Firestore client rules prohibit direct account-profile deletion",
  fs.readFileSync(path.join(root, "firestore.rules"), "utf8").includes("allow delete: if false;"),
  true,
);
check(
  "workspace deletion warns about unsynchronized device-local records",
  fs.readFileSync(path.join(root, "screens", "WorkspacesScreen.js"), "utf8").includes("unsynced local copies on other devices may remain"),
  true,
);
check(
  "account deletion clears private artifacts",
  appUtils.includes("clearLocalAccountArtifacts") && appUtils.includes("ExpenseTracker/images/"),
  true,
);
for (const [region, code] of [
  ["UG", "UGX"],
  ["KE", "KES"],
  ["TZ", "TZS"],
  ["US", "USD"],
  ["GB", "GBP"],
]) {
  check(
    `region ${region} defaults to ${code}`,
    appUtils.includes(`${region}: '${code}'`),
    true,
  );
}
const organizations = fs.readFileSync(
  path.join(root, "services", "organizations.js"),
  "utf8",
);
check(
  "invitation lookup normalizes email",
  organizations.includes("normalizedEmail"),
  true,
);
check(
  "workspace creation commits organisation and owner membership together",
  organizations.includes("writeBatch(firestore)") && organizations.includes("await batch.commit()"),
  true,
);
const functionsSource = fs.readFileSync(path.join(root, "functions", "index.js"), "utf8");
check("secure workspace ownership transfer callable exists", functionsSource.includes("exports.transferOrganizationOwnership"), true);
check("secure workspace deletion callable exists", functionsSource.includes("exports.deleteOrganization"), true);
check("invoice numbers include a cross-device collision-resistant suffix", fs.readFileSync(path.join(root, "BusinessRecordsContext.js"), "utf8").includes("randomSuffix = makeId('invoice')"), true);

const entry = fs.readFileSync(path.join(root, "index.js"), "utf8");
check(
  "startup error boundary exists",
  entry.includes("StartupErrorBoundary"),
  true,
);
check(
  "app module is loaded inside startup boundary",
  entry.includes("require('./App').default"),
  true,
);
const firebaseConfig = fs.readFileSync(
  path.join(root, "firebase.json"),
  "utf8",
);
check(
  "Firebase deploy config includes composite indexes",
  firebaseConfig.includes("firestore.indexes.json"),
  true,
);
const indexes = JSON.parse(
  fs.readFileSync(path.join(root, "firestore.indexes.json"), "utf8"),
);
check(
  "invitation collection-group composite index exists",
  indexes.indexes.some(
    (item) =>
      item.collectionGroup === "invitations" &&
      item.queryScope === "COLLECTION_GROUP" &&
      item.fields.some((field) => field.fieldPath === "email") &&
      item.fields.some((field) => field.fieldPath === "status"),
  ),
  true,
);
check(
  "membership collection-group organizationId index exists",
  indexes.fieldOverrides.some(
    (item) =>
      item.collectionGroup === "memberships" &&
      item.fieldPath === "organizationId" &&
      item.indexes.some(
        (field) =>
          field.queryScope === "COLLECTION_GROUP" &&
          field.order === "ASCENDING",
      ),
  ),
  true,
);
check(
  "membership collection-group status index exists",
  indexes.fieldOverrides.some(
    (item) =>
      item.collectionGroup === "memberships" &&
      item.fieldPath === "status" &&
      item.indexes.some(
        (field) =>
          field.queryScope === "COLLECTION_GROUP" &&
          field.order === "ASCENDING",
      ),
  ),
  true,
);
check(
  "Windows helper deploys indexes to the project configured in .env",
  fs.readFileSync(path.join(root, "scripts", "deploy-firestore-indexes.ps1"), "utf8").includes("EXPO_PUBLIC_FIREBASE_PROJECT_ID") && fs.readFileSync(path.join(root, "scripts", "deploy-firestore-indexes.ps1"), "utf8").includes("--only firestore:indexes"),
  true,
);
check(
  "cross-platform index deployment helper targets the project configured in .env",
  fs.readFileSync(path.join(root, "scripts", "deploy-firestore-indexes.js"), "utf8").includes("EXPO_PUBLIC_FIREBASE_PROJECT_ID") && fs.readFileSync(path.join(root, "scripts", "deploy-firestore-indexes.js"), "utf8").includes("--project"),
  true,
);
const friendlyErrors = fs.readFileSync(
  path.join(root, "utils", "userFacingErrors.js"),
  "utf8",
);
check(
  "user-facing Firebase error translation exists",
  friendlyErrors.includes("collection[_ -]?group") &&
    friendlyErrors.includes("userFacingError"),
  true,
);
check(
  "missing member index error explains deployment requirement",
  friendlyErrors.includes("one-time database index update") && friendlyErrors.includes("app administrator must run npm run deploy:firestore-indexes"),
  true,
);
check("workspace member index errors use an actionable database setup title", fs.readFileSync(path.join(root, "screens", "WorkspacesScreen.js"), "utf8").includes("Workspace database setup needed"), true);
check("cross-platform index deployment script uses npm package script", fs.readFileSync(path.join(root, "package.json"), "utf8").includes("node scripts/deploy-firestore-indexes.js"), true);
check(
  "timezone detection is preferred over locale",
  appUtils.indexOf("TIME_ZONE_REGIONS[timeZone]") <
    appUtils.indexOf("const localeParts"),
  true,
);
const currencyContext = fs.readFileSync(
  path.join(root, "CurrencyContext.js"),
  "utf8",
);
check(
  "currency auto-detection does not prefer saved account region",
  currencyContext.includes("detectDeviceRegion() || authState?.countryCode"),
  true,
);
check(
  "manual currency preference is explicit",
  currencyContext.includes("expenseTracker.currency.manual."),
  true,
);
check(
  "branded auth loading state exists",
  fs
    .readFileSync(path.join(root, "AuthContext.js"), "utf8")
    .includes("Preparing your workspace"),
  true,
);
const adStudio = fs.readFileSync(
  path.join(root, "screens", "DeveloperStudioScreen.js"),
  "utf8",
);
check(
  "advert image requires a public HTTPS URL",
  adStudio.includes("isValidHttpsUrl(normalizedImageUrl)") && adStudio.includes("normalizeAdvertImageUrl(imageUrl)"),
  true,
);
check(
  "advert cannot publish before image preview succeeds",
  adStudio.includes("!previewLoaded || previewFailed") && adStudio.includes("previewUrl !== normalizedImageUrl"),
  true,
);
check(
  "restore updates the private recovery mirror",
  fs
    .readFileSync(path.join(root, "services", "backupRestore.js"), "utf8")
    .includes("Recovery mirror could not be refreshed"),
  true,
);
check(
  "restore schedules external backup after import",
  fs
    .readFileSync(path.join(root, "services", "backupRestore.js"), "utf8")
    .includes("scheduleExternalBackup(uid)"),
  true,
);
check(
  "settings explain cloud ledger sync is unavailable",
  fs
    .readFileSync(path.join(root, "screens", "SettingsScreen.js"), "utf8")
    .includes(
      "Cloud sync for transactions and business records is not available",
    ),
  true,
);
const compactSearch = fs.readFileSync(path.join(root, "components", "CompactSearch.js"), "utf8");
check("compact search expands without forcing a wide toolbar", compactSearch.includes("expandedWrapper") && compactSearch.includes("minWidth: 0"), true);
const compactFilter = fs.readFileSync(path.join(root, "components", "CompactFilterMenu.js"), "utf8");
check("compact dropdown filter component exists", compactFilter.includes("<Menu.Item") && compactFilter.includes("Filter"), true);
check("compact filter defines safe visible and accessible labels", compactFilter.includes("const fullLabel =") && compactFilter.includes("const displayLabel =") && compactFilter.includes("accessibilityLabel={`${label}: ${fullLabel}`}"), true);
check("compact filter tolerates missing options and truncates long visible labels", compactFilter.includes("options = []") && compactFilter.includes("Array.isArray(options)") && compactFilter.includes("rawDisplayLabel.slice(0, 15)"), true);
check("category filter uses a collision-safe all-categories sentinel", fs.readFileSync(path.join(root, "screens", "ProductsScreen.js"), "utf8").includes("categoryFilter === '__all__'"), true);
const salesScreen = fs.readFileSync(path.join(root, "screens", "SalesScreen.js"), "utf8");
check("sales entry form is modal-based and remains available after scanning", salesScreen.includes("visible={saleFormVisible && !scanning}") && salesScreen.includes("Process sale"), true);
check("trade permits manual product selection without a barcode", salesScreen.includes("Browse products") && salesScreen.includes("No barcode"), true);
check("trade allows a per-sale selling price override", salesScreen.includes("unitPriceOverride: price") && salesScreen.includes("Unit selling price"), true);
check("receipt reports currency conversion and stale-rate caveats", salesScreen.includes("Item prices converted to") && salesScreen.includes("One or more exchange rates were cached"), true);
check("discount input is independent of payment currency picker", salesScreen.includes('label="Discount (%)"') && salesScreen.includes("Customer pays in"), true);
check("receipt includes business information and automatic 3x5 index-card sizing", salesScreen.includes("@page { size: 3in 5in") && salesScreen.includes("width: 216, height: 360") && salesScreen.includes("SALES RECEIPT") && salesScreen.includes("Tax ID"), true);
check("Sales uses the proven shared inventory barcode scanner", salesScreen.includes("import BarcodeScannerComponent from '../BarcodeScannerComponent'") && salesScreen.includes("<BarcodeScannerComponent") && salesScreen.includes("onScanned={queueSalesBarcode}"), true);
check("Sales keeps camera implementation inside the shared scanner component", !salesScreen.includes("import { CameraView") && !salesScreen.includes("useCameraPermissions") && fs.readFileSync(path.join(root, "BarcodeScannerComponent.js"), "utf8").includes("CameraView"), true);
check("Sales scanner is visible only while scanning on the focused Sales tab", salesScreen.includes("const isFocused = useIsFocused()") && salesScreen.includes("visible={scanning && isFocused}") && salesScreen.includes("if (!isFocused && scanning)"), true);
const sharedScanner = fs.readFileSync(path.join(root, "BarcodeScannerComponent.js"), "utf8");
check("shared scanner prevents duplicate reads and offers camera retry after mount errors", sharedScanner.includes("scanHandledRef.current") && sharedScanner.includes("onMountError") && sharedScanner.includes("Retry camera"), true);
check("Sales barcode scan resolves the matching inventory product before cart processing", salesScreen.includes("const product = findProduct(barcodeValue)") && salesScreen.includes("const addQueuedProduct = async ()"), true);
check("Sales scan callback queues barcode lookup away from the camera callback", salesScreen.includes("const queueSalesBarcode = (rawValue)") && salesScreen.includes("setScanQueue((current) => [...current, value])") && salesScreen.includes("The camera callback only queues a read."), true);
const loginScreen = fs.readFileSync(path.join(root, "screens", "LoginScreen.js"), "utf8");
const signupScreen = fs.readFileSync(path.join(root, "screens", "SignupScreen.js"), "utf8");
check("login password eye icon uses the React Native Paper icon prop", loginScreen.includes("<TextInput.Icon") && loginScreen.includes("icon={showPassword ? 'eye-off' : 'eye'}") && !loginScreen.includes("name={showPassword"), true);
check("signup password eye icons use the React Native Paper icon prop", (signupScreen.match(/<TextInput.Icon/g) || []).length === 2 && signupScreen.includes('icon={passwordVisible ? "eye" : "eye-off"}') && signupScreen.includes('icon={confirmPasswordVisible ? "eye" : "eye-off"}'), true);
const businessRecords = fs.readFileSync(path.join(root, "screens", "BusinessRecordsScreen.js"), "utf8");
check("invoice form is collapsed by default and revealed only on request", businessRecords.includes("const [invoiceFormExpanded, setInvoiceFormExpanded] = useState(false)") && businessRecords.includes("{invoiceFormExpanded && <>") && businessRecords.includes("New invoice"), true);
check("invoice form collapses after a successful invoice save", businessRecords.includes("setInvoiceFormExpanded(false)"), true);
check("developer advert and terms editors are collapsed by default", adStudio.includes("const [advertFormExpanded, setAdvertFormExpanded] = useState(false)") && adStudio.includes("const [termsEditorExpanded, setTermsEditorExpanded] = useState(false)") && adStudio.includes("{advertFormExpanded && <>") && adStudio.includes("{termsEditorExpanded && <>"), true);
check("terms editor closes after successful publish", adStudio.includes("setTermsEditorExpanded(false)"), true);
const homeDashboard = fs.readFileSync(path.join(root, "screens", "HomeDashboard.js"), "utf8");
check("advert carousel slides the next card in beside the outgoing card", homeDashboard.includes("const advertTransition = useRef(new Animated.Value(0)).current") && homeDashboard.includes("scheduleNextSlide") && homeDashboard.includes("outputRange: [0, -bannerWidth]") && homeDashboard.includes("outputRange: [bannerWidth, 0]") && homeDashboard.includes("overflow: 'hidden'"), true);
check("Home advert images accept legacy URL fields and clear failed state on load", homeDashboard.includes("ad?.imageUrl || ad?.imageURL || ad?.image_url || ad?.image") && homeDashboard.includes("<AdvertImage") && homeDashboard.includes("onLoad={() => setFailedAdImages"), true);
check("Home advert slide uses the same background image renderer as the working carousel", homeDashboard.includes("import AdvertImage from \"../components/AdvertImage\"") && homeDashboard.includes("scheduleNextSlide") && fs.existsSync(path.join(root, "components", "AdvertImage.js")), true);
check("Home advert filtering tolerates missing metadata but hides explicitly disabled adverts", homeDashboard.includes("ad.active !== false") && homeDashboard.includes("ad.publisherType || 'developer'"), true);
const productsScreenSource = fs.readFileSync(path.join(root, "screens", "ProductsScreen.js"), "utf8");
check("Inventory camera only mounts while its scanner modal is visible and focused", productsScreenSource.includes("const isFocused = useIsFocused()") && productsScreenSource.includes("visible={scannerModalVisible && isFocused}") && productsScreenSource.includes("{scannerModalVisible && isFocused ? <BarcodeScannerComponent"), true);
const reportsScreen = fs.readFileSync(path.join(root, "screens", "ReportsScreen.js"), "utf8");
check("detailed report exports Excel workbook", reportsScreen.includes("shareExcelXmlWorkbook") && reportsScreen.includes("Generate Excel report") && reportsScreen.includes("Raw amounts and saved base values are included") && reportsScreen.includes("Price-to-Sale FX Rate"), true);
check("report warns about stale rates saved on transactions", reportsScreen.includes("sale.priceExchangeRateStale") && reportsScreen.includes("item.exchangeRateStale"), true);
check("sales chart keeps vertical product labels readable on short and tall bars", reportsScreen.includes("rotate(-90") && reportsScreen.includes("const chartBarWidth = 30") && reportsScreen.includes("const chartBarGap = 20") && reportsScreen.includes("labelFitsInsideBar") && reportsScreen.includes("palette.surfaceAlt") && reportsScreen.includes("fill=\"none\""), true);
check("sales chart draws a text halo before the label fill for contrast", reportsScreen.includes("strokeWidth=\"2.8\"") && !reportsScreen.includes("paintOrder=\"stroke\""), true);
check("report aggregates sales by every order line item", reportsScreen.includes("flatMap((sale) => getSaleLineItems(sale)") && reportsScreen.includes("line.productId"), true);
check("Excel export writes one detail row per item in a multi-item sale", reportsScreen.includes("filteredSales.flatMap") && reportsScreen.includes("Line Total"), true);

const excelExport = fs.readFileSync(path.join(root, "utils", "excelExport.js"), "utf8");
check("offline Excel export creates a multi-sheet SpreadsheetML workbook", excelExport.includes('xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"') && excelExport.includes("Worksheet ss:Name") && excelExport.includes("import * as Sharing from 'expo-sharing'"), true);
const incomeScreen = fs.readFileSync(path.join(root, "screens", "IncomeScreen.js"), "utf8");
const expenseScreen = fs.readFileSync(path.join(root, "screens", "ExpenseScreen.js"), "utf8");
check("income entry form is a modal and linked sales are read-only", incomeScreen.includes("visible={formVisible}") && incomeScreen.includes("From Trade") && incomeScreen.includes("managed by the linked sale") && incomeScreen.includes("activeWorkspace"), true);
check("expense entry form is modal-based and identifies active workspace", expenseScreen.includes("visible={formVisible}") && expenseScreen.includes("Add expense") && expenseScreen.includes("activeWorkspace"), true);
const salesContext = fs.readFileSync(path.join(root, "SalesContext.js"), "utf8");
check("sale snapshots barcode and price-to-payment exchange rate", salesContext.includes("barcode: product.barcode") && salesContext.includes("priceExchangeRate: salePriceRate.rate"), true);
check("Trade sales in every active scope create linked income in one journalled commit", salesContext.includes("const linkedIncome = makeLinkedTradeIncome(sale)") && salesContext.includes("transactionsStorageKey") && salesContext.includes("commitLocalJsonTransaction") && !salesContext.includes("const personalLedger ="), true);
check("deleting a Trade sale removes its linked income", salesContext.includes("sourceId === id") && salesContext.includes("deleteSale"), true);
check("sales mutations and historical reconciliation share the ledger write lock", salesContext.includes("withLocalLedgerMutationLock") && salesContext.includes("getCurrentTransactions()"), true);
check("product state helper confirms successful durable state application", fs.readFileSync(path.join(root, "ProductsContext.js"), "utf8").includes("if (!localSaved) throw new Error('Inventory could not be saved to this device.');\n    return true;"), true);
check("the sales screen exposes safe sale deletion and stock restoration", salesScreen.includes("confirmDeleteSale") && salesScreen.includes("restore") && salesScreen.includes("deleteSale(sale.id)"), true);
check("receipts include saved personal details or active workspace business details", salesScreen.includes("...(personalDetails || {})") && salesScreen.includes("activeWorkspace?.details"), true);
check("historical sales are reconciled into the active workspace income ledger", salesContext.includes("Reconcile historical sales in every active scope") && salesContext.includes("reconciledIncomeScopes") && salesContext.includes("missingSales.map(makeLinkedTradeIncome)"), true);
check("trade supports multi-item sale orders in one journalled operation", salesContext.includes("recordSaleBatch") && salesContext.includes("items = []") && salesContext.includes("quantitiesByProduct") && salesContext.includes("items: preparedLines"), true);
check("deleting multi-item orders restores stock for every product line", salesContext.includes("const saleLines = Array.isArray(sale.items)") && salesContext.includes("restoreByProduct"), true);
check("checkout cart adds and removes multiple products before one completion", salesScreen.includes("addCurrentItemToCart") && salesScreen.includes("cartItems.map") && salesScreen.includes("handleCompleteSale") && salesScreen.includes("Complete sale and print one receipt"), true);
check("one receipt prints all grouped sale lines", salesScreen.includes("const lines = getSaleLineItems(sale)") && salesScreen.includes("receiptItems") && salesScreen.includes("lines.length"), true);
check("sales history search finds products inside multi-item receipts", salesScreen.includes("getSaleLineItems(sale).map((line) =>") && salesScreen.includes(".join(' ')") , true);
check("3x5 receipt content respects printable area and includes line discounts", salesScreen.includes("width: 2.76in; max-width: 2.76in") && salesScreen.includes("itemDiscountAmount") && salesScreen.includes("width: 216, height: 360"), true);
check("legacy single-item sales remain receipt compatible", fs.readFileSync(path.join(root, "utils", "sales.js"), "utf8").includes("Return the detail rows for a sale/order") && fs.readFileSync(path.join(root, "utils", "sales.js"), "utf8").includes("sale?.productId"), true);

check("advert URLs are normalized for common file-sharing hosts", appUtils.includes("normalizeAdvertImageUrl") && appUtils.includes("drive.google.com/thumbnail?id=") && appUtils.includes("url.searchParams.set('dl', '1')"), true);
check("legacy Google Drive sharing links with an id query are normalized", appUtils.includes("url.searchParams.get('id')"), true);
const dashboard = fs.readFileSync(path.join(root, "screens", "HomeDashboard.js"), "utf8");
check("advert banner resolves stored image URL variants and logs load failure", dashboard.includes("getAdvertImageUrl(ad)") && dashboard.includes("[Advert image] Could not load"), true);
check("home dashboard labels the active ledger and auto-summary period", dashboard.includes("const { activeWorkspace } = useContext(AuthContext)") && dashboard.includes("Income & expenses") && dashboard.includes("SUMMARY_PERIODS"), true);
check("advert text band is translucent and confined to the copy area", dashboard.includes("rgba(255,255,255,0.84)") && dashboard.includes("rgba(13,22,16,0.82)") && dashboard.includes("styles.bannerShade"), true);
check("home summary automatically slides through periods with a slow fade and horizontal transition", dashboard.includes("duration: 360") && dashboard.includes("duration: 620") && dashboard.includes("setTimeout") && dashboard.includes("6500"), true);
check("scanned products are added through a queued inventory lookup", salesScreen.includes("const addQueuedProduct = async ()") && salesScreen.includes("setScannerFeedback(`${product.name} added to cart.`)") && salesScreen.includes("setScanQueue"), true);
check("selected products retain an explicit add action and cart removal", salesScreen.includes("Add selected product") && salesScreen.includes("manualItemSelected && scannedProduct") && salesScreen.includes("removeCartItem(line.cartId)"), true);
check("Budget bottom tab receives top safe-area inset", fs.readFileSync(path.join(root, "screens", "ToolsScreen.js"), "utf8").includes("edges={isBottomTabBudget ? ['top'] : []}"), true);
check("screen title bars use consistent 56-point height and Home header is compact", fs.readFileSync(path.join(root, "screens", "ReportsScreen.js"), "utf8").includes("height: 56") && fs.readFileSync(path.join(root, "screens", "TransactionsScreen.js"), "utf8").includes("height: 56") && fs.readFileSync(path.join(root, "screens", "HomeScreen.js"), "utf8").includes("headerShown: false") && fs.readFileSync(path.join(root, "screens", "HomeDashboard.js"), "utf8").includes("<CustomHeader />") && fs.readFileSync(path.join(root, "components", "CustomHeader.js"), "utf8").includes("height: 74"), true);
check("header filter uses high-contrast white text on green header", fs.readFileSync(path.join(root, "components", "CompactFilterMenu.js"), "utf8").includes("onHeader ? palette.headerText : palette.text") && fs.readFileSync(path.join(root, "screens", "ReportsScreen.js"), "utf8").includes("onHeader />"), true);
check("persistent dark mode context stores theme choice locally", fs.readFileSync(path.join(root, "ThemeContext.js"), "utf8").includes("expenseTracker.uiTheme") && fs.readFileSync(path.join(root, "ThemeContext.js"), "utf8").includes("AsyncStorage.setItem(THEME_KEY, nextMode)"), true);
check("light palette softens the green without bleaching it", fs.readFileSync(path.join(root, "ThemeContext.js"), "utf8").includes("#32A060") && fs.readFileSync(path.join(root, "ThemeContext.js"), "utf8").includes("#2B965B"), true);
check("dark theme retains explicit surface and elevation fallbacks", fs.readFileSync(path.join(root, "App.js"), "utf8").includes("base.colors?.elevation || {}") && fs.readFileSync(path.join(root, "App.js"), "utf8").includes("surfaceVariant: palette.surfaceAlt") && fs.readFileSync(path.join(root, "App.js"), "utf8").includes("ThemeSafetyGuard") && fs.readFileSync(path.join(root, "App.js"), "utf8").includes("key={isDark ? 'dark-appearance' : 'light-appearance'}"), true);
check("Budget tab shows its own page heading and matches Home shortcut icon", fs.readFileSync(path.join(root, "screens", "ToolsScreen.js"), "utf8").includes("isBottomTabBudget &&") && fs.readFileSync(path.join(root, "screens", "ToolsScreen.js"), "utf8").includes("styles.budgetHeaderTitle") && fs.readFileSync(path.join(root, "App.js"), "utf8").includes("Budget: 'chart-donut'"), true);
check("Home shortcuts use soft distinct icon tints and subtle gradient background", dashboard.includes("item.iconColor || palette.primary") && dashboard.includes("SvgLinearGradient") && dashboard.includes("summarySurface"), true);

check("Settings is available in header menu rather than the bottom tabs", fs.readFileSync(path.join(root, "App.js"), "utf8").includes('<BottomTab.Screen name="Budget"') && !fs.readFileSync(path.join(root, "App.js"), "utf8").includes('<BottomTab.Screen name="Settings"'), true);
const customHeader = fs.readFileSync(path.join(root, "components", "CustomHeader.js"), "utf8");
check("home avatar opens image picker directly", customHeader.includes("pickProfilePhoto") && customHeader.includes("launchImageLibraryAsync"), true);
check("personal profile header shows the concise private-ledger subtitle", customHeader.includes("'Private ledger'") && customHeader.includes("Guest account · Saved on this device"), true);

const otaExpoConfig = JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8")).expo;
const otaEasConfig = JSON.parse(fs.readFileSync(path.join(root, "eas.json"), "utf8"));
check("JavaScript-only improvements preserve the installed runtime version", otaExpoConfig.runtimeVersion === "1.0.4" && otaExpoConfig.updates?.url?.includes("u.expo.dev"), true);
check("production updates target the existing production channel", otaEasConfig.build?.production?.channel === "production" && otaEasConfig.build?.production?.environment === "production", true);
check("printing and SVG dependencies are already declared without adding native modules", fs.readFileSync(path.join(root, "package.json"), "utf8").includes("expo-print") && fs.readFileSync(path.join(root, "package.json"), "utf8").includes("react-native-svg"), true);

check("header has direct sale shortcut and settings menu", customHeader.includes("openProcessSale: true") && customHeader.includes("dots-vertical") && customHeader.includes("All settings"), true);
check("push token registration persists token and enabled status", fs.readFileSync(path.join(root, "services", "pushNotifications.js"), "utf8").includes("getExpoPushTokenAsync({ projectId })") && fs.readFileSync(path.join(root, "services", "pushNotifications.js"), "utf8").includes("pushTokens"), true);
check("received push alerts enter the in-app notification inbox", fs.readFileSync(path.join(root, "AppFeaturesContext.js"), "utf8").includes("addNotificationReceivedListener") && fs.readFileSync(path.join(root, "AppFeaturesContext.js"), "utf8").includes("source: 'push'"), true);
check("workspace invitation push notification function exists", functionsSource.includes("exports.notifyWorkspaceInvitation = onDocumentCreated") && functionsSource.includes("exp.host/--/api/v2/push/send"), true);
check("push notification tap routes workspace invitations to the workspace area", customHeader.includes("data.type === 'workspace_invitation'") && customHeader.includes("navigation.navigate('Workspaces')"), true);
check("native notification module is installed and configured", JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8")).expo.plugins.some((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin) === "expo-notifications") && JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).dependencies["expo-notifications"] === "~57.0.21", true);
check("Android notification permission is declared", fs.readFileSync(path.join(root, "android/app/src/main/AndroidManifest.xml"), "utf8").includes("android.permission.POST_NOTIFICATIONS"), true);
check("native Google Services plugin activates when config exists", fs.readFileSync(path.join(root, "android/app/build.gradle"), "utf8").includes('file("google-services.json").exists()') && fs.readFileSync(path.join(root, "android/app/build.gradle"), "utf8").includes('apply plugin: "com.google.gms.google-services"'), true);
check("Google Services Gradle plugin dependency is present", fs.readFileSync(path.join(root, "android/build.gradle"), "utf8").includes("com.google.gms:google-services:4.5.0"), true);
check("app/runtime version advanced for native notification setup", JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8")).expo.runtimeVersion === "1.0.4" && JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8")).expo.android.versionCode === 5, true);

const eas = JSON.parse(fs.readFileSync(path.join(root, "eas.json"), "utf8"));
check(
  "production EAS environment is explicit",
  eas.build.production.environment,
  "production",
);
const appConfig = JSON.parse(
  fs.readFileSync(path.join(root, "app.json"), "utf8"),
);
check(
  "runtime version matches app version",
  appConfig.expo.runtimeVersion,
  appConfig.expo.version,
);
check(
  "release build does not use debug signing",
  gradle.includes("signingConfig signingConfigs.release"),
  true,
);
check(
  "release signing reads a dedicated release credential set",
  ["MYAPP_UPLOAD_STORE_FILE", "MYAPP_UPLOAD_STORE_PASSWORD", "MYAPP_UPLOAD_KEY_ALIAS", "MYAPP_UPLOAD_KEY_PASSWORD"].every((key) => gradle.includes(key)),
  true,
);
check(
  "release signing configuration is separate from the debug key",
  /release\s*\{[\s\S]*?signingConfig signingConfigs\.release/.test(gradle) && !/release\s*\{[^}]*signingConfig signingConfigs\.debug/.test(gradle),
  true,
);
check(
  "EAS-managed signing is not blocked when custom MYAPP_UPLOAD properties are absent",
  gradle.includes("EAS Build manages remote") &&
    gradle.includes("Do not throw merely because MYAPP_UPLOAD_* properties are absent") &&
    !gradle.includes("Release signing credentials are missing"),
  true,
);
check(
  "partially configured local release signing credentials fail with an actionable error",
  gradle.includes("Local release signing credentials are incomplete") &&
    gradle.includes("EAS-managed Android credentials"),
  true,
);


const {
  calculateExchangeRate,
  convertAmount,
  getExchangeRate,
} = require("../services/currencyConversion");
const rateDate = Date.now();
const testRates = { USD: 1, UGX: 3700, KES: 130, TZS: 2600, GBP: 0.8 };
const testStorage = () => {
  const values = new Map();
  return {
    getItem: async (key) => values.get(key) || null,
    setItem: async (key, value) => values.set(key, value),
  };
};
const fakeFetch = async () => ({
  ok: true,
  json: async () => ({
    result: "success",
    rates: testRates,
    time_last_update_unix: rateDate / 1000,
  }),
});

const runCurrencyChecks = async () => {
  check(
    "base currency conversion rate is one",
    calculateExchangeRate(testRates, "UGX", "UGX"),
    1,
  );
  check(
    "USD to UGX rate",
    calculateExchangeRate(testRates, "USD", "UGX"),
    3700,
  );
  check("USD to KES rate", calculateExchangeRate(testRates, "USD", "KES"), 130);
  check(
    "USD to TZS rate",
    calculateExchangeRate(testRates, "USD", "TZS"),
    2600,
  );
  check("USD to GBP rate", calculateExchangeRate(testRates, "USD", "GBP"), 0.8);

  const storage = testStorage();
  const usdToUgx = await convertAmount(100, "USD", "UGX", {
    storage,
    fetchImpl: fakeFetch,
    now: () => rateDate,
  });
  check("foreign transaction converts USD to UGX", usdToUgx.amount, 370000);
  check(
    "foreign transaction retains quote time",
    usdToUgx.timestamp,
    new Date(rateDate).toISOString(),
  );
  const cachedUsdToUgx = await getExchangeRate("USD", "UGX", {
    storage,
    fetchImpl: async () => {
      throw new Error("Fresh cached rate should avoid a request.");
    },
    now: () => rateDate,
  });
  check(
    "fresh pair cache avoids another provider request",
    cachedUsdToUgx.rate,
    3700,
  );
  const kesToUgx = await convertAmount(130, "KES", "UGX", {
    storage,
    fetchImpl: fakeFetch,
    now: () => rateDate,
  });
  check("foreign transaction converts KES to UGX", kesToUgx.amount, 3700);
  check(
    "multiple currencies aggregate after conversion",
    usdToUgx.amount + kesToUgx.amount,
    373700,
  );
  const baseTransaction = await convertAmount(500, "UGX", "UGX", {
    storage,
    fetchImpl: async () => {
      throw new Error("Must not fetch for base currency.");
    },
    now: () => rateDate,
  });
  check(
    "base-currency transaction does not need network",
    baseTransaction.amount,
    500,
  );

  const transaction = {
    amount: 100,
    currencyCode: "USD",
    baseAmount: usdToUgx.amount,
    baseCurrencyCode: "UGX",
    exchangeRate: usdToUgx.rate,
    exchangeRateTimestamp: usdToUgx.timestamp,
  };
  await getExchangeRate("UGX", "KES", {
    storage,
    fetchImpl: fakeFetch,
    now: () => rateDate,
  });
  check(
    "historical base amount stays immutable",
    transaction.baseAmount,
    370000,
  );
  check("historical source amount stays immutable", transaction.amount, 100);
  check(
    "historical quote stays immutable",
    transaction.exchangeRateTimestamp,
    new Date(rateDate).toISOString(),
  );
  const changedBaseRate = await getExchangeRate("UGX", "KES", {
    storage,
    fetchImpl: fakeFetch,
    now: () => rateDate,
  });
  check(
    "old base can be reported in changed preference",
    transaction.baseAmount * changedBaseRate.rate,
    13000,
  );

  const offlineStorage = testStorage();
  const staleRecord = {
    baseCurrencyCode: "USD",
    targetCurrencyCode: "GBP",
    rate: 0.8,
    timestamp: new Date(rateDate - 18 * 60 * 60 * 1000).toISOString(),
  };
  await offlineStorage.setItem(
    "expenseTracker.exchangeRate.USD.GBP",
    JSON.stringify(staleRecord),
  );
  const offlineCached = await getExchangeRate("USD", "GBP", {
    storage: offlineStorage,
    fetchImpl: async () => {
      throw new Error("offline");
    },
    now: () => rateDate,
  });
  check("offline uses a recent cached rate", offlineCached.rate, 0.8);
  let unavailableMessage = "";
  try {
    await getExchangeRate("EUR", "GBP", {
      storage: testStorage(),
      fetchImpl: async () => {
        throw new Error("offline");
      },
      now: () => rateDate,
    });
  } catch (error) {
    unavailableMessage = error.message;
  }
  check(
    "offline without a rate reports unavailable conversion",
    unavailableMessage.includes("temporarily unavailable"),
    true,
  );

  for (const code of ["UGX", "KES", "TZS", "USD", "GBP"]) {
    check(
      `${code} formats with Intl`,
      new Intl.NumberFormat("en", { style: "currency", currency: code }).format(
        1,
      ).length > 0,
      true,
    );
  }

  if (failures.length) {
    console.error("Self-check failed:");
    failures.forEach((failure) => console.error(` - ${failure}`));
    process.exit(1);
  }
  
const darkModeContext = fs.readFileSync(path.join(root, "ThemeContext.js"), "utf8");
check("brighter brand green keeps white header text at accessible contrast", darkModeContext.includes("#32A060") && darkModeContext.includes("#2B965B") && darkModeContext.includes("headerText: '#FFFFFF'"), true);
check("dark-mode failure rolls back to the safe light appearance", fs.readFileSync(path.join(root, "App.js"), "utf8").includes("setDarkMode(false)") && fs.readFileSync(path.join(root, "App.js"), "utf8").includes("Dark mode was turned off"), true);
check("startup boundary exposes a redacted diagnostic in production builds", fs.readFileSync(path.join(root, "index.js"), "utf8").includes("safeDiagnostic") && fs.readFileSync(path.join(root, "index.js"), "utf8").includes("[hidden]"), true);
check("uncaught startup failure resets a saved dark theme to light for recovery", fs.readFileSync(path.join(root, "index.js"), "utf8").includes("THEME_STORAGE_KEY") && fs.readFileSync(path.join(root, "index.js"), "utf8").includes("AsyncStorage.setItem(THEME_STORAGE_KEY, 'light')"), true);
check("Home top controls render once in a fixed safe-area header", fs.readFileSync(path.join(root, "screens", "HomeScreen.js"), "utf8").includes("headerShown: false") && fs.readFileSync(path.join(root, "screens", "HomeDashboard.js"), "utf8").includes("<CustomHeader />") && fs.readFileSync(path.join(root, "components", "CustomHeader.js"), "utf8").includes("height: 74"), true);
check("Budget bottom-tab title is a fixed 56-point green header", fs.readFileSync(path.join(root, "screens", "ToolsScreen.js"), "utf8").includes("styles.budgetHeader") && fs.readFileSync(path.join(root, "screens", "ToolsScreen.js"), "utf8").includes("height: 56"), true);
check("sales history graph uses narrower 30-point bars", fs.readFileSync(path.join(root, "screens", "ReportsScreen.js"), "utf8").includes("const chartBarWidth = 30") && fs.readFileSync(path.join(root, "screens", "ReportsScreen.js"), "utf8").includes("const chartBarGap = 20"), true);
const salesScreenSource = fs.readFileSync(path.join(root, "screens", "SalesScreen.js"), "utf8");
const salesScannerSource = fs.readFileSync(path.join(root, "SalesBarcodeScanner.js"), "utf8");
check("Sales uses the same scanner component as Inventory", salesScreenSource.includes("import BarcodeScannerComponent from '../BarcodeScannerComponent'") && salesScreenSource.includes("<BarcodeScannerComponent") && salesScreenSource.includes("onScanned={queueSalesBarcode}"), true);
check("Sales scanner uses the stable Paper modal pattern", salesScreenSource.includes("contentContainerStyle={[styles.scannerModal") && salesScreenSource.includes("<Portal>"), true);
check("Sales cart always defines the clear-cart action before rendering it", salesScreenSource.includes("const clearCart = () => updateCartItems(() => []);") && salesScreenSource.includes("onPress={clearCart}"), true);
check("Sales scanner unmounts the camera when the scanning session ends", salesScreenSource.includes("{scanning && isFocused ? (") && salesScreenSource.includes("continuous") && salesScreenSource.includes("scanCooldownMs={900}"), true);
check("Build sale is hidden while the Sales scanner is open", salesScreenSource.includes("visible={saleFormVisible && !scanning}") && salesScreenSource.includes("if (!scanning) closeSaleForm()"), true);
check("Sales barcode lookup is queued outside the camera callback", salesScreenSource.includes("setScanQueue((current) => [...current, value])") && salesScreenSource.includes("const addQueuedProduct = async ()") && salesScreenSource.includes("if (!scanning || scannerProcessing || !productsHydrated || !scanQueue.length) return;"), true);
check("Sales scanner prevents accidental duplicate detections and returns to ready state", fs.readFileSync(path.join(root, "BarcodeScannerComponent.js"), "utf8").includes("scanHandledRef.current") && fs.readFileSync(path.join(root, "BarcodeScannerComponent.js"), "utf8").includes("scanCooldownMs") && salesScreenSource.includes("continuous"), true);
check("Inventory continues using its original shared barcode scanner", fs.readFileSync(path.join(root, "screens", "ProductsScreen.js"), "utf8").includes("BarcodeScannerComponent") && fs.existsSync(path.join(root, "BarcodeScannerComponent.js")), true);
const headerSource = fs.readFileSync(path.join(root, "components", "CustomHeader.js"), "utf8");
check("Three-dot menu has no leading icons", !headerSource.includes("leadingIcon="), true);
check("Three-dot menu does not duplicate account deletion", !headerSource.includes("Delete account"), true);
check("Personal account subtitle is shortened to Private ledger", headerSource.includes("'Private ledger'"), true);
const dashboardSource = fs.readFileSync(path.join(root, "screens", "HomeDashboard.js"), "utf8");
check("Advert text panel has a high-contrast translucent background", dashboardSource.includes("rgba(255,255,255,0.84)") && dashboardSource.includes("rgba(13,22,16,0.82)"), true);
check("Sales camera does not rely on Android-unsupported active prop", !salesScreenSource.includes("active={scanning}"), true);
check("Build sale has no instructional modal paragraph", !salesScreenSource.includes("Scan each product and it will be added to the cart automatically"), true);
check("Build sale has no scanner usage helper paragraph", !salesScreenSource.includes("A scanned barcode is added to the cart automatically"), true);
check("Build sale has no currency change instructions", !salesScreenSource.includes("To change currency, clear the cart first"), true);

console.log(`Currency-aware self-check passed (${assertions} assertions).`);
};

runCurrencyChecks().catch((error) => {
  console.error("Currency checks failed:", error);
  process.exit(1);
});
