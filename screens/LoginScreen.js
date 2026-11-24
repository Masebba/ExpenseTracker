import { userFacingError } from '../utils/userFacingErrors';
// screens/LoginScreen.js
import React, { useState, useContext } from 'react';
import { ScrollView, StyleSheet, Image, Alert } from 'react-native';
import { TextInput, Button, Title, Text } from 'react-native-paper';
import { AuthContext } from '../AuthContext';
import { ThemeContext } from '../ThemeContext';

export default function LoginScreen({ navigation }) {
  const { signIn, startGuestMode, guestTransferError } = useContext(AuthContext);
  const { palette } = useContext(ThemeContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = () => {
    signIn(email, password)
      .then((userCredential) => {
        return userCredential;
      })
      .catch((error) => {
        Alert.alert('Could not sign in', userFacingError(error, 'Check your details and try again.'));
      });
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: palette.background }]} keyboardShouldPersistTaps="handled">
      <Image source={require('../assets/logo.png')} style={styles.logo} />
      <Title style={[styles.title, { color: palette.text }]}>Login</Title>
      <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        style={[styles.input, { backgroundColor: palette.surface }]}
        autoCapitalize="none"
      />
      <TextInput
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!showPassword}
        style={[styles.input, { backgroundColor: palette.surface }]}
        right={
          <TextInput.Icon
            icon={showPassword ? 'eye-off' : 'eye'}
            onPress={() => setShowPassword(!showPassword)}
            color={palette.text}
            forceTextInputFocus={false}
          />
        }
      />
      <Button mode="contained" onPress={handleLogin} style={styles.button}>
        Login
      </Button>
      <Text onPress={() => navigation.navigate('ForgotPassword')} style={[styles.link, { color: palette.primary }]} >
        Forgot Password?
      </Text>
      <Text onPress={() => navigation.navigate('Signup')} style={[styles.link, { color: palette.primary }]} >
        Don't have an account? Sign Up
      </Text>
      {!!guestTransferError && <Text accessibilityRole="alert" style={styles.transferError}>{guestTransferError}</Text>}
      <Button mode="outlined" onPress={() => startGuestMode().catch((error) => Alert.alert('Could not start local mode', userFacingError(error, 'Please check your details and try again.')))} style={styles.guestButton}>
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
    color: '#267F4D',
    marginTop: 10,
    textAlign: 'center'
  },
  guestCopy: { color: '#667268', textAlign: 'center', fontSize: 12, lineHeight: 18, marginTop: 22 },
  transferError: { color: '#b3261e', textAlign: 'center', fontSize: 12, lineHeight: 18, marginTop: 8 },
  guestButton: { marginTop: 8, borderRadius: 22 },
});
