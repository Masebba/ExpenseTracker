// screens/LoginScreen.js
import React, { useState, useContext } from 'react';
import { ScrollView, StyleSheet, Image, Alert } from 'react-native';
import { TextInput, Button, Title, Text } from 'react-native-paper';
import { AuthContext } from '../AuthContext';

export default function LoginScreen({ navigation }) {
  const { signIn, startGuestMode, guestTransferError } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = () => {
    signIn(email, password)
      .then((userCredential) => {
        return userCredential;
      })
      .catch((error) => {
        Alert.alert('Could not sign in', error.message || 'Check your details and try again.');
      });
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Image source={require('../assets/logo.png')} style={styles.logo} />
      <Title style={styles.title}>Login</Title>
      <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        autoCapitalize="none"
      />
      <TextInput
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!showPassword}
        style={styles.input}
        right={
          <TextInput.Icon
            name={showPassword ? 'eye-off' : 'eye'}
            onPress={() => setShowPassword(!showPassword)}
            color="#000"
          />
        }
      />
      <Button mode="contained" onPress={handleLogin} style={styles.button}>
        Login
      </Button>
      <Text onPress={() => navigation.navigate('ForgotPassword')} style={styles.link}>
        Forgot Password?
      </Text>
      <Text onPress={() => navigation.navigate('Signup')} style={styles.link}>
        Don't have an account? Sign Up
      </Text>
      <Text style={styles.guestCopy}>You can use a personal ledger without creating an account. Records stay on this device unless you export or back them up.</Text>
      <Text style={styles.guestCopy}>If you started a guest ledger on this device, signing in copies it into this account's local records. Existing account records with matching IDs are kept.</Text>
      {!!guestTransferError && <Text accessibilityRole="alert" style={styles.transferError}>{guestTransferError}</Text>}
      <Button mode="outlined" onPress={() => startGuestMode().catch((error) => Alert.alert('Could not start local mode', error.message || 'Try again.'))} style={styles.guestButton}>
        Continue without an account
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f4f6f3' },
  logo: {
    width: 100,
    height: 100,
    alignSelf: 'center',
    marginBottom: 26,
    borderRadius: 22,
  },
  title: {
    textAlign: 'center',
    marginBottom: 24,
    fontSize: 27,
    color: '#24432b',
  },
  input: {
    marginBottom: 14,
    backgroundColor: '#fff',
  },
  button: {
    marginVertical: 14,
    borderRadius: 24,
  },
  link: {
    color: '#2f7040',
    marginTop: 10,
    textAlign: 'center'
  },
  guestCopy: { color: '#667268', textAlign: 'center', fontSize: 12, lineHeight: 18, marginTop: 22 },
  transferError: { color: '#b3261e', textAlign: 'center', fontSize: 12, lineHeight: 18, marginTop: 8 },
  guestButton: { marginTop: 8, borderRadius: 22 },
});
