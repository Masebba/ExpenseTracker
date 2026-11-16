import React, { useContext } from 'react';
import { View, StyleSheet } from 'react-native';
import { Title, Text, Card } from 'react-native-paper';
import { RECORD_SYNC_STATUS } from '../services/storagePolicy';
import { ThemeContext } from '../ThemeContext';

export default function OfflineScreen() {
  const { palette } = useContext(ThemeContext);
  return <View style={[styles.container, { backgroundColor: palette.background }]}>
    <Title style={{ color: palette.text }}>Offline access and backups</Title>
    <Card style={[styles.card, { backgroundColor: palette.surface }]}><Card.Content>
      <Text style={[styles.status, { color: palette.text }]}>Available offline on this device</Text>
      <Text style={{ color: palette.text }}>Transactions, products, sales, orders, categories and currency preferences are saved on this device so the app can continue working across restarts.</Text>
      <Text style={[styles.note, { color: palette.textMuted }]}>{RECORD_SYNC_STATUS} No live cloud synchronization of ledger records is active in this release. A local copy is not a separate backup. Export your records regularly or connect an external folder from Settings before changing phones or uninstalling.</Text>
    </Card.Content></Card>
  </View>;
}
const styles = StyleSheet.create({ container: { flex: 1, paddingHorizontal: 20, paddingTop: 32, paddingBottom: 112, backgroundColor: '#f4f6f3' }, card: { marginTop: 15, padding: 8, borderRadius: 16, backgroundColor: '#fff' }, status: { fontWeight: 'bold', marginBottom: 10 }, note: { marginTop: 12, color: '#666' } });
