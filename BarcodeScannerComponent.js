import React, { useState } from 'react';
import { View, Text, StyleSheet, Button, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

export default function BarcodeScannerComponent({ onScanned }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

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
    if (scanned || !data) return;
    setScanned(true);
    onScanned(data);
  };

  return <View style={styles.container}>
    <CameraView
      style={styles.cameraPreview}
      facing="back"
      active={!scanned}
      onCameraReady={() => setCameraReady(true)}
      onMountError={() => { setCameraReady(false); Alert.alert('Camera could not start', 'Close other apps using the camera, then retry or enter the barcode manually.'); }}
      barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93', 'codabar', 'itf14', 'qr'] }}
      onBarcodeScanned={scanned ? undefined : handleBarcode}
    />
    {!cameraReady && <View pointerEvents="none" style={styles.cameraLoading}><Text style={styles.loadingText}>Opening camera…</Text></View>}
    <View pointerEvents="none" style={styles.overlay}><Text style={styles.overlayText}>Point the camera at a barcode</Text></View>
    {scanned && <View style={styles.rescan}><Button title="Tap to scan again" onPress={() => { setScanned(false); setCameraReady(false); }} /></View>}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 300, justifyContent: 'center', backgroundColor: '#000', position: 'relative', overflow: 'hidden' },
  cameraPreview: { flex: 1, width: '100%', minHeight: 300 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  permissionText: { textAlign: 'center', marginBottom: 15, color: '#334237', lineHeight: 20 },
  cameraLoading: { position: 'absolute', top: '45%', left: 0, right: 0, alignItems: 'center' },
  loadingText: { color: '#fff', paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8 },
  overlay: { position: 'absolute', left: 20, right: 20, bottom: 40, padding: 12, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.55)' },
  overlayText: { color: 'white', textAlign: 'center' },
  rescan: { position: 'absolute', bottom: 86, alignSelf: 'center', backgroundColor: '#fff', borderRadius: 6 },
});
