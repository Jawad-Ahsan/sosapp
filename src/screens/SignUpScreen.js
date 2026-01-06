import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import CustomInput from '../components/CustomInput';
import CustomButton from '../components/CustomButton';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import API_URL from '../config';

const SignUpScreen = () => {
    const route = useRoute();
    const initialUserType = route.params?.userType || 'citizen';

    const [cnic, setCnic] = useState('');
    const [password, setPassword] = useState('');
    const [passwordRepeat, setPasswordRepeat] = useState('');
    const [badgeNumber, setBadgeNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [cnicError, setCnicError] = useState('');
    const [userType, setUserType] = useState(initialUserType);

    const navigation = useNavigation();

    const validateCnic = (value) => {
        const digitsOnly = value.replace(/\D/g, '');
        const limitedValue = digitsOnly.slice(0, 13);
        setCnic(limitedValue);

        if (limitedValue.length > 0 && limitedValue.length < 13) {
            setCnicError('CNIC must be exactly 13 digits');
        } else {
            setCnicError('');
        }
    };

    const onRegisterPressed = async () => {
        if (loading) return;

        // Validate CNIC
        if (cnic.length !== 13) {
            Alert.alert("Error", "CNIC must be exactly 13 digits");
            return;
        }

        if (password !== passwordRepeat) {
            Alert.alert("Error", "Passwords do not match");
            return;
        }

        if (password.length < 6) {
            Alert.alert("Error", "Password must be at least 6 characters");
            return;
        }

        // Validate badge number for police
        if (userType === 'police' && badgeNumber.length < 3) {
            Alert.alert("Error", "Badge number must be at least 3 characters");
            return;
        }

        setLoading(true);
        try {
            // Use different endpoint for police
            const endpoint = userType === 'police' ? '/signup/police' : '/signup';
            const requestBody = userType === 'police'
                ? { cnic, password, badge_number: badgeNumber }
                : { cnic, password, user_type: 'citizen' };

            console.log("Sending Signup Request to:", `${API_URL}${endpoint}`);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);
            console.log("Response status:", response.status);

            if (response.ok) {
                const data = await response.json();
                console.log("Signup Success:", data);

                // Store JWT token and user info
                await AsyncStorage.setItem('userToken', data.access_token);
                await AsyncStorage.setItem('userCnic', cnic);
                await AsyncStorage.setItem('userType', data.user_type);
                await AsyncStorage.setItem('approvalStatus', data.approval_status);

                // Navigate based on user type
                if (data.user_type === 'police') {
                    // Police officers go to police profile setup
                    navigation.reset({
                        index: 0,
                        routes: [{ name: 'PoliceProfileSetup' }],
                    });
                } else {
                    // Citizens go to regular profile setup
                    navigation.reset({
                        index: 0,
                        routes: [{ name: 'ProfileSetup' }],
                    });
                }
            } else {
                const errorData = await response.json();
                console.log("Signup Error:", errorData);
                Alert.alert("Registration Failed", errorData.detail || "Something went wrong");
            }
        } catch (e) {
            if (e.name === 'AbortError') {
                Alert.alert("Timeout", "Server is not responding. Check if backend is running.");
            } else {
                Alert.alert("Error", "Could not connect to server: " + e.message);
            }
            console.error("Signup error:", e);
        } finally {
            setLoading(false);
        }
    };

    const onSignInPressed = () => {
        navigation.navigate('Login');
    };

    return (
        <LinearGradient
            colors={['#0e1c26', '#122c45', '#1a4e7a']}
            style={styles.root}
        >
            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.container}>
                    <Text style={styles.title}>Create Account</Text>
                    <Text style={styles.subtitle}>
                        Register as {userType === 'citizen' ? 'Citizen' : 'Police Officer'}
                    </Text>

                    {/* User Type Toggle */}
                    <View style={styles.toggleContainer}>
                        <TouchableOpacity
                            style={[
                                styles.toggleButton,
                                userType === 'citizen' && styles.toggleButtonActive
                            ]}
                            onPress={() => setUserType('citizen')}
                        >
                            <Text style={[
                                styles.toggleText,
                                userType === 'citizen' && styles.toggleTextActive
                            ]}>
                                👤 Citizen
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.toggleButton,
                                userType === 'police' && styles.toggleButtonActive
                            ]}
                            onPress={() => setUserType('police')}
                        >
                            <Text style={[
                                styles.toggleText,
                                userType === 'police' && styles.toggleTextActive
                            ]}>
                                🚔 Police Officer
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.inputWrapper}>
                        <CustomInput
                            placeholder="CNIC (13 digits)"
                            value={cnic}
                            setValue={validateCnic}
                            keyboardType="numeric"
                            maxLength={13}
                        />
                        {cnicError ? (
                            <Text style={styles.errorText}>{cnicError}</Text>
                        ) : null}
                        <Text style={styles.helperText}>
                            Enter your 13-digit CNIC number without dashes
                        </Text>
                    </View>

                    {/* Badge Number - Only for Police */}
                    {userType === 'police' && (
                        <View style={styles.inputWrapper}>
                            <CustomInput
                                placeholder="Police Badge Number"
                                value={badgeNumber}
                                setValue={setBadgeNumber}
                            />
                            <Text style={styles.helperText}>
                                Enter your official police badge/ID number
                            </Text>
                        </View>
                    )}

                    <CustomInput
                        placeholder="Password"
                        value={password}
                        setValue={setPassword}
                        secureTextEntry
                    />
                    <CustomInput
                        placeholder="Confirm Password"
                        value={passwordRepeat}
                        setValue={setPasswordRepeat}
                        secureTextEntry
                    />

                    <CustomButton
                        text={loading ? "Creating Account..." : `Sign Up as ${userType === 'citizen' ? 'Citizen' : 'Police Officer'}`}
                        onPress={onRegisterPressed}
                    />

                    {userType === 'police' && (
                        <Text style={styles.policeNote}>
                            ⚠️ Police accounts require admin approval before access is granted.
                        </Text>
                    )}

                    <Text style={styles.text}>
                        By registering, you confirm that you accept our{' '}
                        <Text style={styles.link} onPress={() => console.warn('Terms')}>Terms of Use</Text> and{' '}
                        <Text style={styles.link} onPress={() => console.warn('Privacy')}>Privacy Policy</Text>
                    </Text>

                    <CustomButton
                        text="Already have an account? Log in"
                        onPress={onSignInPressed}
                        type="TERTIARY"
                    />
                </View>
            </ScrollView>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    container: {
        alignItems: 'center',
        padding: 20,
        paddingTop: 50,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#d9534f',
        margin: 10,
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.7)',
        marginBottom: 20,
    },
    toggleContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 25,
        padding: 4,
        marginBottom: 25,
        width: '100%',
    },
    toggleButton: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 22,
        alignItems: 'center',
    },
    toggleButtonActive: {
        backgroundColor: '#fff',
    },
    toggleText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        fontWeight: '600',
    },
    toggleTextActive: {
        color: '#1a4e7a',
    },
    inputWrapper: {
        width: '100%',
        marginBottom: 5,
    },
    helperText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        marginTop: -10,
        marginBottom: 10,
        paddingLeft: 5,
    },
    errorText: {
        color: '#ff6b6b',
        fontSize: 12,
        marginTop: -10,
        marginBottom: 5,
        paddingLeft: 5,
    },
    policeNote: {
        color: '#ffc107',
        fontSize: 13,
        textAlign: 'center',
        marginVertical: 10,
        paddingHorizontal: 20,
    },
    text: {
        color: 'gray',
        marginVertical: 10,
        textAlign: 'center',
    },
    link: {
        color: '#FDB075',
    },
});

export default SignUpScreen;
