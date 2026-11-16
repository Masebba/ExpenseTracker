import { registerRootComponent } from 'expo';

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_STORAGE_KEY = 'expenseTracker.uiTheme';

class StartupErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, darkThemeRecovery: false };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('[Startup] App initialization failed:', error);
    // Last-resort recovery for failures that happen before the in-app theme
    // boundary can recover. If the saved appearance was dark, persist light
    // mode so the next launch is not trapped in the same startup failure.
    try {
      AsyncStorage.getItem(THEME_STORAGE_KEY)
        .then((savedMode) => {
          if (savedMode === 'dark') {
            return AsyncStorage.setItem(THEME_STORAGE_KEY, 'light')
              .then(() => this.setState({ darkThemeRecovery: true }));
          }
          return undefined;
        })
        .catch((recoveryError) => console.warn('[Startup] Could not reset saved appearance:', recoveryError?.message || recoveryError));
    } catch (recoveryError) {
      console.warn('[Startup] Could not begin appearance recovery:', recoveryError?.message || recoveryError);
    }
  }

  render() {
    if (this.state.error) {
      const message = String(this.state.error?.message || 'The app could not start.');
      const missingFirebaseConfig = message.includes('[Firebase] Missing required config keys');
      const safeDiagnostic = String(this.state.error?.name || 'Error') + ': ' + message
        .replace(/(apiKey|token|password|secret|authorization)\s*[:=]\s*[^\s,]+/gi, '$1=[hidden]')
        .replace(/https?:\/\/[^\s]+/gi, '[URL hidden]')
        .slice(0, 220);
      return (
        <View style={styles.container}>
          <Text style={styles.title}>FinanceTracker could not start</Text>
          <Text style={styles.body}>
            {missingFirebaseConfig
              ? 'Firebase configuration is missing from this build. Create a .env file with the EXPO_PUBLIC_FIREBASE_* values (see .env.example) and rebuild the app.'
              : this.state.darkThemeRecovery
                ? 'The saved dark appearance caused a startup problem. FinanceTracker has switched back to light mode. Close and reopen the app.'
                : 'FinanceTracker could not finish starting. Please close and reopen the app. If this continues, contact support and share the diagnostic below.'}
          </Text>
          {!missingFirebaseConfig && (
            <Text selectable style={styles.debugDetails}>
              Diagnostic: {safeDiagnostic || 'No error message was provided.'}
            </Text>
          )}
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#f4f6f3' },
  title: { fontSize: 20, fontWeight: '800', color: '#24432b', marginBottom: 12, textAlign: 'center' },
  body: { fontSize: 14, color: '#4a584d', lineHeight: 21, textAlign: 'center' },
  debugDetails: { fontSize: 12, color: '#7a3028', lineHeight: 18, marginTop: 14, textAlign: 'left', width: '100%' },
});

function AppLoader() {
  // Load the app module inside the boundary. Static imports execute before
  // React mounts, which means initialization errors cannot be caught there.
  const App = require('./App').default;
  return <App />;
}

function Root() {
  return (
    <StartupErrorBoundary>
      <AppLoader />
    </StartupErrorBoundary>
  );
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(Root);

