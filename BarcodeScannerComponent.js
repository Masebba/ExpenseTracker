import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Button, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

export default function BarcodeScannerComponent({ onScanned, continuous = false, scanCooldownMs = 900 }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraKey, setCameraKey] = useState(0);
  const scanHandledRef = useRef(false);
  const releaseTimerRef = useRef(null);
  const lastContinuousReadRef = useRef({ value: '', timestamp: 0 });

  useEffect(() => () => {
    if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
  }, []);

  if (!permission) return <View style={styles.center}><Text>Checking camera permission…</Text></View>;
  if (!permission.granted) {
    return <View style={styles.center}>
      <Text style={styles.permissionText}>Camera access is needed to scan barcodes. You can still type the barcode manually.</Text>
      <Button title="Grant camera access" onPress={async () => {
        try { const result = await requestPermission(); if (!result.granted) Alert.alert('Camera access not granted', 'You can enter the barcode manually instead.'); }
        catch { Alert.alert('Camera permission unavailable', 'Check camera permissions in device settings.'); }
      }} />
    </View>;
  }

  const handleBarcode = ({ data }) => {
    const value = String(data || '').trim();
    if (scanHandledRef.current || !value) return;
    const now = Date.now();
    const duplicateWindow = Math.max(1500, Number(scanCooldownMs) + 500 || 0);
    if (continuous
      && lastContinuousReadRef.current.value === value
      && now - lastContinuousReadRef.current.timestamp < duplicateWindow) return;
    scanHandledRef.current = true;
    lastContinuousReadRef.current = { value, timestamp: now };
    setScanned(true);
    try {
      const callbackResult = onScanned?.(value);
      if (continuous) {
        Promise.resolve(callbackResult).catch((error) => {
          console.warn('Barcode scan callback failed:', error?.message || error);
        }).finally(() => {
          releaseTimerRef.current = setTimeout(() => {
            scanHandledRef.current = false;
            setScanned(false);
            releaseTimerRef.current = null;
          }, Math.max(300, Number(scanCooldownMs) || 900));
        });
      }
    } catch (error) {
      console.warn('Barcode scan callback failed:', error?.message || error);
      if (continuous) {
        releaseTimerRef.current = setTimeout(() => {
          scanHandledRef.current = false;
          setScanned(false);
          releaseTimerRef.current = null;
        }, Math.max(300, Number(scanCooldownMs) || 900));
      }
    }
  };

  const retryCamera = () => {
    scanHandledRef.current = false;
    lastContinuousReadRef.current = { value: '', timestamp: 0 };
    if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
    releaseTimerRef.current = null;
    setScanned(false);
    setCameraReady(false);
    setCameraError('');
    setCameraKey((value) => value + 1);
  };

  if (cameraError) return <View style={styles.center}>
    <Text style={styles.errorTitle}>Camera preview could not start</Text>
    <Text style={styles.permissionText}>{cameraError} Close other apps using the camera, then retry. You can cancel scanning and enter the barcode or select the product manually.</Text>
    <Button title="Retry camera" onPress={retryCamera} />
  </View>;

  return <View style={styles.container}>
    <CameraView
      key={cameraKey}
      style={styles.cameraPreview}
      facing="back"
      onCameraReady={() => { setCameraReady(true); setCameraError(''); }}
      onMountError={(event) => {
        setCameraReady(false);
        setCameraError(String(event?.message || event?.nativeEvent?.message || 'The device camera could not be opened.'));
      }}
      barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93', 'codabar', 'itf14', 'qr'] }}
      onBarcodeScanned={scanned ? undefined : handleBarcode}
    />
    {!cameraReady && <View pointerEvents="none" style={styles.cameraLoading}><Text style={styles.loadingText}>Opening camera…</Text></View>}
    <View pointerEvents="none" style={styles.overlay}><Text style={styles.overlayText}>Point the camera at a barcode</Text></View>
    {scanned && !continuous && <View style={styles.rescan}><Button title="Tap to scan again" onPress={retryCamera} /></View>}
    {scanned && continuous && <View pointerEvents="none" style={styles.rescan}><Text style={styles.nextScanText}>Item read… ready for the next item</Text></View>}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 300, justifyContent: 'center', backgroundColor: '#000', position: 'relative', overflow: 'hidden' },
  cameraPreview: { flex: 1, width: '100%', minHeight: 300 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  permissionText: { textAlign: 'center', marginBottom: 15, color: '#334237', lineHeight: 20 },
  errorTitle: { color: '#8b1e1e', fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  cameraLoading: { position: 'absolute', top: '45%', left: 0, right: 0, alignItems: 'center' },
  loadingText: { color: '#fff', paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8 },
  overlay: { position: 'absolute', left: 20, right: 20, bottom: 40, padding: 12, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.55)' },
  overlayText: { color: 'white', textAlign: 'center' },
  rescan: { position: 'absolute', bottom: 86, alignSelf: 'center', backgroundColor: '#fff', borderRadius: 6 },
  nextScanText: { color: '#173c24', paddingHorizontal: 12, paddingVertical: 8, fontWeight: '700' },
});
