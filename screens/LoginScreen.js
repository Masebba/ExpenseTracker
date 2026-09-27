// screens/LoginScreen.js
import React, { useState, useContext } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { TextInput, Button, Title, Text } from 'react-native-paper';
import { AuthContext } from '../AuthContext';

export default function LoginScreen({ navigation }) {
  const { signIn } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = () => {
    signIn(email, password)
      .then((userCredential) => {
        console.log("Logged in user:", userCredential.user);
      })
      .catch((error) => {
        alert(error.message);
      });
  };

  return (
    <View style={styles.container}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f4f6f3' },
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
});
