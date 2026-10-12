import { registerRootComponent } from 'expo';

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

class StartupErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      const message = String(this.state.error?.message || 'The app could not start.');
      const missingFirebaseConfig = message.includes('[Firebase] Missing required config keys');
      return (
        <View style={styles.container}>
          <Text style={styles.title}>FinanceTracker could not start</Text>
          <Text style={styles.body}>
            {missingFirebaseConfig
              ? 'Firebase configuration is missing from this build. Create a .env file with the EXPO_PUBLIC_FIREBASE_* values (see .env.example) and rebuild the app.'
              : message}
          </Text>
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

