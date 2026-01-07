import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Alert,
    TouchableOpacity,
    Image,
    ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import CustomInput from '../components/CustomInput';
import CustomButton from '../components/CustomButton';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_URL from '../config';

const ProfileSetupScreen = () => {
    const navigation = useNavigation();

    // Image states
    const [frontImage, setFrontImage] = useState(null);
    const [backImage, setBackImage] = useState(null);

    // OCR result states
    const [ocrResult, setOcrResult] = useState(null);
    const [ocrLoading, setOcrLoading] = useState(false);

    // Contact info states
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');

    // OTP states
    const [otpSent, setOtpSent] = useState(false);
    const [otp, setOtp] = useState('');
    const [emailVerified, setEmailVerified] = useState(false);
    const [otpLoading, setOtpLoading] = useState(false);

    // Final submit loading
    const [submitLoading, setSubmitLoading] = useState(false);

    const pickImage = async (side) => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Please grant camera roll permissions to upload images.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [16, 10],
            quality: 0.8,
        });

        if (!result.canceled) {
            if (side === 'front') {
                setFrontImage(result.assets[0]);
            } else {
                setBackImage(result.assets[0]);
            }
            // Reset OCR result when new image is selected
            setOcrResult(null);
        }
    };

    const takePhoto = async (side) => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Please grant camera permissions to take photos.');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [16, 10],
            quality: 0.8,
        });

        if (!result.canceled) {
            if (side === 'front') {
                setFrontImage(result.assets[0]);
            } else {
                setBackImage(result.assets[0]);
            }
            setOcrResult(null);
        }
    };

    const showImageOptions = (side) => {
        Alert.alert(
            `Upload ${side === 'front' ? 'Front' : 'Back'} of CNIC`,
            'Choose an option',
            [
                { text: 'Camera', onPress: () => takePhoto(side) },
                { text: 'Gallery', onPress: () => pickImage(side) },
                { text: 'Cancel', style: 'cancel' },
            ]
        );
    };

    const uploadAndProcessImages = async () => {
        if (!frontImage || !backImage) {
            Alert.alert('Error', 'Please upload both front and back images of your CNIC');
            return;
        }

        setOcrLoading(true);
        try {
            // --- FRONTEND SIMULATION MODE (BYPASS BACKEND) ---
            console.log("SIMULATION MODE: Bypassing backend OCR to prevent server crash.");

            // Simulate network delay
            setTimeout(() => {
                const mockResult = {
                    match_success: true,
                    full_name: "Verified Citizen",
                    father_name: "Unknown",
                    date_of_birth: "01.01.2000",
                    gender: "Male",
                    cnic_extracted: "0000000000000"
                };

                setOcrResult(mockResult);
                setOcrLoading(false);
                Alert.alert('Success', 'CNIC verified successfully! (Simulation Mode)');
            }, 1500);

            // --- END SIMULATION ---

        } catch (e) {
            console.error('Upload error:', e);
            Alert.alert('Error', 'Could not connnect to server');
            setOcrLoading(false);
        }
    };

    const sendOTP = async () => {
        if (!email) {
            Alert.alert('Error', 'Please enter your email address');
            return;
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            Alert.alert('Error', 'Please enter a valid email address');
            return;
        }

        setOtpLoading(true);
        try {
            const token = await AsyncStorage.getItem('userToken');

            const response = await fetch(`${API_URL}/send-otp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ email }),
            });

            if (response.ok) {
                setOtpSent(true);
                Alert.alert('OTP Sent', `A verification code has been sent to ${email}`);
            } else {
                const errorData = await response.json();
                Alert.alert('Error', errorData.detail || 'Failed to send OTP');
            }
        } catch (e) {
            console.error('Send OTP error:', e);
            Alert.alert('Error', 'Could not connect to server');
        } finally {
            setOtpLoading(false);
        }
    };

    const verifyOTP = async () => {
        if (!otp || otp.length !== 6) {
            Alert.alert('Error', 'Please enter the 6-digit OTP');
            return;
        }

        setOtpLoading(true);
        try {
            const token = await AsyncStorage.getItem('userToken');

            const response = await fetch(`${API_URL}/verify-otp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ email, otp }),
            });

            if (response.ok) {
                setEmailVerified(true);
                Alert.alert('Success', 'Email verified successfully!');
            } else {
                const errorData = await response.json();
                Alert.alert('Error', errorData.detail || 'Invalid OTP');
            }
        } catch (e) {
            console.error('Verify OTP error:', e);
            Alert.alert('Error', 'Could not connect to server');
        } finally {
            setOtpLoading(false);
        }
    };

    const validatePhone = (value) => {
        const digitsOnly = value.replace(/\D/g, '');
        setPhone(digitsOnly.slice(0, 11));
    };

    const completeProfile = async () => {
        if (!emailVerified) {
            Alert.alert('Error', 'Please verify your email first');
            return;
        }

        if (!phone || phone.length < 10) {
            Alert.alert('Error', 'Please enter a valid phone number');
            return;
        }

        if (!ocrResult?.match_success) {
            Alert.alert('Error', 'Please upload and verify your CNIC images first');
            return;
        }

        setSubmitLoading(true);
        try {
            const token = await AsyncStorage.getItem('userToken');

            const response = await fetch(`${API_URL}/complete-profile`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ email, phone }),
            });

            if (response.ok) {
                Alert.alert('Success', 'Profile completed successfully!', [
                    {
                        text: 'Continue',
                        onPress: () => {
                            navigation.reset({
                                index: 0,
                                routes: [{ name: 'Dashboard' }],
                            });
                        },
                    },
                ]);
            } else {
                const errorData = await response.json();
                Alert.alert('Error', errorData.detail || 'Failed to complete profile');
            }
        } catch (e) {
            console.error('Complete profile error:', e);
            Alert.alert('Error', 'Could not connect to server');
        } finally {
            setSubmitLoading(false);
        }
    };

    const isStep1Complete = frontImage && backImage && ocrResult?.match_success;
    const isStep2Complete = emailVerified;

    return (
        <LinearGradient
            colors={['#0e1c26', '#122c45', '#1a4e7a']}
            style={styles.root}
        >
            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.container}>
                    <Text style={styles.title}>Complete Your Profile</Text>
                    <Text style={styles.subtitle}>Verify your identity to continue</Text>

                    {/* Progress Indicator */}
                    <View style={styles.progressContainer}>
                        <View style={[styles.progressStep, isStep1Complete && styles.progressStepComplete]}>
                            <Text style={styles.progressStepText}>1</Text>
                        </View>
                        <View style={[styles.progressLine, isStep1Complete && styles.progressLineComplete]} />
                        <View style={[styles.progressStep, isStep2Complete && styles.progressStepComplete]}>
                            <Text style={styles.progressStepText}>2</Text>
                        </View>
                        <View style={[styles.progressLine, isStep2Complete && styles.progressLineComplete]} />
                        <View style={[styles.progressStep, (isStep1Complete && isStep2Complete && phone.length >= 10) && styles.progressStepComplete]}>
                            <Text style={styles.progressStepText}>3</Text>
                        </View>
                    </View>

                    {/* Step 1: CNIC Images */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Step 1: Upload CNIC Images</Text>

                        <View style={styles.imageRow}>
                            <TouchableOpacity
                                style={styles.imageUploadBox}
                                onPress={() => showImageOptions('front')}
                            >
                                {frontImage ? (
                                    <Image source={{ uri: frontImage.uri }} style={styles.uploadedImage} />
                                ) : (
                                    <>
                                        <Text style={styles.uploadIcon}>📷</Text>
                                        <Text style={styles.uploadText}>Front</Text>
                                    </>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.imageUploadBox}
                                onPress={() => showImageOptions('back')}
                            >
                                {backImage ? (
                                    <Image source={{ uri: backImage.uri }} style={styles.uploadedImage} />
                                ) : (
                                    <>
                                        <Text style={styles.uploadIcon}>📷</Text>
                                        <Text style={styles.uploadText}>Back</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>

                        {frontImage && backImage && !ocrResult && (
                            <CustomButton
                                text={ocrLoading ? "Processing..." : "Verify CNIC Images"}
                                onPress={uploadAndProcessImages}
                            />
                        )}

                        {ocrLoading && (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#d9534f" />
                                <Text style={styles.loadingText}>Extracting information from CNIC...</Text>
                            </View>
                        )}

                        {/* OCR Result Display */}
                        {ocrResult && (
                            <View style={[styles.ocrResultBox, ocrResult.match_success ? styles.ocrSuccess : styles.ocrError]}>
                                <Text style={styles.ocrResultTitle}>
                                    {ocrResult.match_success ? '✅ CNIC Verified' : '❌ Verification Failed'}
                                </Text>
                                {ocrResult.match_success && (
                                    <>
                                        {ocrResult.full_name && (
                                            <Text style={styles.ocrResultText}>Name: {ocrResult.full_name}</Text>
                                        )}
                                        {ocrResult.father_name && (
                                            <Text style={styles.ocrResultText}>Father: {ocrResult.father_name}</Text>
                                        )}
                                        {ocrResult.date_of_birth && (
                                            <Text style={styles.ocrResultText}>DOB: {ocrResult.date_of_birth}</Text>
                                        )}
                                        {ocrResult.gender && (
                                            <Text style={styles.ocrResultText}>Gender: {ocrResult.gender}</Text>
                                        )}
                                    </>
                                )}
                            </View>
                        )}
                    </View>

                    {/* Step 2: Email Verification */}
                    <View style={[styles.section, !isStep1Complete && styles.sectionDisabled]}>
                        <Text style={styles.sectionTitle}>Step 2: Verify Email</Text>

                        <CustomInput
                            placeholder="Email Address"
                            value={email}
                            setValue={setEmail}
                            keyboardType="email-address"
                            editable={isStep1Complete && !emailVerified}
                        />

                        {!otpSent && !emailVerified && (
                            <CustomButton
                                text={otpLoading ? "Sending..." : "Send OTP"}
                                onPress={sendOTP}
                                disabled={!isStep1Complete}
                            />
                        )}

                        {otpSent && !emailVerified && (
                            <>
                                <CustomInput
                                    placeholder="Enter 6-digit OTP"
                                    value={otp}
                                    setValue={setOtp}
                                    keyboardType="numeric"
                                    maxLength={6}
                                />
                                <CustomButton
                                    text={otpLoading ? "Verifying..." : "Verify OTP"}
                                    onPress={verifyOTP}
                                />
                                <TouchableOpacity onPress={sendOTP} style={styles.resendLink}>
                                    <Text style={styles.resendText}>Resend OTP</Text>
                                </TouchableOpacity>
                            </>
                        )}

                        {emailVerified && (
                            <View style={styles.verifiedBadge}>
                                <Text style={styles.verifiedText}>✅ Email Verified</Text>
                            </View>
                        )}
                    </View>

                    {/* Step 3: Phone Number */}
                    <View style={[styles.section, !isStep2Complete && styles.sectionDisabled]}>
                        <Text style={styles.sectionTitle}>Step 3: Phone Number</Text>

                        <CustomInput
                            placeholder="Phone Number (03XXXXXXXXX)"
                            value={phone}
                            setValue={validatePhone}
                            keyboardType="phone-pad"
                            maxLength={11}
                            editable={isStep2Complete}
                        />
                    </View>

                    {/* Complete Button */}
                    <CustomButton
                        text={submitLoading ? "Completing..." : "Complete Profile"}
                        onPress={completeProfile}
                        disabled={!isStep1Complete || !isStep2Complete || phone.length < 10}
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
        padding: 20,
        paddingTop: 50,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#d9534f',
        textAlign: 'center',
        marginBottom: 5,
    },
    subtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
        marginBottom: 20,
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 30,
    },
    progressStep: {
        width: 35,
        height: 35,
        borderRadius: 17.5,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    progressStepComplete: {
        backgroundColor: '#28a745',
    },
    progressStepText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    progressLine: {
        width: 40,
        height: 3,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    progressLineComplete: {
        backgroundColor: '#28a745',
    },
    section: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 15,
        padding: 15,
        marginBottom: 20,
    },
    sectionDisabled: {
        opacity: 0.5,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 15,
    },
    imageRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 15,
    },
    imageUploadBox: {
        width: '48%',
        aspectRatio: 1.6,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 10,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    uploadIcon: {
        fontSize: 30,
        marginBottom: 5,
    },
    uploadText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
    },
    uploadedImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    loadingContainer: {
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        color: 'rgba(255,255,255,0.7)',
        marginTop: 10,
    },
    ocrResultBox: {
        padding: 15,
        borderRadius: 10,
        marginTop: 10,
    },
    ocrSuccess: {
        backgroundColor: 'rgba(40, 167, 69, 0.2)',
        borderWidth: 1,
        borderColor: '#28a745',
    },
    ocrError: {
        backgroundColor: 'rgba(220, 53, 69, 0.2)',
        borderWidth: 1,
        borderColor: '#dc3545',
    },
    ocrResultTitle: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
        marginBottom: 10,
    },
    ocrResultText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
        marginBottom: 3,
    },
    resendLink: {
        alignItems: 'center',
        marginTop: 10,
    },
    resendText: {
        color: '#FDB075',
        fontSize: 14,
    },
    verifiedBadge: {
        backgroundColor: 'rgba(40, 167, 69, 0.2)',
        padding: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    verifiedText: {
        color: '#28a745',
        fontWeight: 'bold',
    },
});

export default ProfileSetupScreen;
