import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Citizen Screens
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
import DashboardScreen from '../screens/DashboardScreen';
import HistoryScreen from '../screens/HistoryScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AlertDetailScreen from '../screens/AlertDetailScreen';

// Police Screens
import PoliceProfileSetupScreen from '../screens/PoliceProfileSetupScreen';
import PendingApprovalScreen from '../screens/PendingApprovalScreen';
import PoliceDashboardScreen from '../screens/PoliceDashboardScreen';
import PoliceHistoryScreen from '../screens/PoliceHistoryScreen';

// Admin Screens
import AdminDashboardScreen from '../screens/AdminDashboardScreen';

// Chat Screen
import ChatScreen from '../screens/ChatScreen';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {/* Auth Screens */}
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="SignUp" component={SignUpScreen} />

                {/* Citizen Screens */}
                <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
                <Stack.Screen name="Dashboard" component={DashboardScreen} />
                <Stack.Screen name="History" component={HistoryScreen} />
                <Stack.Screen name="AlertDetail" component={AlertDetailScreen} />
                <Stack.Screen name="Profile" component={ProfileScreen} />

                {/* Police Screens */}
                <Stack.Screen name="PoliceProfileSetup" component={PoliceProfileSetupScreen} />
                <Stack.Screen name="PendingApproval" component={PendingApprovalScreen} />
                <Stack.Screen name="PoliceDashboard" component={PoliceDashboardScreen} />
                <Stack.Screen name="PoliceHistory" component={PoliceHistoryScreen} />

                {/* Admin Screens */}
                <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />

                {/* Chat Screen */}
                <Stack.Screen name="Chat" component={ChatScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default AppNavigator;
