import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';

const SALES_BARCODE_TYPES = [
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code128',
  'code39',
  'code93',
  'codabar',
  'itf14',
  'qr',
];

// On Android, removing a CameraView directly from its barcode callback can
// leave its Surface in an invalid state. Let the CameraView unmount first,
// then hand the value to the sale form on the next short UI turn.
const CAMERA_RELEASE_DELAY_MS = 250;

export default function SalesBarcodeScanner({ onScanned, onClose }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraKey, setCameraKey] = useState(0);
  const [capturedBarcode, setCapturedBarcode] = useState('');
  const scanHandledRef = useRef(false);

  const handleBarcode = useCallback((event) => {
    const value = String(event?.data || '').trim();
    if (!value || scanHandledRef.current || !cameraReady) return;

    // Stop rendering the camera before notifying the parent. This avoids
    // tearing down the Android camera surface during its own barcode event.
    scanHandledRef.current = true;
    setCameraReady(false);
    setCapturedBarcode(value);
  }, [cameraReady]);

  useEffect(() => {
    if (!capturedBarcode) return undefined;
    const timer = setTimeout(() => onScanned?.(capturedBarcode), CAMERA_RELEASE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [capturedBarcode, onScanned]);

  const handlePermissionRequest = async () => {
    setPermissionBusy(true);
    try {
      const result = await requestPermission();
      if (result?.granted) {
        setCameraError('');
        setCameraReady(false);
      } else {
        setCameraError('Camera permission was not granted. You can still enter a barcode manually in the sale form.');
      }
    } catch (error) {
      setCameraError(error?.message || 'Camera permission could not be requested. Check the app permission in Android settings.');
    } finally {
      setPermissionBusy(false);
    }
  };

  const retryCamera = () => {
    scanHandledRef.current = false;
    setCameraReady(false);
    setCameraError('');
    setCapturedBarcode('');
    setCameraKey((current) => current + 1);
  };

  const handleCameraMountError = (event) => {
    setCameraReady(false);
    setCameraError(String(
      event?.message
      || event?.nativeEvent?.message
      || 'The device camera could not be opened. Close other apps using the camera and retry.',
    ));
  };

  const cameraPermissionGranted = Boolean(permission?.granted);

  return (
    <Modal
      visible
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <StatusBar barStyle="light-content" backgroundColor="#080d0a" />
        <View style={styles.screen}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>Scan product barcode</Text>
              <Text style={styles.subtitle}>Scan an item from Inventory to add it to this sale</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close barcode scanner"
              hitSlop={10}
              onPress={onClose}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>

          <View style={styles.preview}>
            {!permission ? (
              <View style={styles.statePanel}>
                <ActivityIndicator color="#ffffff" size="large" />
                <Text style={styles.stateTitle}>Checking camera permission…</Text>
              </View>
            ) : !cameraPermissionGranted ? (
              <View style={styles.statePanel}>
                <Text style={styles.stateTitle}>Camera access is required</Text>
                <Text style={styles.stateMessage}>
                  Allow camera access to scan inventory barcodes. You can also close the scanner and enter the barcode manually.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={permissionBusy}
                  onPress={handlePermissionRequest}
                  style={[styles.primaryButton, permissionBusy && styles.buttonDisabled]}
                >
                  {permissionBusy
                    ? <ActivityIndicator color="#ffffff" />
                    : <Text style={styles.primaryButtonText}>Grant camera access</Text>}
                </Pressable>
              </View>
            ) : capturedBarcode ? (
              <View style={styles.statePanel}>
                <ActivityIndicator color="#ffffff" size="large" />
                <Text style={styles.stateTitle}>Barcode read</Text>
                <Text style={styles.stateMessage}>Adding the product to this sale…</Text>
              </View>
            ) : cameraError ? (
              <View style={styles.statePanel}>
                <Text style={styles.stateTitle}>Camera preview unavailable</Text>
                <Text style={styles.stateMessage}>{cameraError}</Text>
                <Pressable accessibilityRole="button" onPress={retryCamera} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Retry camera</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <CameraView
                  key={cameraKey}
                  style={StyleSheet.absoluteFillObject}
                  facing="back"
                  onCameraReady={() => {
                    setCameraReady(true);
                    setCameraError('');
                  }}
                  onMountError={handleCameraMountError}
                  barcodeScannerSettings={{ barcodeTypes: SALES_BARCODE_TYPES }}
                  onBarcodeScanned={cameraReady ? handleBarcode : undefined}
                />
                {!cameraReady && (
                  <View pointerEvents="none" style={styles.cameraLoading}>
                    <ActivityIndicator color="#ffffff" size="large" />
                    <Text style={styles.loadingText}>Opening camera…</Text>
                  </View>
                )}
                {cameraReady && (
                  <View pointerEvents="none" style={styles.scanGuideContainer}>
                    <View style={styles.scanGuide} />
                    <Text style={styles.guideText}>Place the barcode inside the frame</Text>
                  </View>
                )}
              </>
            )}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              The matching inventory product will be added to your current sale.
            </Text>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>Cancel scanning</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#080d0a' },
  screen: { flex: 1, minHeight: 0, backgroundColor: '#080d0a' },
  header: {
    minHeight: 76,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: '#101a14',
  },
  headerText: { flex: 1 },
  title: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  subtitle: { color: '#b7c5ba', fontSize: 12, marginTop: 4, lineHeight: 17 },
  closeButton: {
    minHeight: 40,
    minWidth: 58,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#52665a',
  },
  closeButtonText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
  preview: { flex: 1, minHeight: 0, position: 'relative', backgroundColor: '#000000', overflow: 'hidden' },
  cameraLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  loadingText: { color: '#ffffff', fontSize: 14, marginTop: 12 },
  scanGuideContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanGuide: {
    width: '78%',
    height: 155,
    borderWidth: 2,
    borderColor: '#ffffff',
    borderRadius: 14,
    backgroundColor: 'transparent',
  },
  guideText: {
    color: '#ffffff',
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.62)',
    fontSize: 13,
  },
  statePanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: '#111914',
  },
  stateTitle: { color: '#ffffff', fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 10 },
  stateMessage: { color: '#d0d9d2', fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 20 },
  primaryButton: {
    minHeight: 46,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: '#278653',
  },
  primaryButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  buttonDisabled: { opacity: 0.65 },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, backgroundColor: '#101a14' },
  footerText: { color: '#b7c5ba', fontSize: 12, lineHeight: 17, textAlign: 'center', marginBottom: 12 },
  cancelButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#65766b',
  },
  cancelButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
});
