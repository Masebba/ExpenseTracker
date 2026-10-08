// screens/SignupScreen.js
import React, { useState, useContext } from 'react';
import { StyleSheet, ScrollView, Image, TouchableOpacity, Alert } from 'react-native';
import { TextInput, Button, Text, Title } from 'react-native-paper';
import { AuthContext } from '../AuthContext';
import { currencyForRegion, detectDeviceRegion } from '../utils/appUtils';

export default function SignupScreen({ navigation }) {
  const { signUp, guestTransferError } = useContext(AuthContext);
  const [name, setName] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const detectedRegion = detectDeviceRegion();
  const regionCode = detectedRegion || 'UG';
  const detectedCurrency = currencyForRegion(regionCode);
  let regionName = regionCode;
  try {
    regionName = new Intl.DisplayNames(undefined, { type: 'region' }).of(regionCode) || regionCode;
  } catch {
    // Display the region code if localized region names are unavailable.
  }

  // State to control password visibility
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);

  const handleSignup = () => {
    const isValidEmail = (email) => {
      const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return regex.test(email);
    };

    if (!name.trim()) {
      Alert.alert('Name required', 'Enter your name to create an account.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Password too short', 'Use at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Passwords do not match');
      return;
    }
    const trimmedEmail = email.trim();
    if (!isValidEmail(trimmedEmail)) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    // Pass the display name and a default photo URL
    signUp(trimmedEmail, password, name, telephone)
      .catch((error) => {
        Alert.alert('Could not create account', error.message || 'Try again.');
      });
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Image source={require('../assets/logo.png')} style={styles.logo} />
      <Title style={styles.title}>Sign Up</Title>
      <TextInput label="Name" value={name} onChangeText={setName} style={styles.input} />
      <TextInput
        label="Telephone (Optional)"
        value={telephone}
        onChangeText={setTelephone}
        style={styles.input}
        keyboardType="phone-pad"
      />
      <Text style={styles.accountDataNote}>{detectedRegion ? `Detected region: ${regionName}` : `Region could not be detected; using ${regionName}`} · {detectedCurrency.code}. Currency and date/time follow this device’s region and time zone; no precise location access is used.</Text>
      <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        style={styles.input}
      />
      <TextInput
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!passwordVisible}
        style={styles.input}
        right={
          <TextInput.Icon
            name={passwordVisible ? "eye" : "eye-off"}
            onPress={() => setPasswordVisible(!passwordVisible)}
          />
        }
      />
      <TextInput
        label="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry={!confirmPasswordVisible}
        style={styles.input}
        right={
          <TextInput.Icon
            name={confirmPasswordVisible ? "eye" : "eye-off"}
            onPress={() => setConfirmPasswordVisible(!confirmPasswordVisible)}
          />
        }
      />
      <Button mode="contained" onPress={handleSignup} style={styles.button}>
        Sign Up
      </Button>
      <Text style={styles.accountDataNote}>If you started a guest ledger on this device, creating an account copies it into this account's local records. Existing account records with matching IDs are kept.</Text>
      {!!guestTransferError && <Text accessibilityRole="alert" style={styles.accountDataError}>{guestTransferError}</Text>}
      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.link}>Already have an account? Log In</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f4f6f3'
  },
  logo: {
    width: 100,
    height: 100,
    alignSelf: 'center',
    marginBottom: 14,
    borderRadius: 20
  },
  title: {
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 27,
    color: '#24432b'
  },
  input: {
    marginBottom: 15,
    backgroundColor: '#fff',
    borderRadius: 14
  },
  button: {
    marginVertical: 12,
    borderRadius: 24
  },
  link: {
    textAlign: 'center',
    color: '#2f7040',
    marginTop: 15
  },
  accountDataNote: { color: '#667268', textAlign: 'center', fontSize: 12, lineHeight: 18, marginTop: 4 },
  accountDataError: { color: '#b3261e', textAlign: 'center', fontSize: 12, lineHeight: 18, marginTop: 8 },
});
