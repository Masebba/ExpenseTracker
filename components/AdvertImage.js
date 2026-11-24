import React from 'react';
import { ImageBackground, StyleSheet } from 'react-native';

/** Shared remote-image renderer for the Home advert card and its detail view. */
export default function AdvertImage({ uri, style, imageStyle, resizeMode = 'cover', onLoad, onError, children }) {
  if (!uri) return null;
  return (
    <ImageBackground
      source={{ uri }}
      style={[styles.frame, style]}
      imageStyle={[styles.image, imageStyle]}
      resizeMode={resizeMode}
      onLoad={onLoad}
      onError={onError}
    >
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', height: '100%', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
});
