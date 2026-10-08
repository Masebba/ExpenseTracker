import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { Button, Dialog, Portal, Text } from 'react-native-paper';
import {
  DEFAULT_TERMS_OF_SERVICE,
  subscribeToTermsOfService,
} from '../services/termsOfService';

export default function TermsOfServiceButton({ style }) {
  const { height: windowHeight } = useWindowDimensions();
  const [visible, setVisible] = useState(false);
  const [terms, setTerms] = useState({
    body: DEFAULT_TERMS_OF_SERVICE,
    updatedAt: null,
  });
  const [loadError, setLoadError] = useState('');

  useEffect(
    () =>
      subscribeToTermsOfService(
        (latestTerms) => {
          setTerms(latestTerms);
          setLoadError('');
        },
        (error) => {
          setLoadError(error?.message || 'The latest terms could not be loaded.');
        },
      ),
    [],
  );

  return (
    <>
      <Button
        mode="outlined"
        icon="text-box-check-outline"
        style={[styles.button, style]}
        onPress={() => setVisible(true)}
      >
        Terms of Service & Data
      </Button>
      <Portal>
        <Dialog
          visible={visible}
          onDismiss={() => setVisible(false)}
          style={[styles.dialog, { maxHeight: windowHeight - 48 }]}
        >
          <Dialog.Title>Terms of Service & Data</Dialog.Title>
          <Dialog.ScrollArea
            style={[styles.scrollArea, { maxHeight: Math.max(120, windowHeight - 220) }]}
          >
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator
            >
              <Text selectable style={styles.body}>{terms.body}</Text>
              {!!terms.updatedAt && (
                <Text style={styles.updatedAt}>
                  Updated {new Date(terms.updatedAt).toLocaleString()}
                </Text>
              )}
              {!!loadError && (
                <Text accessibilityRole="alert" style={styles.error}>
                  The latest terms could not be loaded: {loadError}
                </Text>
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setVisible(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: 8 },
  dialog: { borderRadius: 12, overflow: 'hidden' },
  scrollArea: { flexShrink: 1 },
  scrollContent: { paddingBottom: 12 },
  body: { lineHeight: 21 },
  updatedAt: { color: '#68756b', fontSize: 12, marginTop: 16 },
  error: { color: '#b3261e', fontSize: 12, marginTop: 12 },
});
