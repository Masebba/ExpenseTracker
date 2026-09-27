// AuthNavigator.js
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';

const AuthStack = createStackNavigator();

export default function AuthNavigator() {
    return (
        <AuthStack.Navigator initialRouteName="Login">
            <AuthStack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <AuthStack.Screen name="Signup" component={SignupScreen} options={{ headerShown: false }} />
            <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ headerShown: false }} />
        </AuthStack.Navigator>
    );
}
