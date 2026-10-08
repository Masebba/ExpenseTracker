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
} from "react-native";
import { Button, Card, Dialog, Portal, Text } from "react-native-paper";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { TransactionsContext } from "../TransactionsContext";
import { CurrencyContext } from "../CurrencyContext";
import { AppFeaturesContext } from "../AppFeaturesContext";
import { inPeriod, formatMoney, isValidHttpUrl, CONTENT_MAX_WIDTH, contentWidthStyle } from "../utils/appUtils";

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
  const { currency } = useContext(CurrencyContext);
  const { ads } = useContext(AppFeaturesContext);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [selectedAd, setSelectedAd] = useState(null);
  const [failedAdImages, setFailedAdImages] = useState({});
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
  const today = transactions.filter(
    (item) =>
      inPeriod(item.timestamp, "daily") &&
      (!item.currency || item.currency === currency?.code),
  );
  const income = today
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const expense = today
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

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
        style={styles.page}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Text style={styles.summaryTitle}>Today · {currency?.code || "UGX"}</Text>
            <View style={styles.metrics}>
              <View style={styles.metric}>
                <Text style={styles.metricCaption}>Income</Text>
                <Text numberOfLines={1} style={styles.income}>
                  {formatMoney(income, currency)}
                </Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricCaption}>Expenses</Text>
                <Text numberOfLines={1} style={styles.expense}>
                  {formatMoney(expense, currency)}
                </Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricCaption}>Net</Text>
                <Text numberOfLines={1} style={styles.net}>
                  {formatMoney(income - expense, currency)}
                </Text>
              </View>
            </View>
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
                style={[styles.shortcutIcon, { backgroundColor: item.color }]}
              >
                <MaterialCommunityIcons
                  name={item.icon}
                  size={28}
                  color="#315d3b"
                />
              </View>
              <Text style={styles.shortcutText}>{item.title}</Text>
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
              const imageKey = `${ad.id}:${ad.imageUrl}`;
              const hasImage = isValidHttpUrl(ad.imageUrl) && !failedAdImages[imageKey];
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
                      source={{ uri: ad.imageUrl }}
                      style={styles.bannerImage}
                      resizeMode="cover"
                      onError={() => setFailedAdImages((current) => ({ ...current, [imageKey]: true }))}
                    />
                    <View style={styles.bannerShade}>
                      <Text numberOfLines={1} style={styles.businessName}>
                        {ad.businessName}
                      </Text>
                      <Text numberOfLines={2} style={styles.bannerTitle}>
                        {ad.title}
                      </Text>
                      <Text numberOfLines={2} style={styles.bannerDescription}>
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
            style={styles.detailDialog}
          >
            {selectedAd?.imageUrl && isValidHttpUrl(selectedAd.imageUrl) ? (
              failedAdImages[`${selectedAd.id}:${selectedAd.imageUrl}`] ? (
                <View style={styles.detailImageFallback}><Text style={styles.bannerDescription}>Advert image unavailable.</Text></View>
              ) : (
                <Image
                  source={{ uri: selectedAd.imageUrl }}
                  style={styles.detailImage}
                  resizeMode="cover"
                  onError={() => setFailedAdImages((current) => ({ ...current, [`${selectedAd.id}:${selectedAd.imageUrl}`]: true }))}
                />
              )
            ) : null}
            <Dialog.Content>
              <Text style={styles.adDialogLabel}>Advertisement</Text>
              <Text style={styles.detailBusiness}>
                {selectedAd?.businessName}
              </Text>
              <Text style={styles.detailTitle}>{selectedAd?.title}</Text>
              <Text style={styles.detailDescription}>
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
  setupCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 12,
    elevation: 1,
  },
  setupTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#24432b",
    marginBottom: 6,
  },
  setupText: { fontSize: 13, color: "#536357", lineHeight: 19 },
  setupActions: { flexDirection: "row", flexWrap: "wrap", marginTop: 8 },
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
    marginBottom: 12,
  },
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
  bannerShade: { padding: 16, backgroundColor: "rgba(255, 255, 255, 0.84)" },
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
  detailImage: { width: "100%", height: 190 },
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
