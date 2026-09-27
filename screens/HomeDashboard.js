import React, { useContext, useEffect, useRef, useState } from 'react';
import { Alert, Dimensions, ImageBackground, Linking, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Card, Dialog, Portal, Text } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { TransactionsContext } from '../TransactionsContext';
import { CurrencyContext } from '../CurrencyContext';
import { AppFeaturesContext } from '../AppFeaturesContext';
import { inPeriod, formatMoney } from '../utils/appUtils';

const shortcuts = [
  { title: 'Trade', icon: 'cart-outline', screen: 'PoSNavigator', color: '#e7f1e8' },
  { title: 'Income', icon: 'cash-plus', screen: 'Income', color: '#e2f2e9' },
  { title: 'Expense', icon: 'cash-minus', screen: 'Expense', color: '#f9e9e5' },
  { title: 'Account', icon: 'wallet-outline', screen: 'MyAccount', color: '#eceafa' },
  { title: 'Convert', icon: 'currency-usd', screen: 'Converter', color: '#e8eef8' },
  { title: 'Budget', icon: 'chart-donut', screen: 'Budget', color: '#f5eddf' },
];

export default function HomeDashboard({ navigation }) {
  const { transactions } = useContext(TransactionsContext);
  const { currency } = useContext(CurrencyContext);
  const { ads } = useContext(AppFeaturesContext);
  const [selectedAd, setSelectedAd] = useState(null);
  const carousel = useRef(null);
  const slideIndex = useRef(0);
  const bannerWidth = Math.max(280, Dimensions.get('window').width - 32);
  const visibleAds = ads.filter((ad) => ad.active && ad.publisherType === 'developer');
  const today = transactions.filter((item) => inPeriod(item.timestamp, 'daily'));
  const income = today.filter((item) => item.type === 'income').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const expense = today.filter((item) => item.type === 'expense').reduce((sum, item) => sum + Number(item.amount || 0), 0);

  useEffect(() => {
    slideIndex.current = 0;
    carousel.current?.scrollTo({ x: 0, animated: false });
    if (visibleAds.length < 2) return undefined;
    const timer = setInterval(() => {
      slideIndex.current = (slideIndex.current + 1) % visibleAds.length;
      carousel.current?.scrollTo({ x: slideIndex.current * (bannerWidth + 12), animated: true });
    }, 5000);
    return () => clearInterval(timer);
  }, [visibleAds.length, bannerWidth]);

  const visitBusiness = () => {
    const url = selectedAd?.linkUrl;
    if (!url) { setSelectedAd(null); return; }
    Linking.openURL(url).catch(() => Alert.alert('Link unavailable', 'This business link could not be opened.'));
  };

  return <ScrollView style={styles.page} contentContainerStyle={styles.container}>
    <Card style={styles.summaryCard}>
      <Card.Content>
        <Text style={styles.summaryTitle}>Today</Text>
        <View style={styles.metrics}>
          <View style={styles.metric}><Text style={styles.metricCaption}>Income</Text><Text numberOfLines={1} style={styles.income}>{formatMoney(income, currency)}</Text></View>
          <View style={styles.metric}><Text style={styles.metricCaption}>Expenses</Text><Text numberOfLines={1} style={styles.expense}>{formatMoney(expense, currency)}</Text></View>
          <View style={styles.metric}><Text style={styles.metricCaption}>Net</Text><Text numberOfLines={1} style={styles.net}>{formatMoney(income - expense, currency)}</Text></View>
        </View>
      </Card.Content>
    </Card>

    <View style={styles.actions}>
      {shortcuts.map((item) => <TouchableOpacity key={item.title} style={styles.shortcut} onPress={() => navigation.navigate(item.screen)} accessibilityRole="button">
        <View style={[styles.shortcutIcon, { backgroundColor: item.color }]}><MaterialCommunityIcons name={item.icon} size={28} color="#315d3b" /></View>
        <Text style={styles.shortcutText}>{item.title}</Text>
      </TouchableOpacity>)}
    </View>

    {!!visibleAds.length && <ScrollView ref={carousel} horizontal pagingEnabled snapToInterval={bannerWidth + 12} decelerationRate="fast" onMomentumScrollEnd={(event) => { slideIndex.current = Math.round(event.nativeEvent.contentOffset.x / (bannerWidth + 12)); }} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselContent}>
      {visibleAds.map((ad) => <TouchableOpacity key={ad.id} activeOpacity={0.94} onPress={() => setSelectedAd(ad)} style={[styles.banner, { width: bannerWidth }]}>
        {ad.imageUrl ? <ImageBackground source={{ uri: ad.imageUrl }} imageStyle={styles.bannerImage} style={styles.bannerImageBackground}>
          <View style={styles.bannerShade}><Text numberOfLines={1} style={styles.businessName}>{ad.businessName}</Text><Text numberOfLines={2} style={styles.bannerTitle}>{ad.title}</Text><Text numberOfLines={2} style={styles.bannerDescription}>{ad.description}</Text></View>
        </ImageBackground> : <View style={styles.bannerFallback}><Text style={styles.businessName}>{ad.businessName}</Text><Text style={styles.bannerTitle}>{ad.title}</Text><Text style={styles.bannerDescription}>{ad.description}</Text></View>}
      </TouchableOpacity>)}
    </ScrollView>}

    <Portal><Dialog visible={!!selectedAd} onDismiss={() => setSelectedAd(null)} style={styles.detailDialog}>
      {selectedAd?.imageUrl ? <ImageBackground source={{ uri: selectedAd.imageUrl }} style={styles.detailImage} imageStyle={styles.detailImageRadius} /> : null}
      <Dialog.Content>
        <Text style={styles.detailBusiness}>{selectedAd?.businessName}</Text>
        <Text style={styles.detailTitle}>{selectedAd?.title}</Text>
        <Text style={styles.detailDescription}>{selectedAd?.description}</Text>
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={() => setSelectedAd(null)}>Close</Button>
        {!!selectedAd?.linkUrl && <Button mode="contained" onPress={visitBusiness}>Visit business</Button>}
      </Dialog.Actions>
    </Dialog></Portal>
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f4f6f3' }, container: { paddingHorizontal: 18, paddingTop: 30, paddingBottom: 120 },
  summaryCard: { backgroundColor: '#fff', borderRadius: 18, marginBottom: 14, elevation: 1 }, summaryTitle: { color: '#526557', fontSize: 12, fontWeight: '700', marginBottom: 12 }, metrics: { flexDirection: 'row', justifyContent: 'space-between' }, metric: { flex: 1, paddingRight: 4 }, metricCaption: { fontSize: 11, color: '#758078', marginBottom: 5 }, income: { fontSize: 13, fontWeight: '700', color: '#267a46' }, expense: { fontSize: 13, fontWeight: '700', color: '#bd4936' }, net: { fontSize: 13, fontWeight: '700', color: '#23432b' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', paddingVertical: 7, marginBottom: 13 }, shortcut: { width: '33.333%', alignItems: 'center', gap: 6, paddingVertical: 12 }, shortcutIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' }, shortcutText: { color: '#34463a', fontSize: 13, fontWeight: '600' },
  carouselContent: { gap: 12 }, banner: { height: Math.max(125, Math.min(170, Math.round(Dimensions.get('window').height * 0.2))), borderRadius: 18, overflow: 'hidden', backgroundColor: '#31563a', elevation: 2 }, bannerImageBackground: { flex: 1, justifyContent: 'flex-end' }, bannerImage: { resizeMode: 'cover' }, bannerShade: { padding: 16, backgroundColor: 'rgba(0,0,0,0.42)' }, businessName: { color: '#e2f2e4', fontSize: 11, fontWeight: '700', marginBottom: 4 }, bannerTitle: { color: '#fff', fontSize: 21, fontWeight: '800', marginBottom: 5 }, bannerDescription: { color: '#f5f7f5', fontSize: 13, lineHeight: 19 }, bannerFallback: { flex: 1, justifyContent: 'center', padding: 20 },
  detailDialog: { borderRadius: 20, overflow: 'hidden' }, detailImage: { width: '100%', height: 190 }, detailImageRadius: { resizeMode: 'cover' }, detailBusiness: { color: '#55725a', fontWeight: '700', fontSize: 13, marginBottom: 7 }, detailTitle: { fontSize: 21, fontWeight: '800', color: '#243c2a', marginBottom: 10 }, detailDescription: { color: '#49564c', fontSize: 15, lineHeight: 22 },
});
