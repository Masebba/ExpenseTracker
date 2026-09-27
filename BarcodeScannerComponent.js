import React, { useState } from 'react';
import { View, Text, StyleSheet, Button, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

export default function BarcodeScannerComponent({ onScanned }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  if (!permission) return <Text>Requesting camera permission...</Text>;
  if (!permission.granted) {
    return <View style={styles.center}><Text style={styles.permissionText}>Camera access is required to scan barcodes.</Text><Button title="Grant Camera Access" onPress={requestPermission} /></View>;
  }

  const handleBarcode = ({ data }) => {
    if (scanned) return;
    setScanned(true);
    if (data) onScanned(data);
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93', 'codabar', 'itf14', 'qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarcode}
      />
      {scanned && <Button title="Tap to Scan Again" onPress={() => setScanned(false)} />}
      <View style={styles.overlay}><Text style={styles.overlayText}>Point the camera at a barcode</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', backgroundColor: 'black' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  permissionText: { textAlign: 'center', marginBottom: 15 },
  overlay: { position: 'absolute', left: 20, right: 20, bottom: 40, padding: 12, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.55)' },
  overlayText: { color: 'white', textAlign: 'center' },
});
