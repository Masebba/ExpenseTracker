import React, { useContext, useEffect, useRef, useState } from "react";
import {
  Alert,
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
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from "react-native-svg";
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
import { SafeAreaView } from "react-native-safe-area-context";
import CustomHeader from "../components/CustomHeader";
import AdvertImage from "../components/AdvertImage";

const shortcuts = [
  {
    title: "Trade",
    icon: "cart-outline",
    screen: "PoSNavigator",
    color: "#e8f2eb", iconColor: "#347b54",
  },
  { title: "Income", icon: "cash-plus", screen: "Income", color: "#e6f2e9", iconColor: "#43835d" },
  { title: "Expense", icon: "cash-minus", screen: "Expense", color: "#f7eae7", iconColor: "#b9685b" },
  {
    title: "Customers",
    icon: "account-group-outline",
    screen: "Customers",
    color: "#e9f0f5", iconColor: "#587b91",
  },
  {
    title: "Suppliers",
    icon: "truck-outline",
    screen: "Suppliers",
    color: "#f3edf1", iconColor: "#8a6880",
  },
  {
    title: "Account",
    icon: "wallet-outline",
    screen: "MyAccount",
    color: "#eeedf8", iconColor: "#6c6b9a",
  },
  {
    title: "Invoices",
    icon: "file-document-edit-outline",
    screen: "Invoices",
    color: "#eff2e7", iconColor: "#7b8555",
  },
  { title: "Budget", icon: "chart-donut", screen: "Budget", color: "#e8f1ef", iconColor: "#4d8178" },
  {
    title: "Convert",
    icon: "currency-usd",
    screen: "Converter",
    color: "#e9eef8", iconColor: "#647da7",
  },
];

const SUMMARY_PERIODS = [
  { label: 'Today', value: 'daily' },
  { label: 'This week', value: 'weekly' },
  { label: 'This month', value: 'monthly' },
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
  const [activeAdIndex, setActiveAdIndex] = useState(0);
  const summaryTransition = useRef(new Animated.Value(1)).current;
  const advertTransition = useRef(new Animated.Value(0)).current;
  const contentWidth = Math.min(windowWidth, CONTENT_MAX_WIDTH);
  const bannerWidth = Math.max(240, contentWidth - 32);
  const bannerHeight = Math.max(125, Math.min(170, Math.round(windowHeight * 0.2)));
  const now = Date.now();
  const visibleAds = (Array.isArray(ads) ? ads : []).filter((ad) => {
    // Older developer adverts may not contain these metadata fields. Because this
    // collection is already the developer advert collection, missing values are safe
    // to interpret as developer-owned and active; explicitly disabled adverts stay hidden.
    const active = ad.active !== false && String(ad.active).toLowerCase() !== 'false';
    const publisherType = String(ad.publisherType || 'developer').toLowerCase();
    if (!active || publisherType !== 'developer') return false;

    const parseScheduleDate = (value, endOfDay = false) => {
      if (!value) return null;
      const raw = String(value).trim();
      const dateValue = /^\d{4}-\d{2}-\d{2}$/.test(raw)
        ? `${raw}T${endOfDay ? '23:59:59.999' : '00:00:00'}`
        : raw;
      const timestamp = new Date(dateValue).getTime();
      return Number.isFinite(timestamp) ? timestamp : null;
    };
    const startsAt = parseScheduleDate(ad.startsAt);
    const endsAt = parseScheduleDate(ad.endsAt, true);
    return (startsAt === null || startsAt <= now) && (endsAt === null || endsAt >= now);
  });
  const shortcutColumns = contentWidth >= 640 ? 5 : contentWidth >= 420 ? 4 : 3;
  const shortcutWidth = `${(100 / shortcutColumns).toFixed(4)}%`;
  const { amounts: reportingAmounts, loading: reportingLoading, error: reportingError } = useReportingAmounts(transactions, currency?.code, "amount");
  const hasBusinessActivity = [transactions, products, sales, orders, customers, suppliers, invoices, purchases].some((items) => items.length > 0);
  const periodLabel = SUMMARY_PERIODS.find((item) => item.value === summaryPeriod)?.label || 'Today';
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
  useEffect(() => {
    let mounted = true;
    let timer = null;
    const scheduleNext = () => {
      timer = setTimeout(() => {
        Animated.timing(summaryTransition, {
          toValue: 0,
          duration: 360,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (!finished || !mounted) return;
          setSummaryPeriod((current) => {
            const currentIndex = SUMMARY_PERIODS.findIndex((item) => item.value === current);
            return SUMMARY_PERIODS[(currentIndex + 1 + SUMMARY_PERIODS.length) % SUMMARY_PERIODS.length].value;
          });
          summaryTransition.setValue(0);
          Animated.timing(summaryTransition, {
            toValue: 1,
            duration: 620,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start(() => { if (mounted) scheduleNext(); });
        });
      }, 6500);
    };
    scheduleNext();
    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
      summaryTransition.stopAnimation();
    };
  }, [summaryTransition]);

  const visibleAdIds = visibleAds.map((ad) => `${ad.id}:${ad.imageUrl || ad.imageURL || ad.image_url || ''}`).join('|');
  useEffect(() => {
    let mounted = true;
    let timer = null;
    setActiveAdIndex(0);
    setFailedAdImages({});
    advertTransition.setValue(0);

    if (visibleAds.length < 2) {
      return () => { mounted = false; advertTransition.stopAnimation(); };
    }

    const scheduleNextSlide = () => {
      timer = setTimeout(() => {
        Animated.timing(advertTransition, {
          toValue: 1,
          duration: 640,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (!finished || !mounted) return;
          advertTransition.setValue(0);
          setActiveAdIndex((current) => (current + 1) % visibleAds.length);
          scheduleNextSlide();
        });
      }, 6000);
    };

    scheduleNextSlide();
    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
      advertTransition.stopAnimation();
    };
  }, [visibleAdIds, visibleAds.length, advertTransition]);

  const currentAd = visibleAds.length ? visibleAds[activeAdIndex % visibleAds.length] : null;
  const nextAd = visibleAds.length > 1 ? visibleAds[(activeAdIndex + 1) % visibleAds.length] : null;
  const getAdvertImageUrl = (ad) => {
    const raw = String(ad?.imageUrl || ad?.imageURL || ad?.image_url || ad?.image || '').trim();
    if (!raw) return '';
    return normalizeAdvertImageUrl(raw);
  };

  const renderAdvertCard = (ad) => {
    if (!ad) return null;
    const imageUrl = getAdvertImageUrl(ad);
    const imageKey = `${ad.id}:${ad.imageUrl || ad.imageURL || ad.image_url || ad.image || ''}`;
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
            <AdvertImage
              uri={imageUrl}
              style={styles.bannerImageBackground}
              resizeMode="cover"
              onLoad={() => setFailedAdImages((current) => {
                if (!current[imageKey]) return current;
                const next = { ...current };
                delete next[imageKey];
                return next;
              })}
              onError={(event) => {
                console.warn('[Advert image] Could not load', imageUrl, event?.nativeEvent?.error || 'Unknown image error');
                setFailedAdImages((current) => ({ ...current, [imageKey]: true }));
              }}
            >
              <View style={[styles.bannerShade, { backgroundColor: isDark ? 'rgba(13,22,16,0.82)' : 'rgba(255,255,255,0.84)' }]}>
                <Text numberOfLines={1} style={[styles.businessName, { color: isDark ? '#f0f6f1' : '#26382b' }]}>{ad.businessName}</Text>
                <Text numberOfLines={2} style={[styles.bannerTitle, { color: isDark ? '#e0e9e1' : '#58655b' }]}>{ad.title}</Text>
                <Text numberOfLines={2} style={[styles.bannerDescription, { color: isDark ? '#d7e2d9' : '#465249' }]}>{ad.description}</Text>
              </View>
            </AdvertImage>
          </View>
        ) : (
          <View style={styles.bannerFallback}>
            <Text style={styles.businessName}>{ad.businessName}</Text>
            <Text style={styles.bannerTitle}>{ad.title}</Text>
            <Text style={styles.bannerDescription}>{ad.description}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

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
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: palette.header }}>
        <CustomHeader />
      </SafeAreaView>
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
          <View style={styles.summarySurface}>
            <Svg pointerEvents="none" style={StyleSheet.absoluteFill} viewBox="0 0 420 210" preserveAspectRatio="none">
              <Defs>
                <SvgLinearGradient id="homeSummaryTint" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor={isDark ? '#243b2d' : '#F0F8F2'} />
                  <Stop offset="100%" stopColor={isDark ? '#1a2820' : '#E0F0E5'} />
                </SvgLinearGradient>
              </Defs>
              <Rect x="0" y="0" width="420" height="210" fill="url(#homeSummaryTint)" />
            </Svg>
            <Card.Content style={styles.summaryContent}>
              <View style={styles.summaryHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.summaryTitle, { color: palette.text }]}>{periodLabel.toUpperCase()} · {currency?.code || 'UGX'}</Text>
                  <Text style={[styles.workspaceCaption, { color: palette.textMuted }]}>{activeWorkspace?.id === 'personal' ? 'Personal account' : (activeWorkspace?.name || 'Business workspace')} · Income & expenses</Text>
                </View>
                <View style={styles.slideIndicators} accessibilityLabel={`Showing ${periodLabel} summary`}>
                  {SUMMARY_PERIODS.map((option) => <View key={option.value} style={[styles.slideDot, { backgroundColor: summaryPeriod === option.value ? palette.primary : palette.border, width: summaryPeriod === option.value ? 17 : 6 }]} />)}
                </View>
              </View>
              {!!reportingError && <Text style={[styles.metricCaption, { color: palette.danger }]}>{userFacingError({ message: reportingError }, 'Some totals could not be calculated right now. Please try again later.')}</Text>}
              <Animated.View style={{ opacity: summaryTransition, transform: [{ translateX: summaryTransition.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }}>
                <View style={styles.metrics}>
                  <View style={styles.metric}>
                    <Text style={[styles.metricCaption, { color: palette.textMuted }]}>Income</Text>
                    <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.income, { color: palette.income }]}>{reportingLoading || reportingError ? '—' : formatMoney(periodIncome, currency)}</Text>
                  </View>
                  <View style={styles.metric}>
                    <Text style={[styles.metricCaption, { color: palette.textMuted }]}>Expenses</Text>
                    <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.expense, { color: palette.expense }]}>{reportingLoading || reportingError ? '—' : formatMoney(periodExpense, currency)}</Text>
                  </View>
                  <View style={styles.metric}>
                    <Text style={[styles.metricCaption, { color: palette.textMuted }]}>Net</Text>
                    <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.net, { color: palette.text }]}>{reportingLoading || reportingError ? '—' : formatMoney(periodIncome - periodExpense, currency)}</Text>
                  </View>
                </View>
                <View style={styles.summaryFooter}>
                  <Text style={[styles.footerActivity, { color: palette.textMuted }]}>{periodTransactions.length} transaction{periodTransactions.length === 1 ? '' : 's'} in {periodLabel.toLowerCase()}</Text>
                </View>
              </Animated.View>
            </Card.Content>
          </View>
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
                style={[styles.shortcutIcon, { backgroundColor: isDark ? palette.surfaceAlt : item.color }]}
              >
                <MaterialCommunityIcons
                  name={item.icon}
                  size={28}
                  color={isDark ? palette.primary : (item.iconColor || palette.primary)}
                />
              </View>
              <Text style={[styles.shortcutText, { color: palette.text }]}>{item.title}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {!!currentAd && (
          <View style={[styles.adCarousel, { width: bannerWidth, height: bannerHeight }]}>
            <Animated.View
              pointerEvents="box-none"
              style={[
                styles.adSlide,
                {
                  width: bannerWidth,
                  height: bannerHeight,
                  transform: [{ translateX: advertTransition.interpolate({ inputRange: [0, 1], outputRange: [0, -bannerWidth] }) }],
                },
              ]}
            >
              {renderAdvertCard(currentAd)}
            </Animated.View>
            {!!nextAd && (
              <Animated.View
                pointerEvents="box-none"
                style={[
                  styles.adSlide,
                  {
                    width: bannerWidth,
                    height: bannerHeight,
                    transform: [{ translateX: advertTransition.interpolate({ inputRange: [0, 1], outputRange: [bannerWidth, 0] }) }],
                  },
                ]}
              >
                {renderAdvertCard(nextAd)}
              </Animated.View>
            )}
          </View>
        )}

        <Portal>
          <Dialog
            visible={!!selectedAd}
            onDismiss={() => setSelectedAd(null)}
            style={[styles.detailDialog, { backgroundColor: palette.surface }]}
          >
            {getAdvertImageUrl(selectedAd) ? (
              failedAdImages[`${selectedAd.id}:${selectedAd.imageUrl || selectedAd.imageURL || selectedAd.image_url || selectedAd.image || ''}`] ? (
                <View style={[styles.detailImageFallback, { backgroundColor: palette.surfaceAlt }]}><Text style={[styles.bannerDescription, { color: palette.textMuted }]}>Advert image unavailable.</Text></View>
              ) : (
                <AdvertImage
                  uri={getAdvertImageUrl(selectedAd)}
                  style={styles.detailImage}
                  resizeMode="cover"
                  onError={() => setFailedAdImages((current) => ({ ...current, [`${selectedAd.id}:${selectedAd.imageUrl || selectedAd.imageURL || selectedAd.image_url || selectedAd.image || ''}`]: true }))}
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
    </View>
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
  setupStepNumber: { width: 28, height: 28, borderRadius: 14, overflow: "hidden", textAlign: "center", textAlignVertical: "center", backgroundColor: "#e7f1e8", color: "#267F4D", fontWeight: "800", paddingTop: 4, marginRight: 10 },
  setupStepBody: { flex: 1, gap: 3 },
  setupStepTitle: { fontSize: 14, fontWeight: "700", color: "#24432b" },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 17,
    marginBottom: 9,
    elevation: 1,
    overflow: "hidden",
  },
  summarySurface: { minHeight: 142, overflow: "hidden" },
  summaryContent: { paddingTop: 12, paddingBottom: 11 },
  summaryHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 9 },
  slideIndicators: { flexDirection: "row", alignItems: "center", gap: 5, marginLeft: 8 },
  slideDot: { height: 6, borderRadius: 4 },
  summaryFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  footerActivity: { fontSize: 9 },
  summaryTitle: {
    color: "#526557",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  workspaceCaption: { color: "#758078", fontSize: 10, marginTop: 2 },
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
  adCarousel: { overflow: 'hidden', position: 'relative', marginBottom: 12 },
  adSlide: { position: 'absolute', left: 0, top: 0 },
  shortcut: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
  },
  shortcutIcon: {
    width: 58,
    height: 58,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(90,125,102,0.12)",
  },
  shortcutText: { color: "#34463a", fontSize: 13, fontWeight: "600" },
  carouselContent: { gap: 12 },
  banner: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#e7e9e6",
    elevation: 2,
  },
  bannerImageBackground: { flex: 1, width: '100%', minHeight: 125, justifyContent: "flex-end" },
  bannerShade: { paddingHorizontal: 16, paddingVertical: 13, backgroundColor: "rgba(255, 255, 255, 0.84)", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(30, 54, 38, 0.12)" },
  businessName: {
    color: "#26382b",
    fontSize: 19,
    fontWeight: "800",
    marginBottom: 4,
  },
  bannerTitle: {
    color: "#58655b",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 5,
  },
  bannerDescription: { color: "#465249", fontSize: 11, lineHeight: 16 },
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
