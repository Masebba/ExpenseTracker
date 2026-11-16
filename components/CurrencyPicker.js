import React, { useContext, useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { Alert, Button, Modal, Portal, Text, TextInput } from 'react-native-paper';
import { CURRENCY_CODES, currencyFromCode } from '../utils/appUtils';
import { ThemeContext } from '../ThemeContext';

export default function CurrencyPicker({ value, onChange, label = 'Currency' }) {
  const { palette } = useContext(ThemeContext);
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const currencies = useMemo(() => CURRENCY_CODES
    .filter((code) => code.toLowerCase().includes(query.trim().toLowerCase()))
    .map((code) => currencyFromCode(code)), [query]);
  const selected = currencyFromCode(value);

  return <>
    <Button mode="outlined" onPress={() => { setQuery(''); setVisible(true); }} accessibilityLabel={`${label}: ${selected.code}`}>
      {label}: {selected.code}
    </Button>
    <Portal>
      <Modal visible={visible} onDismiss={() => setVisible(false)} contentContainerStyle={{ backgroundColor: palette.surface, margin: 20, padding: 16, borderRadius: 14, maxHeight: '80%' }}>
        <Text variant="titleMedium" style={{ color: palette.text }}>{label}</Text>
        <TextInput dense mode="outlined" label="Search currency code" value={query} onChangeText={setQuery} style={{ marginVertical: 10, backgroundColor: palette.input }} />
        <FlatList
          data={currencies}
          keyExtractor={(item) => item.code}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => <Button onPress={async () => { try { await onChange(item.code); setVisible(false); } catch (error) { Alert.alert('Could not save currency', error?.message || 'Check device storage and try again.'); } }}>{item.code} · {item.symbol}</Button>}
          ListEmptyComponent={<Text style={{ color: palette.textMuted }}>No matching currencies.</Text>}
        />
        <View><Button onPress={() => setVisible(false)}>Cancel</Button></View>
      </Modal>
    </Portal>
  </>;
}
