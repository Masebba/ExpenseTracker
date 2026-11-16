import React, { useContext, useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
  Platform,
  KeyboardAvoidingView,
  Animated,
  Easing,
} from "react-native";
import { Button, Card, Dialog, Portal, Text } from "react-native-paper";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { TransactionsContext } from "../TransactionsContext";
import { AuthContext } from "../AuthContext";
import { CurrencyContext } from "../CurrencyContext";
import { AppFeaturesContext } from "../AppFeaturesContext";
import { ProductsContext } from "../ProductsContext";
import { SalesContext } from "../SalesContext";
import { OrdersContext } from "../OrdersContext";
import { BusinessRecordsContext } from "../BusinessRecordsContext";
import { inPeriod, formatMoney, normalizeAdvertImageUrl, CONTENT_MAX_WIDTH, contentWidthStyle } from "../utils/appUtils";
import useReportingAmounts from "../hooks/useReportingAmounts";
import { userFacingError } from "../utils/userFacingErrors";
import { ThemeContext } from "../ThemeContext";

const shortcuts = [
  {
    title: "Trade",
    icon: "cart-outline",
    screen: "PoSNavigator",
    color: "#e7f1e8",
  },
  { title: "Income", icon: "cash-plus", screen: "Income", color: "#e2f2e9" },
  { title: "Expense", icon: "cash-minus", screen: "Expense", color: "#f9e9e5" },
  {
    title: "Customers",
    icon: "account-group-outline",
    screen: "Customers",
    color: "#e8f1f5",
  },
  {
    title: "Suppliers",
    icon: "truck-outline",
    screen: "Suppliers",
    color: "#f2eaf3",
  },
  {
    title: "Account",
    icon: "wallet-outline",
    screen: "MyAccount",
    color: "#eceafa",
  },
  {
    title: "Invoices",
    icon: "file-document-edit-outline",
    screen: "Invoices",
    color: "#edf0e4",
  },
  { title: "Budget", icon: "chart-donut", screen: "Budget", color: "#f5eddf" },
  {
    title: "Convert",
    icon: "currency-usd",
    screen: "Converter",
    color: "#e8eef8",
  },
];

export default function HomeDashboard({ navigation }) {
  const { transactions } = useContext(TransactionsContext);
  const { products = [] } = useContext(ProductsContext);
  const { sales = [] } = useContext(SalesContext);
  const { orders = [] } = useContext(OrdersContext);
  const { customers = [], suppliers = [], invoices = [], purchases = [] } = useContext(BusinessRecordsContext);
  const { currency } = useContext(CurrencyContext);
  const { ads } = useContext(AppFeaturesContext);
  const { activeWorkspace } = useContext(AuthContext);
  const { isDark, palette } = useContext(ThemeContext);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [selectedAd, setSelectedAd] = useState(null);
  const [failedAdImages, setFailedAdImages] = useState({});
  const [summaryPeriod, setSummaryPeriod] = useState('daily');
  const summaryTransition = useRef(new Animated.Value(1)).current;
  const carousel = useRef(null);
  const slideIndex = useRef(0);
  const contentWidth = Math.min(windowWidth, CONTENT_MAX_WIDTH);
  const bannerWidth = Math.max(240, contentWidth - 32);
  const bannerHeight = Math.max(125, Math.min(170, Math.round(windowHeight * 0.2)));
  const now = Date.now();
  const visibleAds = ads.filter(
    (ad) =>
      ad.active &&
      ad.publisherType === "developer" &&
      (!ad.startsAt || new Date(ad.startsAt).getTime() <= now) &&
      (!ad.endsAt || new Date(`${ad.endsAt}T23:59:59`).getTime() >= now),
  );
  const shortcutColumns = contentWidth >= 640 ? 5 : contentWidth >= 420 ? 4 : 3;
  const shortcutWidth = `${(100 / shortcutColumns).toFixed(4)}%`;
  const { amounts: reportingAmounts, loading: reportingLoading, error: reportingError } = useReportingAmounts(transactions, currency?.code, "amount");
  const hasBusinessActivity = [transactions, products, sales, orders, customers, suppliers, invoices, purchases].some((items) => items.length > 0);
  const periodOptions = [
    { label: 'Today', value: 'daily' },
    { label: 'This week', value: 'weekly' },
    { label: 'This month', value: 'monthly' },
  ];
  const periodLabel = periodOptions.find((item) => item.value === summaryPeriod)?.label || 'Today';
  const periodTransactions = transactions
    .filter((item) => inPeriod(item.timestamp, summaryPeriod))
    .slice()
    .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
  const periodIncome = periodTransactions
    .filter((item) => item.type === 'income')
    .reduce((sum, item) => sum + (reportingAmounts[item.id] || 0), 0);
  const periodExpense = periodTransactions
    .filter((item) => item.type === 'expense')
    .reduce((sum, item) => sum + (reportingAmounts[item.id] || 0), 0);
  const selectSummaryPeriod = (nextPeriod) => {
    if (nextPeriod === summaryPeriod) return;
    Animated.timing(summaryTransition, { toValue: 0, duration: 190, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(({ finished }) => {
      if (!finished) return;
      setSummaryPeriod(nextPeriod);
      Animated.timing(summaryTransition, { toValue: 1, duration: 440, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    });
  };

  useEffect(() => {
    slideIndex.current = 0;
    carousel.current?.scrollTo({ x: 0, animated: false });
    if (visibleAds.length < 2) return undefined;
    const timer = setInterval(() => {
      slideIndex.current = (slideIndex.current + 1) % visibleAds.length;
      carousel.current?.scrollTo({
        x: slideIndex.current * (bannerWidth + 12),
        animated: true,
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [visibleAds.length, bannerWidth]);

  const visitBusiness = () => {
    const url = selectedAd?.linkUrl;
    if (!url) {
      setSelectedAd(null);
      return;
    }
    Linking.openURL(url).catch(() =>
      Alert.alert(
        "Link unavailable",
        "This business link could not be opened.",
      ),
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={[styles.page, { backgroundColor: palette.background }]}
        contentContainerStyle={[styles.container, { backgroundColor: palette.background }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {!hasBusinessActivity && (
          <Card style={[styles.setupCard, { backgroundColor: palette.surface }]}>
            <Card.Content>
              <View style={[styles.setupIcon, { backgroundColor: palette.surfaceAlt }]}><MaterialCommunityIcons name="briefcase-check-outline" size={28} color={palette.primary} /></View>
              <Text style={[styles.setupTitle, { color: palette.text }]}>Welcome to FinanceTracker</Text>
              <Text style={[styles.setupText, { color: palette.textMuted }]}>Bring your business records together in one place, from products and customers to sales, purchases, invoices and everyday transactions. Start with one step, then build your workspace as you go.</Text>
              <View style={[styles.setupStep, { borderTopColor: palette.border }]}><Text style={[styles.setupStepNumber, { backgroundColor: palette.surfaceAlt, color: palette.primary }]}>1</Text><View style={styles.setupStepBody}><Text style={[styles.setupStepTitle, { color: palette.text }]}>Set up what you sell</Text><Text style={[styles.setupText, { color: palette.textMuted }]}>Add products and prices to prepare for sales.</Text><Button compact mode="contained" onPress={() => navigation.navigate('PoSNavigator')}>Open Trade</Button></View></View>
              <View style={[styles.setupStep, { borderTopColor: palette.border }]}><Text style={[styles.setupStepNumber, { backgroundColor: palette.surfaceAlt, color: palette.primary }]}>2</Text><View style={styles.setupStepBody}><Text style={[styles.setupStepTitle, { color: palette.text }]}>Create a business contact</Text><Text style={[styles.setupText, { color: palette.textMuted }]}>Save a customer or supplier for your documents.</Text><View style={styles.setupActions}><Button compact onPress={() => navigation.navigate('Customers')}>Add customer</Button><Button compact onPress={() => navigation.navigate('Suppliers')}>Add supplier</Button></View></View></View>
              <View style={[styles.setupStep, { borderTopColor: palette.border }]}><Text style={[styles.setupStepNumber, { backgroundColor: palette.surfaceAlt, color: palette.primary }]}>3</Text><View style={styles.setupStepBody}><Text style={[styles.setupStepTitle, { color: palette.text }]}>Record your first activity</Text><Text style={[styles.setupText, { color: palette.textMuted }]}>Capture income or an expense, or create an invoice.</Text><View style={styles.setupActions}><Button compact onPress={() => navigation.navigate('Income')}>Income</Button><Button compact onPress={() => navigation.navigate('Expense')}>Expense</Button><Button compact onPress={() => navigation.navigate('Invoices')}>Invoice</Button></View></View></View>
            </Card.Content>
          </Card>
        )}

        <Card style={[styles.summaryCard, { backgroundColor: palette.surface }]}>
          <Card.Content>
            <Text style={[styles.summaryTitle, { color: palette.textMuted }]}>{periodLabel} · {currency?.code || 'UGX'}</Text>
            <Text style={[styles.workspaceCaption, { color: palette.textMuted }]}>{activeWorkspace?.id === 'personal' ? 'Personal account' : (activeWorkspace?.name || 'Business workspace')} · Trade sales are included in income.</Text>
            {!!reportingError && <Text style={[styles.metricCaption, { color: palette.danger }]}>{userFacingError({ message: reportingError }, 'Some totals could not be calculated right now. Please try again later.')}</Text>}
            <View style={[styles.periodPicker, { backgroundColor: palette.surfaceAlt }]} accessibilityRole="tablist">
              {periodOptions.map((option) => {
                const selected = summaryPeriod === option.value;
                return <TouchableOpacity key={option.value} onPress={() => selectSummaryPeriod(option.value)} accessibilityRole="tab" accessibilityState={{ selected }} style={[styles.periodButton, selected && { backgroundColor: palette.primary }]}>
                  <Text style={[styles.periodButtonText, { color: selected ? (isDark ? '#101712' : '#ffffff') : palette.textMuted }]}>{option.label}</Text>
                </TouchableOpacity>;
              })}
            </View>
            <Animated.View style={{ opacity: summaryTransition, transform: [{ translateY: summaryTransition.interpolate({ inputRange: [0, 1], outputRange: [7, 0] }) }] }}>
              <View style={styles.metrics}>
                <View style={styles.metric}>
                  <Text style={[styles.metricCaption, { color: palette.textMuted }]}>Income</Text>
                  <Text numberOfLines={1} style={[styles.income, { color: palette.income }]}>{reportingLoading || reportingError ? '—' : formatMoney(periodIncome, currency)}</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={[styles.metricCaption, { color: palette.textMuted }]}>Expenses</Text>
                  <Text numberOfLines={1} style={[styles.expense, { color: palette.expense }]}>{reportingLoading || reportingError ? '—' : formatMoney(periodExpense, currency)}</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={[styles.metricCaption, { color: palette.textMuted }]}>Net</Text>
                  <Text numberOfLines={1} style={[styles.net, { color: palette.text }]}>{reportingLoading || reportingError ? '—' : formatMoney(periodIncome - periodExpense, currency)}</Text>
                </View>
              </View>
              <View style={[styles.activityHeader, { borderTopColor: palette.border }]}>
                <Text style={[styles.activityTitle, { color: palette.text }]}>Activity</Text>
                <Text style={[styles.activityCount, { color: palette.textMuted }]}>{periodTransactions.length} transaction{periodTransactions.length === 1 ? '' : 's'}</Text>
              </View>
              {periodTransactions.length ? periodTransactions.slice(0, 3).map((item) => {
                const isIncome = item.type === 'income';
                const title = item.description || item.category || (isIncome ? 'Income' : 'Expense');
                const when = item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                return <View key={item.id} style={styles.activityRow}>
                  <View style={[styles.activityIcon, { backgroundColor: palette.surfaceAlt }]}><MaterialCommunityIcons name={isIncome ? 'arrow-bottom-left' : 'arrow-top-right'} color={isIncome ? palette.income : palette.expense} size={18} /></View>
                  <View style={styles.activityTextBox}>
                    <Text numberOfLines={1} style={[styles.activityName, { color: palette.text }]}>{title}</Text>
                    <Text style={[styles.activityMeta, { color: palette.textMuted }]}>{isIncome ? 'Income' : 'Expense'}{when ? ` · ${when}` : ''}</Text>
                  </View>
                  <Text numberOfLines={1} style={[styles.activityAmount, { color: isIncome ? palette.income : palette.expense }]}>{formatMoney(reportingAmounts[item.id] || 0, currency)}</Text>
                </View>;
              }) : <Text style={[styles.emptyActivity, { color: palette.textMuted }]}>No transactions for {periodLabel.toLowerCase()} yet.</Text>}
            </Animated.View>
          </Card.Content>
        </Card>

        <View style={styles.actions}>
          {shortcuts.map((item) => (
            <TouchableOpacity
              key={item.title}
              style={[styles.shortcut, { width: shortcutWidth }]}
              onPress={() => navigation.navigate(item.screen)}
              accessibilityRole="button"
            >
              <View
                style={[styles.shortcutIcon, { backgroundColor: palette.surfaceAlt }]}
              >
                <MaterialCommunityIcons
                  name={item.icon}
                  size={28}
                  color={palette.primary}
                />
              </View>
              <Text style={[styles.shortcutText, { color: palette.text }]}>{item.title}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {!!visibleAds.length && (
          <ScrollView
            ref={carousel}
            horizontal
            pagingEnabled
            snapToInterval={bannerWidth + 12}
            decelerationRate="fast"
            onMomentumScrollEnd={(event) => {
              slideIndex.current = Math.round(
                event.nativeEvent.contentOffset.x / (bannerWidth + 12),
              );
            }}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselContent}
          >
            {visibleAds.map((ad) => {
              const imageUrl = normalizeAdvertImageUrl(ad.imageUrl);
              const imageKey = `${ad.id}:${ad.imageUrl}`;
              const hasImage = Boolean(imageUrl) && !failedAdImages[imageKey];
              return (
              <TouchableOpacity
                key={ad.id}
                activeOpacity={0.94}
                onPress={() => setSelectedAd(ad)}
                style={[styles.banner, { width: bannerWidth, height: bannerHeight }]}
                accessibilityLabel={`Advertisement: ${ad.businessName || ad.title}`}
              >
                <View style={styles.adLabel}><Text style={styles.adLabelText}>Ad</Text></View>
                {hasImage ? (
                  <View style={styles.bannerImageBackground}>
                    <Image
                      source={{ uri: imageUrl }}
                      style={styles.bannerImage}
                      resizeMode="cover"
                      onError={(event) => { console.warn('[Advert image] Could not load', imageUrl, event?.nativeEvent?.error || 'Unknown image error'); setFailedAdImages((current) => ({ ...current, [imageKey]: true })); }}
                    />
                    <View style={[styles.bannerShade, { backgroundColor: isDark ? 'rgba(13,22,16,0.68)' : 'rgba(255,255,255,0.38)' }]}>
                      <Text numberOfLines={1} style={[styles.businessName, { color: isDark ? '#f0f6f1' : '#26382b' }]}>
                        {ad.businessName}
                      </Text>
                      <Text numberOfLines={2} style={[styles.bannerTitle, { color: isDark ? '#e0e9e1' : '#58655b' }]}>
                        {ad.title}
                      </Text>
                      <Text numberOfLines={2} style={[styles.bannerDescription, { color: isDark ? '#d7e2d9' : '#465249' }]}>
                        {ad.description}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.bannerFallback}>
                    <Text style={styles.businessName}>{ad.businessName}</Text>
                    <Text style={styles.bannerTitle}>{ad.title}</Text>
                    <Text style={styles.bannerDescription}>
                      {ad.description}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        <Portal>
          <Dialog
            visible={!!selectedAd}
            onDismiss={() => setSelectedAd(null)}
            style={[styles.detailDialog, { backgroundColor: palette.surface }]}
          >
            {normalizeAdvertImageUrl(selectedAd?.imageUrl) ? (
              failedAdImages[`${selectedAd.id}:${selectedAd.imageUrl}`] ? (
                <View style={[styles.detailImageFallback, { backgroundColor: palette.surfaceAlt }]}><Text style={[styles.bannerDescription, { color: palette.textMuted }]}>Advert image unavailable.</Text></View>
              ) : (
                <Image
                  source={{ uri: normalizeAdvertImageUrl(selectedAd.imageUrl) }}
                  style={styles.detailImage}
                  resizeMode="cover"
                  onError={() => setFailedAdImages((current) => ({ ...current, [`${selectedAd.id}:${selectedAd.imageUrl}`]: true }))}
                />
              )
            ) : null}
            <Dialog.Content>
              <Text style={[styles.adDialogLabel, { color: palette.textMuted }]}>Advertisement</Text>
              <Text style={[styles.detailBusiness, { color: palette.text }]}>
                {selectedAd?.businessName}
              </Text>
              <Text style={[styles.detailTitle, { color: palette.textMuted }]}>{selectedAd?.title}</Text>
              <Text style={[styles.detailDescription, { color: palette.text }]}>
                {selectedAd?.description}
              </Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setSelectedAd(null)}>Close</Button>
              {!!selectedAd?.linkUrl && (
                <Button mode="contained" onPress={visitBusiness}>
                  Visit business
                </Button>
              )}
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f4f6f3" },
  container: {
    ...contentWidthStyle,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 24,
  },
  setupCard: { backgroundColor: "#fff", borderRadius: 18, marginBottom: 14, elevation: 1 },
  setupIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: "#e7f1e8", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  setupTitle: { fontSize: 19, fontWeight: "800", color: "#24432b", marginBottom: 6 },
  setupText: { fontSize: 13, color: "#536357", lineHeight: 19 },
  setupActions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", marginTop: 4 },
  setupStep: { flexDirection: "row", alignItems: "flex-start", marginTop: 15, paddingTop: 13, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#dce5dc" },
  setupStepNumber: { width: 28, height: 28, borderRadius: 14, overflow: "hidden", textAlign: "center", textAlignVertical: "center", backgroundColor: "#e7f1e8", color: "#2f7040", fontWeight: "800", paddingTop: 4, marginRight: 10 },
  setupStepBody: { flex: 1, gap: 3 },
  setupStepTitle: { fontSize: 14, fontWeight: "700", color: "#24432b" },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    marginBottom: 14,
    elevation: 1,
  },
  summaryTitle: {
    color: "#526557",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  workspaceCaption: { color: "#758078", fontSize: 11, marginBottom: 12 },
  periodPicker: { flexDirection: 'row', alignItems: 'center', padding: 3, borderRadius: 13, marginBottom: 14, gap: 3 },
  periodButton: { flex: 1, minHeight: 34, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, paddingVertical: 7, borderRadius: 10 },
  periodButtonText: { fontSize: 11, fontWeight: '700' },
  activityHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, marginTop: 13, marginBottom: 4 },
  activityTitle: { fontSize: 13, fontWeight: '800' },
  activityCount: { fontSize: 10 },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 45, paddingVertical: 5 },
  activityIcon: { width: 31, height: 31, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  activityTextBox: { flex: 1, minWidth: 0 },
  activityName: { fontSize: 12, fontWeight: '600' },
  activityMeta: { fontSize: 10, marginTop: 2 },
  activityAmount: { maxWidth: '37%', fontSize: 11, fontWeight: '700', textAlign: 'right' },
  emptyActivity: { fontSize: 11, paddingVertical: 11 },
  metrics: { flexDirection: "row", justifyContent: "space-between" },
  metric: { flex: 1, paddingRight: 4 },
  metricCaption: { fontSize: 11, color: "#758078", marginBottom: 5 },
  income: { fontSize: 13, fontWeight: "700", color: "#267a46" },
  expense: { fontSize: 13, fontWeight: "700", color: "#bd4936" },
  net: { fontSize: 13, fontWeight: "700", color: "#23432b" },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    paddingVertical: 7,
    marginBottom: 13,
  },
  shortcut: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
  },
  shortcutIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  shortcutText: { color: "#34463a", fontSize: 13, fontWeight: "600" },
  carouselContent: { gap: 12 },
  banner: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#e7e9e6",
    elevation: 2,
  },
  bannerImageBackground: { flex: 1, justifyContent: "flex-end" },
  bannerImage: StyleSheet.absoluteFillObject,
  bannerShade: { padding: 16, backgroundColor: "rgba(255, 255, 255, 0.46)" },
  businessName: {
    color: "#26382b",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 4,
  },
  bannerTitle: {
    color: "#58655b",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 5,
  },
  bannerDescription: { color: "#465249", fontSize: 13, lineHeight: 19 },
  bannerFallback: { flex: 1, justifyContent: "center", padding: 20, backgroundColor: "#e8eee9" },
  detailDialog: { borderRadius: 20, overflow: "hidden" },
  detailImage: { width: "100%", height: 190, backgroundColor: '#e7e9e6' },
  detailImageFallback: { width: "100%", height: 190, alignItems: "center", justifyContent: "center", backgroundColor: "#e8eee9" },
  adLabel: {
  position: "absolute",
  top: 10,
  right: 10,
  backgroundColor: "rgba(38,56,43,0.78)",
  borderRadius: 6,
    paddingHorizontal: 8,
  paddingVertical: 3,
  zIndex: 2,
},
  adLabelText: { color: "#ffffff", fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
  adDialogLabel: {
    color: "#68756b",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  detailBusiness: {
    color: "#26382b",
    fontWeight: "800",
    fontSize: 22,
    marginBottom: 7,
  },
  detailTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#58655b",
    marginBottom: 10,
  },
  detailDescription: { color: "#49564c", fontSize: 15, lineHeight: 22 },
});
