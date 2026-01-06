import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, Modal, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import CustomInput from '../components/CustomInput';
import CustomButton from '../components/CustomButton';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_URL from '../config';

const LoginScreen = () => {
    const [cnic, setCnic] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [cnicError, setCnicError] = useState('');
    const [userType, setUserType] = useState('citizen'); // 'citizen' or 'police'

    // Admin modal state
    const [adminModalVisible, setAdminModalVisible] = useState(false);
    const [adminCnic, setAdminCnic] = useState('');
    const [adminPassword, setAdminPassword] = useState('');

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

    const onSignInPressed = async () => {
        if (loading) return;

        if (cnic.length !== 13) {
            Alert.alert("Error", "CNIC must be exactly 13 digits");
            return;
        }

        setLoading(true);
        try {
            console.log("Sending Login Request to:", `${API_URL}/login`);
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    cnic: cnic,
                    password: password,
                    user_type: userType,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                console.log("Login Success:", data);

                // Store JWT token and user info
                await AsyncStorage.setItem('userToken', data.access_token);
                await AsyncStorage.setItem('userCnic', cnic);
                await AsyncStorage.setItem('userType', data.user_type);
                await AsyncStorage.setItem('approvalStatus', data.approval_status);

                // Handle navigation based on user type and status
                if (data.user_type === 'police') {
                    if (data.approval_status === 'pending') {
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'PendingApproval' }],
                        });
                    } else if (data.approval_status === 'rejected') {
                        Alert.alert("Account Rejected", "Your police officer application has been rejected. Please contact support.");
                    } else if (!data.profile_complete) {
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'PoliceProfileSetup' }],
                        });
                    } else {
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'PoliceDashboard' }],
                        });
                    }
                } else if (data.user_type === 'admin') {
                    navigation.reset({
                        index: 0,
                        routes: [{ name: 'AdminDashboard' }],
                    });
                } else {
                    // Citizen
                    if (data.profile_complete) {
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'Dashboard' }],
                        });
                    } else {
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'ProfileSetup' }],
                        });
                    }
                }
            } else {
                const errorData = await response.json();
                Alert.alert("Login Failed", errorData.detail || "Something went wrong");
            }
        } catch (e) {
            Alert.alert("Error", "Could not connect to server");
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const onForgotPasswordPressed = () => {
        Alert.alert("Info", "Please contact support to reset your password");
    };

    const onSignUpPressed = () => {
        navigation.navigate('SignUp', { userType });
    };

    const onAdminLoginPressed = async () => {
        if (!adminCnic || adminCnic.length !== 13) {
            Alert.alert("Error", "Please enter a valid 13-digit CNIC");
            return;
        }
        if (!adminPassword) {
            Alert.alert("Error", "Please enter password");
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cnic: adminCnic,
                    password: adminPassword,
                    user_type: 'admin',
                }),
            });

            if (response.ok) {
                const data = await response.json();
                await AsyncStorage.setItem('userToken', data.access_token);
                await AsyncStorage.setItem('userCnic', adminCnic);
                await AsyncStorage.setItem('userType', 'admin');

                setAdminModalVisible(false);
                setAdminCnic('');
                setAdminPassword('');

                navigation.reset({
                    index: 0,
                    routes: [{ name: 'AdminDashboard' }],
                });
            } else {
                const errorData = await response.json();
                Alert.alert("Login Failed", errorData.detail || "Invalid admin credentials");
            }
        } catch (e) {
            Alert.alert("Error", "Could not connect to server");
        } finally {
            setLoading(false);
        }
    };

    return (
        <LinearGradient
            colors={['#0e1c26', '#122c45', '#1a4e7a']}
            style={styles.root}
        >
            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.container}>
                    <Text style={styles.title}>SOS APP</Text>
                    <Text style={styles.subtitle}>Police & Emergency Services</Text>

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
                    </View>

                    <CustomInput
                        placeholder="Password"
                        value={password}
                        setValue={setPassword}
                        secureTextEntry
                    />

                    <CustomButton
                        text={loading ? "Logging in..." : `Log In as ${userType === 'citizen' ? 'Citizen' : 'Police Officer'}`}
                        onPress={onSignInPressed}
                    />

                    <CustomButton
                        text="Forgot Password?"
                        onPress={onForgotPasswordPressed}
                        type="TERTIARY"
                    />

                    <CustomButton
                        text="Don't have an account? Sign up"
                        onPress={onSignUpPressed}
                        type="TERTIARY"
                    />

                    <TouchableOpacity
                        onPress={() => setAdminModalVisible(true)}
                        style={styles.adminLink}
                    >
                        <Text style={styles.adminLinkText}>🛡️ Admin Access</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* Admin Login Modal */}
            <Modal
                visible={adminModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setAdminModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>🛡️ Admin Login</Text>

                        <TextInput
                            style={styles.modalInput}
                            placeholder="Admin CNIC (13 digits)"
                            placeholderTextColor="#666"
                            value={adminCnic}
                            onChangeText={(val) => setAdminCnic(val.replace(/\D/g, '').slice(0, 13))}
                            keyboardType="numeric"
                            maxLength={13}
                        />

                        <TextInput
                            style={styles.modalInput}
                            placeholder="Password"
                            placeholderTextColor="#666"
                            value={adminPassword}
                            onChangeText={setAdminPassword}
                            secureTextEntry
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => {
                                    setAdminModalVisible(false);
                                    setAdminCnic('');
                                    setAdminPassword('');
                                }}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.loginButton}
                                onPress={onAdminLoginPressed}
                            >
                                <Text style={styles.loginButtonText}>
                                    {loading ? "Logging in..." : "Login"}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
        fontSize: 34,
        fontWeight: 'bold',
        color: '#d9534f',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 18,
        color: '#0056b3',
        marginBottom: 20,
        fontWeight: '600',
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
    errorText: {
        color: '#ff6b6b',
        fontSize: 12,
        marginTop: -10,
        marginBottom: 5,
        paddingLeft: 5,
    },
    adminLink: {
        marginTop: 30,
        padding: 10,
    },
    adminLinkText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#1a1a2e',
        borderRadius: 15,
        padding: 25,
        width: '100%',
        maxWidth: 350,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 20,
    },
    modalInput: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 10,
        padding: 15,
        color: '#fff',
        fontSize: 16,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    cancelButton: {
        flex: 1,
        padding: 15,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginRight: 10,
        alignItems: 'center',
    },
    cancelButtonText: {
        color: '#fff',
        fontSize: 16,
    },
    loginButton: {
        flex: 1,
        padding: 15,
        borderRadius: 10,
        backgroundColor: '#4CAF50',
        marginLeft: 10,
        alignItems: 'center',
    },
    loginButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default LoginScreen;
