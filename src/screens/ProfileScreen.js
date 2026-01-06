import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Alert,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import CustomInput from '../components/CustomInput';
import CustomButton from '../components/CustomButton';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_URL from '../config';

const ProfileScreen = () => {
    const navigation = useNavigation();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState(null);
    const [editMode, setEditMode] = useState(false);

    // Editable fields
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const token = await AsyncStorage.getItem('userToken');
            if (!token) {
                navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                return;
            }

            const response = await fetch(`${API_URL}/profile`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setProfile(data);
                setFullName(data.full_name || '');
                setPhone(data.phone || '');
                setAddress(data.address || '');
            } else if (response.status === 401) {
                await AsyncStorage.removeItem('userToken');
                navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
            } else {
                Alert.alert('Error', 'Failed to load profile');
            }
        } catch (e) {
            console.error('Fetch profile error:', e);
            Alert.alert('Error', 'Could not connect to server');
        } finally {
            setLoading(false);
        }
    };

    const saveProfile = async () => {
        setSaving(true);
        try {
            const token = await AsyncStorage.getItem('userToken');

            const response = await fetch(`${API_URL}/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    full_name: fullName || null,
                    phone: phone || null,
                    address: address || null,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                setProfile(data);
                setEditMode(false);
                Alert.alert('Success', 'Profile updated successfully');
            } else {
                const errorData = await response.json();
                Alert.alert('Error', errorData.detail || 'Failed to update profile');
            }
        } catch (e) {
            console.error('Save profile error:', e);
            Alert.alert('Error', 'Could not connect to server');
        } finally {
            setSaving(false);
        }
    };

    const validatePhone = (value) => {
        const digitsOnly = value.replace(/\D/g, '');
        setPhone(digitsOnly.slice(0, 11));
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-PK', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
            });
        } catch {
            return dateString;
        }
    };

    const formatCNIC = (cnic) => {
        if (!cnic || cnic.length !== 13) return cnic || 'N/A';
        return `${cnic.slice(0, 5)}-${cnic.slice(5, 12)}-${cnic.slice(12)}`;
    };

    if (loading) {
        return (
            <LinearGradient
                colors={['#0e1c26', '#122c45', '#1a4e7a']}
                style={styles.root}
            >
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#d9534f" />
                    <Text style={styles.loadingText}>Loading profile...</Text>
                </View>
            </LinearGradient>
        );
    }

    return (
        <LinearGradient
            colors={['#0e1c26', '#122c45', '#1a4e7a']}
            style={styles.root}
        >
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Text style={styles.backButtonText}>← Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>My Profile</Text>
                    <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => setEditMode(!editMode)}
                    >
                        <Text style={styles.editButtonText}>
                            {editMode ? 'Cancel' : 'Edit'}
                        </Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.container}>
                    {/* Avatar Section */}
                    <View style={styles.avatarSection}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>👤</Text>
                        </View>
                        <Text style={styles.userName}>{profile?.full_name || 'User'}</Text>
                        <View style={styles.verifiedBadge}>
                            <Text style={styles.verifiedText}>
                                {profile?.email_verified ? '✅ Verified' : '⚠️ Not Verified'}
                            </Text>
                        </View>
                    </View>

                    {/* CNIC Info (Read-only) */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>CNIC Information</Text>

                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>CNIC Number</Text>
                            <Text style={styles.infoValue}>{formatCNIC(profile?.cnic)}</Text>
                        </View>

                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Father's Name</Text>
                            <Text style={styles.infoValue}>{profile?.father_name || 'N/A'}</Text>
                        </View>

                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Date of Birth</Text>
                            <Text style={styles.infoValue}>{formatDate(profile?.date_of_birth)}</Text>
                        </View>

                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Gender</Text>
                            <Text style={styles.infoValue}>{profile?.gender || 'N/A'}</Text>
                        </View>
                    </View>

                    {/* Editable Information */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Personal Information</Text>

                        {editMode ? (
                            <>
                                <Text style={styles.inputLabel}>Full Name</Text>
                                <CustomInput
                                    placeholder="Full Name"
                                    value={fullName}
                                    setValue={setFullName}
                                />

                                <Text style={styles.inputLabel}>Phone Number</Text>
                                <CustomInput
                                    placeholder="Phone Number"
                                    value={phone}
                                    setValue={validatePhone}
                                    keyboardType="phone-pad"
                                    maxLength={11}
                                />

                                <Text style={styles.inputLabel}>Address</Text>
                                <CustomInput
                                    placeholder="Address"
                                    value={address}
                                    setValue={setAddress}
                                    multiline
                                />
                            </>
                        ) : (
                            <>
                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Full Name</Text>
                                    <Text style={styles.infoValue}>{profile?.full_name || 'N/A'}</Text>
                                </View>

                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Phone</Text>
                                    <Text style={styles.infoValue}>{profile?.phone || 'N/A'}</Text>
                                </View>

                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Address</Text>
                                    <Text style={styles.infoValue}>{profile?.address || 'N/A'}</Text>
                                </View>
                            </>
                        )}
                    </View>

                    {/* Contact Information (Read-only) */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Contact Information</Text>

                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Email</Text>
                            <View style={styles.infoValueRow}>
                                <Text style={styles.infoValue}>{profile?.email || 'N/A'}</Text>
                                {profile?.email_verified && (
                                    <Text style={styles.verifiedIcon}>✅</Text>
                                )}
                            </View>
                        </View>
                    </View>

                    {/* Save Button */}
                    {editMode && (
                        <CustomButton
                            text={saving ? "Saving..." : "Save Changes"}
                            onPress={saveProfile}
                        />
                    )}
                </View>
            </ScrollView>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        color: 'rgba(255,255,255,0.7)',
        marginTop: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 10,
    },
    backButton: {
        padding: 5,
    },
    backButtonText: {
        color: '#fff',
        fontSize: 16,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    editButton: {
        padding: 5,
    },
    editButtonText: {
        color: '#FDB075',
        fontSize: 16,
    },
    container: {
        padding: 20,
    },
    avatarSection: {
        alignItems: 'center',
        marginBottom: 25,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 15,
    },
    avatarText: {
        fontSize: 50,
    },
    userName: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 5,
    },
    verifiedBadge: {
        backgroundColor: 'rgba(40, 167, 69, 0.2)',
        paddingHorizontal: 15,
        paddingVertical: 5,
        borderRadius: 15,
    },
    verifiedText: {
        color: '#28a745',
        fontSize: 12,
    },
    section: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 15,
        padding: 15,
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#d9534f',
        marginBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        paddingBottom: 10,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    infoLabel: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 14,
        flex: 1,
    },
    infoValue: {
        color: '#fff',
        fontSize: 14,
        flex: 2,
        textAlign: 'right',
    },
    infoValueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 2,
        justifyContent: 'flex-end',
    },
    verifiedIcon: {
        marginLeft: 5,
    },
    inputLabel: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        marginBottom: 5,
        marginTop: 10,
    },
});

export default ProfileScreen;
