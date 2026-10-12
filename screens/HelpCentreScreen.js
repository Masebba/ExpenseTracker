import React, { useMemo, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, View, KeyboardAvoidingView, Platform } from 'react-native';
import { Button, Card, List, Text, TextInput, Title } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { contentWidthStyle } from '../utils/appUtils';

const SUPPORT_EMAIL = 'syndicatearchives@gmail.com';
const faqs = [
  {
    id: 'transactions',
    question: 'How do I record an income or expense?',
    answer: 'Open the Income or Expense section from Home, enter the amount and details, then save. Your records are available from Transactions and contribute to reports.',
  },
  {
    id: 'reports',
    question: 'Why is a report amount different from my transaction amount?',
    answer: 'Reports use your selected base currency. Existing transaction amounts are not changed when you update the base currency.',
  },
  {
    id: 'business-invoice',
    question: 'Where do I add my business details for invoices?',
    answer: 'Open Workspaces and select Personal to manage personal invoice details. For a company or organisation, select that workspace and edit its invoice and organisation details.',
  },
  {
    id: 'organisation',
    question: 'How do I create or join an organisation?',
    answer: 'Open Workspaces and create a company or organisation. To join one, ask its owner or admin to invite the email address you use to sign in, then accept the invitation in Workspaces.',
  },
  {
    id: 'backup',
    question: 'How do I back up or restore my data?',
    answer: 'Open Settings to export your data or restore/import a backup. On Android, Settings also lets you connect an external folder for backups.',
  },
  {
    id: 'offline',
    question: 'Can I use the app offline?',
    answer: 'Your records are saved on this device by default. Account and workspace features that sync through Firebase may require an internet connection.',
  },
  {
    id: 'delete-account',
    question: 'How do I delete my account?',
    answer: 'Use “Delete account and personal data” in Settings. If you own an organisation, transfer its ownership or delete it before deleting your account.',
  },
];

export default function HelpCentreScreen() {
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const filteredFaqs = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return faqs;
    return faqs.filter(({ question, answer }) => `${question} ${answer}`.toLocaleLowerCase().includes(query));
  }, [search]);

  const contactSupport = async () => {
    const subject = encodeURIComponent('FinanceTracker support request');
    const body = encodeURIComponent('Please describe your question or issue:\n\n\nApp version: 1.0.0');
    try {
      await Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
    } catch {
      Alert.alert('Could not open email', `Please email ${SUPPORT_EMAIL} from your preferred mail app.`);
    }
  };

  return <SafeAreaView edges={['top']} style={styles.safeArea}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.pageHeader}><Title style={styles.title}>Help Centre</Title></View>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Text style={styles.intro}>Search common questions or contact our support team.</Text>
        <TextInput
          label="Search help"
          value={search}
          onChangeText={setSearch}
          mode="outlined"
          left={<TextInput.Icon icon="magnify" />}
          clearButtonMode="while-editing"
          style={styles.search}
        />
        <Card style={styles.card}>
          <Card.Title title="Frequently asked questions" />
          {filteredFaqs.map(({ id, question, answer }) => <List.Accordion
            key={id}
            title={question}
            expanded={expandedId === id}
            onPress={() => setExpandedId((current) => current === id ? null : id)}
            titleNumberOfLines={3}
            style={styles.accordion}
          >
            <Text style={styles.answer}>{answer}</Text>
          </List.Accordion>)}
          {!filteredFaqs.length && <Card.Content><Text style={styles.empty}>No matching questions. Try another search or contact support.</Text></Card.Content>}
        </Card>
        <Card style={styles.card}>
          <Card.Title title="Still need help?" subtitle="Email our support team and tell us how we can help." />
          <Card.Content>
            <Button mode="contained" icon="email-outline" onPress={contactSupport}>Contact support</Button>
            <Text selectable style={styles.email}>{SUPPORT_EMAIL}</Text>
          </Card.Content>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#2f7040' },
  pageHeader: { paddingHorizontal: 18, paddingVertical: 10, backgroundColor: '#2f7040' },
  title: { color: '#ffffff', fontSize: 22, margin: 0 },
  container: { ...contentWidthStyle, flexGrow: 1, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 28, backgroundColor: '#f4f6f3' },
  intro: { color: '#647168', lineHeight: 21, marginBottom: 8 },
  search: { backgroundColor: '#ffffff', marginBottom: 14 },
  card: { marginBottom: 14, borderRadius: 16, backgroundColor: '#ffffff', elevation: 1 },
  accordion: { backgroundColor: '#ffffff' },
  answer: { color: '#526157', lineHeight: 21, paddingHorizontal: 16, paddingBottom: 14 },
  empty: { color: '#647168', lineHeight: 21 },
  email: { color: '#647168', textAlign: 'center', marginTop: 10 },
});
