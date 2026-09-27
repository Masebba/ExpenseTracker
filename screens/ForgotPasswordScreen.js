// screens/ForgotPasswordScreen.js
import React, { useState, useContext } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { TextInput, Button, Title, Text } from 'react-native-paper';
import { AuthContext } from '../AuthContext';

export default function ForgotPasswordScreen({ navigation }) {
    const { resetPassword } = useContext(AuthContext);
    const [email, setEmail] = useState('');

    const handleReset = () => {
        if (!email) {
            alert('Please enter your email address.');
            return;
        }
        resetPassword(email)
            .then(() => {
                alert('A password reset email has been sent.');
                navigation.navigate('Login');
            })
            .catch((error) => {
                alert(error.message);
            });
    };

    return (
        <View style={styles.container}>
            <Image source={require('../assets/logo.png')} style={styles.logo} />
            <Title style={styles.title}>Reset Password</Title>
            <TextInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                style={styles.input}
                autoCapitalize="none"
            />
            <Button mode="contained" onPress={handleReset} style={styles.button}>
                Send Reset Email
            </Button>
            <Text onPress={() => navigation.navigate('Login')} style={styles.link}>
                Back to Login
            </Text>
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
        marginBottom: 26,
        borderRadius: 22
    },
    title: {
        textAlign: 'center',
        marginBottom: 20
    },
    input: {
        marginBottom: 10,
        backgroundColor: '#fff',
        borderRadius: 14
    },
    button: {
        marginVertical: 10,
        borderRadius: 24
    },
    link: {
        color: 'blue',
        marginTop: 10,
        textAlign: 'center'
    },
});
