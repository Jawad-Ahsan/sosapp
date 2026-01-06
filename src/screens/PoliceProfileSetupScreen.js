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

const PoliceProfileSetupScreen = () => {
    const navigation = useNavigation();

    // Step tracking
    const [currentStep, setCurrentStep] = useState(1);

    // CNIC Images
    const [cnicFrontImage, setCnicFrontImage] = useState(null);
    const [cnicBackImage, setCnicBackImage] = useState(null);

    // Police ID Images
    const [policeIdFrontImage, setPoliceIdFrontImage] = useState(null);
    const [policeIdBackImage, setPoliceIdBackImage] = useState(null);

    // Profile data (from OCR)
    const [fullName, setFullName] = useState('');
    const [fatherName, setFatherName] = useState('');
    const [dateOfBirth, setDateOfBirth] = useState('');
    const [gender, setGender] = useState('');
    const [address, setAddress] = useState('');

    // Contact info
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [policeStation, setPoliceStation] = useState('');
    const [policeRank, setPoliceRank] = useState('');

    // OTP
    const [otp, setOtp] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [emailVerified, setEmailVerified] = useState(false);

    // Loading states
    const [loading, setLoading] = useState(false);
    const [uploadingCnic, setUploadingCnic] = useState(false);
    const [uploadingPoliceId, setUploadingPoliceId] = useState(false);

    const pickImage = async (setImage) => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    const takePhoto = async (setImage) => {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
            Alert.alert("Permission Required", "Camera permission is needed to take photos");
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    const showImageOptions = (setImage) => {
        Alert.alert(
            "Select Image",
            "Choose an option",
            [
                { text: "Camera", onPress: () => takePhoto(setImage) },
                { text: "Gallery", onPress: () => pickImage(setImage) },
                { text: "Cancel", style: "cancel" }
            ]
        );
    };

    const uploadCnicImages = async () => {
        if (!cnicFrontImage || !cnicBackImage) {
            Alert.alert("Error", "Please upload both front and back of your CNIC");
            return;
        }

        setUploadingCnic(true);
        try {
            const token = await AsyncStorage.getItem('userToken');
            const formData = new FormData();

            formData.append('front_image', {
                uri: cnicFrontImage,
                type: 'image/jpeg',
                name: 'cnic_front.jpg',
            });
            formData.append('back_image', {
                uri: cnicBackImage,
                type: 'image/jpeg',
                name: 'cnic_back.jpg',
            });

            const response = await fetch(`${API_URL}/upload-cnic-images`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: formData,
            });

            if (response.ok) {
                const data = await response.json();
                if (data.match_success) {
                    setFullName(data.full_name || '');
                    setFatherName(data.father_name || '');
                    setDateOfBirth(data.date_of_birth || '');
                    setGender(data.gender || '');
                    setAddress(data.address || '');
                    Alert.alert("Success", "CNIC verified successfully!");
                    setCurrentStep(2);
                } else {
                    Alert.alert("Verification Failed", "CNIC number does not match. Please try again.");
                }
            } else {
                const error = await response.json();
                Alert.alert("Error", error.detail || "Failed to process CNIC images");
            }
        } catch (e) {
            Alert.alert("Error", "Could not upload images");
            console.error(e);
        } finally {
            setUploadingCnic(false);
        }
    };

    const uploadPoliceIdImages = async () => {
        if (!policeIdFrontImage || !policeIdBackImage) {
            Alert.alert("Error", "Please upload both front and back of your Police ID");
            return;
        }

        setUploadingPoliceId(true);
        try {
            const token = await AsyncStorage.getItem('userToken');
            const formData = new FormData();

            formData.append('front_image', {
                uri: policeIdFrontImage,
                type: 'image/jpeg',
                name: 'police_id_front.jpg',
            });
            formData.append('back_image', {
                uri: policeIdBackImage,
                type: 'image/jpeg',
                name: 'police_id_back.jpg',
            });

            const response = await fetch(`${API_URL}/upload-police-id`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: formData,
            });

            if (response.ok) {
                Alert.alert("Success", "Police ID uploaded successfully!");
                setCurrentStep(3);
            } else {
                const error = await response.json();
                Alert.alert("Error", error.detail || "Failed to upload Police ID");
            }
        } catch (e) {
            Alert.alert("Error", "Could not upload Police ID");
            console.error(e);
        } finally {
            setUploadingPoliceId(false);
        }
    };

    const sendOTP = async () => {
        if (!email || !email.includes('@')) {
            Alert.alert("Error", "Please enter a valid email address");
            return;
        }

        setLoading(true);
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
                Alert.alert("OTP Sent", `Verification code sent to ${email}`);
            } else {
                const error = await response.json();
                Alert.alert("Error", error.detail || "Failed to send OTP");
            }
        } catch (e) {
            Alert.alert("Error", "Could not send OTP");
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const verifyOTP = async () => {
        if (!otp || otp.length !== 6) {
            Alert.alert("Error", "Please enter the 6-digit OTP");
            return;
        }

        setLoading(true);
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
                Alert.alert("Success", "Email verified successfully!");
            } else {
                const error = await response.json();
                Alert.alert("Error", error.detail || "Invalid OTP");
            }
        } catch (e) {
            Alert.alert("Error", "Could not verify OTP");
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const completeProfile = async () => {
        if (!emailVerified) {
            Alert.alert("Error", "Please verify your email first");
            return;
        }
        if (!phone || !policeStation || !policeRank) {
            Alert.alert("Error", "Please fill in all required fields");
            return;
        }

        setLoading(true);
        try {
            const token = await AsyncStorage.getItem('userToken');
            const response = await fetch(`${API_URL}/complete-police-profile`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    email,
                    phone,
                    police_station: policeStation,
                    police_rank: policeRank,
                }),
            });

            if (response.ok) {
                Alert.alert(
                    "Profile Complete",
                    "Your profile has been submitted for admin approval. You will be notified once approved.",
                    [
                        {
                            text: "OK",
                            onPress: () => {
                                navigation.reset({
                                    index: 0,
                                    routes: [{ name: 'PendingApproval' }],
                                });
                            }
                        }
                    ]
                );
            } else {
                const error = await response.json();
                Alert.alert("Error", error.detail || "Failed to complete profile");
            }
        } catch (e) {
            Alert.alert("Error", "Could not complete profile");
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const renderStepIndicator = () => (
        <View style={styles.stepIndicator}>
            {[1, 2, 3].map((step) => (
                <View key={step} style={styles.stepRow}>
                    <View style={[
                        styles.stepCircle,
                        currentStep >= step && styles.stepCircleActive
                    ]}>
                        <Text style={[
                            styles.stepNumber,
                            currentStep >= step && styles.stepNumberActive
                        ]}>{step}</Text>
                    </View>
                    {step < 3 && <View style={[
                        styles.stepLine,
                        currentStep > step && styles.stepLineActive
                    ]} />}
                </View>
            ))}
        </View>
    );

    const renderStep1 = () => (
        <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Step 1: Verify CNIC</Text>
            <Text style={styles.stepDescription}>
                Upload front and back of your CNIC card
            </Text>

            <View style={styles.imageRow}>
                <TouchableOpacity
                    style={styles.imageUpload}
                    onPress={() => showImageOptions(setCnicFrontImage)}
                >
                    {cnicFrontImage ? (
                        <Image source={{ uri: cnicFrontImage }} style={styles.uploadedImage} />
                    ) : (
                        <View style={styles.uploadPlaceholder}>
                            <Text style={styles.uploadIcon}>📷</Text>
                            <Text style={styles.uploadText}>CNIC Front</Text>
                        </View>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.imageUpload}
                    onPress={() => showImageOptions(setCnicBackImage)}
                >
                    {cnicBackImage ? (
                        <Image source={{ uri: cnicBackImage }} style={styles.uploadedImage} />
                    ) : (
                        <View style={styles.uploadPlaceholder}>
                            <Text style={styles.uploadIcon}>📷</Text>
                            <Text style={styles.uploadText}>CNIC Back</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            <CustomButton
                text={uploadingCnic ? "Processing..." : "Upload & Verify CNIC"}
                onPress={uploadCnicImages}
                disabled={uploadingCnic}
            />
        </View>
    );

    const renderStep2 = () => (
        <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Step 2: Police ID</Text>
            <Text style={styles.stepDescription}>
                Upload front and back of your Police ID card
            </Text>

            <View style={styles.imageRow}>
                <TouchableOpacity
                    style={styles.imageUpload}
                    onPress={() => showImageOptions(setPoliceIdFrontImage)}
                >
                    {policeIdFrontImage ? (
                        <Image source={{ uri: policeIdFrontImage }} style={styles.uploadedImage} />
                    ) : (
                        <View style={styles.uploadPlaceholder}>
                            <Text style={styles.uploadIcon}>🪪</Text>
                            <Text style={styles.uploadText}>Police ID Front</Text>
                        </View>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.imageUpload}
                    onPress={() => showImageOptions(setPoliceIdBackImage)}
                >
                    {policeIdBackImage ? (
                        <Image source={{ uri: policeIdBackImage }} style={styles.uploadedImage} />
                    ) : (
                        <View style={styles.uploadPlaceholder}>
                            <Text style={styles.uploadIcon}>🪪</Text>
                            <Text style={styles.uploadText}>Police ID Back</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            <CustomButton
                text={uploadingPoliceId ? "Uploading..." : "Upload Police ID"}
                onPress={uploadPoliceIdImages}
                disabled={uploadingPoliceId}
            />
        </View>
    );

    const renderStep3 = () => (
        <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Step 3: Contact & Station Info</Text>

            {/* Extracted Info Display */}
            {fullName && (
                <View style={styles.extractedInfo}>
                    <Text style={styles.extractedLabel}>Name: {fullName}</Text>
                    {gender && <Text style={styles.extractedLabel}>Gender: {gender}</Text>}
                </View>
            )}

            <CustomInput
                placeholder="Email Address"
                value={email}
                setValue={setEmail}
                keyboardType="email-address"
            />

            {!emailVerified ? (
                <>
                    {!otpSent ? (
                        <CustomButton
                            text={loading ? "Sending..." : "Send Verification Code"}
                            onPress={sendOTP}
                            type="SECONDARY"
                        />
                    ) : (
                        <>
                            <CustomInput
                                placeholder="Enter 6-digit OTP"
                                value={otp}
                                setValue={setOtp}
                                keyboardType="numeric"
                                maxLength={6}
                            />
                            <CustomButton
                                text={loading ? "Verifying..." : "Verify OTP"}
                                onPress={verifyOTP}
                                type="SECONDARY"
                            />
                        </>
                    )}
                </>
            ) : (
                <Text style={styles.verifiedText}>✅ Email Verified</Text>
            )}

            <CustomInput
                placeholder="Phone Number"
                value={phone}
                setValue={setPhone}
                keyboardType="phone-pad"
            />

            <CustomInput
                placeholder="Police Station Name"
                value={policeStation}
                setValue={setPoliceStation}
            />

            <CustomInput
                placeholder="Rank (e.g., Constable, ASI, SI)"
                value={policeRank}
                setValue={setPoliceRank}
            />

            <CustomButton
                text={loading ? "Submitting..." : "Complete Profile & Submit for Approval"}
                onPress={completeProfile}
            />
        </View>
    );

    return (
        <LinearGradient
            colors={['#0e1c26', '#122c45', '#1a4e7a']}
            style={styles.root}
        >
            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.container}>
                    <Text style={styles.title}>🚔 Police Profile Setup</Text>

                    {renderStepIndicator()}

                    {currentStep === 1 && renderStep1()}
                    {currentStep === 2 && renderStep2()}
                    {currentStep === 3 && renderStep3()}
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
        color: '#fff',
        marginBottom: 20,
    },
    stepIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 30,
    },
    stepRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    stepCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepCircleActive: {
        backgroundColor: '#4CAF50',
    },
    stepNumber: {
        color: 'rgba(255,255,255,0.5)',
        fontWeight: 'bold',
    },
    stepNumberActive: {
        color: '#fff',
    },
    stepLine: {
        width: 40,
        height: 3,
        backgroundColor: 'rgba(255,255,255,0.2)',
        marginHorizontal: 5,
    },
    stepLineActive: {
        backgroundColor: '#4CAF50',
    },
    stepContent: {
        width: '100%',
    },
    stepTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 10,
        textAlign: 'center',
    },
    stepDescription: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
        marginBottom: 20,
        textAlign: 'center',
    },
    imageRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    imageUpload: {
        width: '48%',
        aspectRatio: 1.5,
        borderRadius: 10,
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    uploadPlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
        borderStyle: 'dashed',
        borderRadius: 10,
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
    extractedInfo: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        padding: 15,
        borderRadius: 10,
        marginBottom: 15,
        width: '100%',
    },
    extractedLabel: {
        color: '#fff',
        fontSize: 14,
        marginBottom: 5,
    },
    verifiedText: {
        color: '#4CAF50',
        fontSize: 16,
        fontWeight: 'bold',
        marginVertical: 10,
        textAlign: 'center',
    },
});

export default PoliceProfileSetupScreen;
