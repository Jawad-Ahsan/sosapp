import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import CustomButton from '../components/CustomButton';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_URL from '../config';

const PendingApprovalScreen = () => {
    const navigation = useNavigation();
    const [checking, setChecking] = useState(false);
    const [approvalStatus, setApprovalStatus] = useState('pending');

    const checkApprovalStatus = async () => {
        setChecking(true);
        try {
            const token = await AsyncStorage.getItem('userToken');
            const response = await fetch(`${API_URL}/check-approval`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setApprovalStatus(data.approval_status);

                if (data.approval_status === 'approved') {
                    navigation.reset({
                        index: 0,
                        routes: [{ name: 'PoliceDashboard' }],
                    });
                } else if (data.approval_status === 'rejected') {
                    setApprovalStatus('rejected');
                }
            }
        } catch (e) {
            console.error("Error checking approval:", e);
        } finally {
            setChecking(false);
        }
    };

    const handleLogout = async () => {
        await AsyncStorage.removeItem('userToken');
        await AsyncStorage.removeItem('userCnic');
        await AsyncStorage.removeItem('userType');
        await AsyncStorage.removeItem('approvalStatus');

        navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
        });
    };

    // Check status periodically
    useEffect(() => {
        checkApprovalStatus();
        const interval = setInterval(checkApprovalStatus, 30000); // Check every 30 seconds
        return () => clearInterval(interval);
    }, []);

    return (
        <LinearGradient
            colors={['#0e1c26', '#122c45', '#1a4e7a']}
            style={styles.root}
        >
            <View style={styles.container}>
                {approvalStatus === 'pending' ? (
                    <>
                        <Text style={styles.icon}>⏳</Text>
                        <Text style={styles.title}>Pending Admin Approval</Text>
                        <Text style={styles.description}>
                            Your police officer account is currently being reviewed by an administrator.
                        </Text>
                        <Text style={styles.description}>
                            This process typically takes 24-48 hours. You will be able to access the police dashboard once approved.
                        </Text>

                        <View style={styles.statusBox}>
                            <Text style={styles.statusLabel}>Current Status:</Text>
                            <Text style={styles.statusValue}>🟡 Pending Review</Text>
                        </View>

                        <CustomButton
                            text={checking ? "Checking..." : "Check Status"}
                            onPress={checkApprovalStatus}
                            type="SECONDARY"
                        />
                    </>
                ) : approvalStatus === 'rejected' ? (
                    <>
                        <Text style={styles.icon}>❌</Text>
                        <Text style={styles.title}>Application Rejected</Text>
                        <Text style={styles.description}>
                            Unfortunately, your police officer application has been rejected.
                        </Text>
                        <Text style={styles.description}>
                            Please contact support if you believe this is an error or to submit additional verification documents.
                        </Text>

                        <View style={[styles.statusBox, styles.rejectedBox]}>
                            <Text style={styles.statusLabel}>Status:</Text>
                            <Text style={[styles.statusValue, styles.rejectedText]}>🔴 Rejected</Text>
                        </View>
                    </>
                ) : null}

                <CustomButton
                    text="Log Out"
                    onPress={handleLogout}
                    type="TERTIARY"
                />
            </View>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 30,
    },
    icon: {
        fontSize: 80,
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 20,
    },
    description: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
        marginBottom: 15,
        lineHeight: 24,
    },
    statusBox: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        padding: 20,
        borderRadius: 15,
        marginVertical: 25,
        width: '100%',
        alignItems: 'center',
    },
    rejectedBox: {
        backgroundColor: 'rgba(255,0,0,0.1)',
    },
    statusLabel: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.6)',
        marginBottom: 5,
    },
    statusValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#ffc107',
    },
    rejectedText: {
        color: '#ff6b6b',
    },
});

export default PendingApprovalScreen;
