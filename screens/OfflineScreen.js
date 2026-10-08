import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Title, Text, Card } from 'react-native-paper';
import { RECORD_SYNC_STATUS } from '../services/storagePolicy';

export default function OfflineScreen() {
  return <View style={styles.container}>
    <Title>Offline & Sync</Title>
    <Card style={styles.card}><Card.Content>
      <Text style={styles.status}>Local persistence is enabled</Text>
      <Text>Transactions, products, sales, orders, categories and currency preferences are saved on this device so the app can continue working across restarts.</Text>
      <Text style={styles.note}>{RECORD_SYNC_STATUS} Cloud failures do not erase local data. Export a backup before uninstalling or changing devices.</Text>
    </Card.Content></Card>
  </View>;
}
const styles = StyleSheet.create({ container: { flex: 1, paddingHorizontal: 20, paddingTop: 32, paddingBottom: 112, backgroundColor: '#f4f6f3' }, card: { marginTop: 15, padding: 8, borderRadius: 16, backgroundColor: '#fff' }, status: { fontWeight: 'bold', marginBottom: 10 }, note: { marginTop: 12, color: '#666' } });
