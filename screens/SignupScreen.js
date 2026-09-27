// screens/SignupScreen.js
import React, { useState, useContext } from 'react';
import { StyleSheet, View, Image, TouchableOpacity } from 'react-native';
import { TextInput, Button, Text, Title } from 'react-native-paper';
import { AuthContext } from '../AuthContext';

export default function SignupScreen({ navigation }) {
  const { signUp } = useContext(AuthContext);
  const [name, setName] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // State to control password visibility
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);

  const handleSignup = () => {
    const isValidEmail = (email) => {
      const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return regex.test(email);
    };

    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    const trimmedEmail = email.trim();
    if (!isValidEmail(trimmedEmail)) {
      alert('Please enter a valid email address');
      return;
    }
    // Pass the display name and a default photo URL
    signUp(trimmedEmail, password, name, telephone)
      .then((userCredential) => {
        console.log('Registered with:', userCredential.user.email);
      })
      .catch((error) => {
        alert(error.message);
      });
  };

  return (
    <View style={styles.container}>
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
      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.link}>Already have an account? Log In</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
});
