import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Dimensions,
    StatusBar,
    Alert,
    TextInput,
    ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';

import { useNetInfo } from '@react-native-community/netinfo';
import { saveToQueue, processQueue } from '../utils/offlineQueue';
import { useSocket } from '../context/SocketContext';
import API_URL from '../config';

const ALERT_TAGS = [
    { id: 'police', label: 'Police', icon: '🚔', color: '#2196F3' },
    { id: 'fire', label: 'Fire', icon: '🔥', color: '#FF5722' },
    { id: 'ambulance', label: 'Ambulance', icon: '🚑', color: '#4CAF50' },
    { id: 'wildlife', label: 'Wildlife', icon: '🦁', color: '#8BC34A' },
    { id: 'other', label: 'Other', icon: '⚠️', color: '#9E9E9E' },
];

const { width } = Dimensions.get('window');

const DashboardScreen = () => {
    const navigation = useNavigation();
    const [sidebarVisible, setSidebarVisible] = useState(false);
    const [sosPressed, setSosPressed] = useState(false);
    const [textModalVisible, setTextModalVisible] = useState(false);
    const [textMessage, setTextMessage] = useState('');

    // Location state
    const [location, setLocation] = useState(null);
    const [locationPermission, setLocationPermission] = useState(false);

    // Tag selection modal state
    const [tagModalVisible, setTagModalVisible] = useState(false);
    const [selectedTag, setSelectedTag] = useState(null);
    const [sendingAlert, setSendingAlert] = useState(false);

    // Voice recording states
    const [voiceModalVisible, setVoiceModalVisible] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [recordingUri, setRecordingUri] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

    const recordingRef = useRef(null);
    const soundRef = useRef(null);
    const timerRef = useRef(null);

    // Active alert response state (when officer responds)
    const [activeResponse, setActiveResponse] = useState(null);
    const socket = useSocket();

    // Offline handling
    const netInfo = useNetInfo();
    const [isOffline, setIsOffline] = useState(false);

    useEffect(() => {
        if (!socket) return;

        // Listen for new responses instantly
        socket.on('alert_response', (data) => {
            console.log('Officer Responded!', data); // Debug

            // Construct officer object from flat data if needed, or just display raw
            // The data structure from backend is AlertResponseOut, which has officer_id but maybe not full name?
            // Wait, we need officer name for the UI "Officer John Doe". 
            // The backend emits AlertResponseOut which has: alert_id, officer_id, response_time, message, status.
            // It DOES NOT have officer name directly unless we modified schema or router to include it.
            // In alerts.py, I just did from_orm(alert_response).
            // Let's rely on standard fetch to get full details if needed, OR just show "Officer Responded" for now to be safe.
            // BETTER: Trigger a refresh of the alert list or fetch specific alert details.

            // For now, let's just use the event to trigger the UI state.
            setActiveResponse({
                ...data,
                responding_officer: { full_name: 'Officer', badge_number: 'Unknown' } // Placeholder until we fetch or improve payload
            });

            Alert.alert("Help is Coming!", "An officer has responded to your alert.");
        });

        return () => {
            socket.off('alert_response');
        };
    }, [socket]);

    useEffect(() => {
        if (netInfo.isConnected === false) {
            setIsOffline(true);
        } else {
            setIsOffline(false);
            if (netInfo.isConnected === true) {
                // Try to sync queue when connection returns
                processQueue().then(count => {
                    if (count > 0) Alert.alert("Online", `Synced ${count} offline alerts!`);
                });
            }
        }
    }, [netInfo.isConnected]);

    // Request location permission and track location
    useEffect(() => {
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                setLocationPermission(true);
                const loc = await Location.getCurrentPositionAsync({});
                setLocation(loc.coords);

                // Update location on server
                updateLocationOnServer(loc.coords);

                // Watch location changes
                Location.watchPositionAsync(
                    { accuracy: Location.Accuracy.Balanced, distanceInterval: 50 },
                    (loc) => setLocation(loc.coords)
                );
            }
        })();

        // Cleanup on unmount
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (recordingRef.current) {
                recordingRef.current.stopAndUnloadAsync();
            }
            if (soundRef.current) {
                soundRef.current.unloadAsync();
            }
            if (responsePollingRef.current) clearInterval(responsePollingRef.current);
        };
    }, []);

    // Polling removed in favor of WebSockets
    // useEffect(() => { ... }, []);

    const updateLocationOnServer = async (coords) => {
        try {
            const token = await AsyncStorage.getItem('userToken');
            await fetch(`${API_URL}/location`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                }),
            });
        } catch (e) {
            console.error('Error updating location:', e);
        }
    };

    const sendAlert = async (alertType, content = null, audioUrl = null, tag = null) => {
        try {
            const token = await AsyncStorage.getItem('userToken');

            // Offline Mode Check
            if (isOffline || !token) {
                if (!token && !isOffline) {
                    Alert.alert("Error", "Not authenticated. Please login again.");
                    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                    return;
                }

                // If offline, save to queue (except if auth error, but we assume offline = auth invalid/irrelevant for queuing)
                // Actually we save token with request in queue logic or re-read it. 
                // Our queue logic reads token at sync time.

                const alertData = {
                    alert_type: alertType,
                    content: content,
                    audio_url: audioUrl,
                    tag: tag,
                    latitude: location?.latitude || null,
                    longitude: location?.longitude || null,
                };

                await saveToQueue(alertData);
                Alert.alert("Offline Mode", "Alert saved! Will send automatically when online.");
                return;
            }

            const alertData = {
                alert_type: alertType,
                content: content,
                audio_url: audioUrl,
                tag: tag,
                latitude: location?.latitude || null,
                longitude: location?.longitude || null,
            };

            const response = await fetch(`${API_URL}/alerts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(alertData),
            });

            if (response.ok) {
                const data = await response.json();
                console.log("Alert sent successfully:", data);
                Alert.alert(
                    "Alert Sent! 🚨",
                    `Your ${alertType.toUpperCase()} alert has been sent to nearby officers.${tag ? ` (${tag.toUpperCase()})` : ''}`
                );
            } else if (response.status === 401) {
                await AsyncStorage.removeItem('userToken');
                Alert.alert("Session Expired", "Please login again.");
                navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
            } else {
                Alert.alert("Error", "Failed to send alert");
            }
        } catch (error) {
            console.error("Error sending alert:", error);
            Alert.alert("Error", "Could not connect to server");
        }
    };

    const onLogOutPressed = async () => {
        setSidebarVisible(false);
        await AsyncStorage.removeItem('userToken');
        navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
        });
    };

    const onSOSPressed = () => {
        // Show tag selection modal instead of directly sending
        setTagModalVisible(true);
    };

    const sendSOSWithTag = async (tag) => {
        setSendingAlert(true);
        setSelectedTag(tag);

        await sendAlert('sos', `Emergency SOS Alert - ${tag.label}`, null, tag.id);

        setSendingAlert(false);
        setTagModalVisible(false);
        setSelectedTag(null);

        // Visual feedback
        setSosPressed(true);
        setTimeout(() => setSosPressed(false), 500);
    };

    const onWritePressed = () => {
        setTextModalVisible(true);
    };

    const onSendTextMessage = () => {
        if (textMessage.trim()) {
            sendAlert('text', textMessage);
            setTextMessage('');
            setTextModalVisible(false);
        } else {
            Alert.alert("Error", "Please enter a message");
        }
    };

    // Voice Recording Functions
    const onMicPressed = async () => {
        // Request permissions
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert("Permission Required", "Please grant microphone permission to record voice notes.");
            return;
        }

        // Reset states
        setRecordingUri(null);
        setRecordingDuration(0);
        setIsRecording(false);
        setVoiceModalVisible(true);
    };

    const startRecording = async () => {
        try {
            console.log('Starting recording...');

            // Configure audio mode
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            // Create and start recording
            const recording = new Audio.Recording();
            await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
            await recording.startAsync();

            recordingRef.current = recording;
            setIsRecording(true);
            setRecordingDuration(0);

            // Start timer
            timerRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);

            console.log('Recording started');
        } catch (error) {
            console.error('Failed to start recording:', error);
            Alert.alert("Error", "Failed to start recording: " + error.message);
        }
    };

    const stopRecording = async () => {
        try {
            console.log('Stopping recording...');

            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }

            if (recordingRef.current) {
                await recordingRef.current.stopAndUnloadAsync();
                const uri = recordingRef.current.getURI();
                console.log('Recording saved to:', uri);
                setRecordingUri(uri);
                recordingRef.current = null;
            }

            setIsRecording(false);

            // Reset audio mode
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
            });
        } catch (error) {
            console.error('Failed to stop recording:', error);
            Alert.alert("Error", "Failed to stop recording");
        }
    };

    const playRecording = async () => {
        if (!recordingUri) return;

        try {
            if (soundRef.current) {
                await soundRef.current.unloadAsync();
            }

            const { sound } = await Audio.Sound.createAsync({ uri: recordingUri });
            soundRef.current = sound;

            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.didJustFinish) {
                    setIsPlaying(false);
                }
            });

            setIsPlaying(true);
            await sound.playAsync();
        } catch (error) {
            console.error('Failed to play recording:', error);
            Alert.alert("Error", "Failed to play recording");
        }
    };

    const stopPlaying = async () => {
        if (soundRef.current) {
            await soundRef.current.stopAsync();
            setIsPlaying(false);
        }
    };

    const uploadAndSendVoiceAlert = async () => {
        if (!recordingUri) {
            Alert.alert("Error", "No recording to send");
            return;
        }

        setIsUploading(true);

        try {
            const token = await AsyncStorage.getItem('userToken');
            if (!token) {
                Alert.alert("Error", "Not authenticated");
                return;
            }

            // Upload audio file
            const formData = new FormData();
            formData.append('audio_file', {
                uri: recordingUri,
                type: 'audio/m4a',
                name: 'voice_note.m4a',
            });

            console.log('Uploading audio...');
            const uploadResponse = await fetch(`${API_URL}/upload-audio`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data',
                },
                body: formData,
            });

            if (uploadResponse.ok) {
                const uploadData = await uploadResponse.json();
                console.log('Audio uploaded:', uploadData);

                // Create alert with audio URL
                await sendAlert('voice', `Voice note (${formatDuration(recordingDuration)})`, uploadData.audio_url);

                // Close modal and reset
                setVoiceModalVisible(false);
                setRecordingUri(null);
                setRecordingDuration(0);
            } else {
                const errorData = await uploadResponse.json();
                Alert.alert("Upload Failed", errorData.detail || "Failed to upload audio");
            }
        } catch (error) {
            console.error('Upload error:', error);
            Alert.alert("Error", "Failed to upload voice note");
        } finally {
            setIsUploading(false);
        }
    };

    const cancelRecording = () => {
        if (isRecording) {
            stopRecording();
        }
        setVoiceModalVisible(false);
        setRecordingUri(null);
        setRecordingDuration(0);
    };

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const onHistoryPressed = () => {
        setSidebarVisible(false);
        navigation.navigate('History');
    };

    const onProfilePressed = () => {
        setSidebarVisible(false);
        navigation.navigate('Profile');
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Background Gradient */}
            <LinearGradient
                colors={['#1a1a2e', '#16213e', '#0f3460']}
                style={styles.gradient}
            >
                {/* Header with Hamburger Menu */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.menuButton}
                        onPress={() => setSidebarVisible(true)}
                    >
                        <View style={styles.menuLine} />
                        <View style={styles.menuLine} />
                        <View style={styles.menuLine} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>SOS App</Text>
                    <View style={styles.menuButton} />
                </View>

                {/* Officer Response Notification Banner */}
                {activeResponse && activeResponse.responding_officer && (
                    <View style={styles.responseBanner}>
                        <View style={styles.responseBannerContent}>
                            <Text style={styles.responseBannerIcon}>🚔</Text>
                            <View style={styles.responseBannerText}>
                                <Text style={styles.responseBannerTitle}>Help is on the way!</Text>
                                <Text style={styles.responseBannerOfficer}>
                                    Officer {activeResponse.responding_officer.full_name || 'Unknown'}
                                    {activeResponse.responding_officer.badge_number &&
                                        ` (Badge: ${activeResponse.responding_officer.badge_number})`}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={styles.responseChatButton}
                            onPress={() => navigation.navigate('Chat', {
                                alertId: activeResponse.id,
                                alertType: activeResponse.alert_type,
                                otherUserName: activeResponse.responding_officer.full_name || 'Officer',
                                otherUserType: 'police',
                            })}
                        >
                            <Text style={styles.responseChatButtonText}>💬 Chat</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Main Content */}
                <View style={styles.content}>
                    {/* Status Text */}
                    <Text style={styles.statusText}>Emergency Help</Text>
                    <Text style={styles.subText}>Press the button to send an alert</Text>

                    {/* SOS Button */}
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={onSOSPressed}
                        style={styles.sosButtonContainer}
                    >
                        <LinearGradient
                            colors={sosPressed ? ['#ff0000', '#cc0000'] : ['#e63946', '#d00000']}
                            style={styles.sosButton}
                        >
                            <View style={styles.sosButtonInner}>
                                <Text style={styles.sosText}>SOS</Text>
                            </View>
                        </LinearGradient>
                        {/* Pulse Animation Ring */}
                        <View style={styles.pulseRing} />
                    </TouchableOpacity>

                    {/* Action Icons */}
                    <View style={styles.actionContainer}>
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={onWritePressed}
                        >
                            <View style={styles.actionIconContainer}>
                                <Text style={styles.actionIcon}>✏️</Text>
                            </View>
                            <Text style={styles.actionLabel}>Write</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={onMicPressed}
                        >
                            <View style={styles.actionIconContainer}>
                                <Text style={styles.actionIcon}>🎤</Text>
                            </View>
                            <Text style={styles.actionLabel}>Voice</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>Your safety is our priority</Text>
                </View>
            </LinearGradient>

            {/* Sidebar Modal */}
            <Modal
                visible={sidebarVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setSidebarVisible(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setSidebarVisible(false)}
                >
                    <View style={styles.sidebar}>
                        <LinearGradient
                            colors={['#1a1a2e', '#16213e']}
                            style={styles.sidebarGradient}
                        >
                            {/* Sidebar Header */}
                            <View style={styles.sidebarHeader}>
                                <View style={styles.avatarContainer}>
                                    <Text style={styles.avatarText}>👤</Text>
                                </View>
                                <Text style={styles.userName}>User</Text>
                            </View>

                            {/* Sidebar Menu Items */}
                            <View style={styles.sidebarMenu}>
                                <TouchableOpacity style={styles.menuItem}>
                                    <Text style={styles.menuItemIcon}>🏠</Text>
                                    <Text style={styles.menuItemText}>Home</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.menuItem}
                                    onPress={onHistoryPressed}
                                >
                                    <Text style={styles.menuItemIcon}>📜</Text>
                                    <Text style={styles.menuItemText}>History</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.menuItem}
                                    onPress={onProfilePressed}
                                >
                                    <Text style={styles.menuItemIcon}>👤</Text>
                                    <Text style={styles.menuItemText}>Profile</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.menuItem}>
                                    <Text style={styles.menuItemIcon}>📞</Text>
                                    <Text style={styles.menuItemText}>Emergency Contacts</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.menuItem}>
                                    <Text style={styles.menuItemIcon}>⚙️</Text>
                                    <Text style={styles.menuItemText}>Settings</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.menuItem}
                                    onPress={() => {
                                        setSidebarVisible(false);
                                        navigation.navigate('SafeWalk');
                                    }}
                                >
                                    <Text style={styles.menuItemIcon}>🛡️</Text>
                                    <Text style={styles.menuItemText}>Safe Walk</Text>
                                </TouchableOpacity>

                                <View style={styles.menuDivider} />

                                <TouchableOpacity
                                    style={styles.menuItem}
                                    onPress={onLogOutPressed}
                                >
                                    <Text style={styles.menuItemIcon}>🚪</Text>
                                    <Text style={[styles.menuItemText, { color: '#e63946' }]}>
                                        Log Out
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </LinearGradient>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Text Message Modal */}
            <Modal
                visible={textModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setTextModalVisible(false)}
            >
                <View style={styles.textModalOverlay}>
                    <View style={styles.textModalContent}>
                        <Text style={styles.textModalTitle}>Send Text Alert</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="Type your emergency message..."
                            placeholderTextColor="#666"
                            value={textMessage}
                            onChangeText={setTextMessage}
                            multiline
                            numberOfLines={4}
                        />
                        <View style={styles.textModalButtons}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => setTextModalVisible(false)}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.sendButton}
                                onPress={onSendTextMessage}
                            >
                                <Text style={styles.sendButtonText}>Send</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Voice Recording Modal */}
            <Modal
                visible={voiceModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={cancelRecording}
            >
                <View style={styles.voiceModalOverlay}>
                    <View style={styles.voiceModalContent}>
                        <Text style={styles.voiceModalTitle}>Voice Recording</Text>

                        {/* Recording Timer */}
                        <View style={styles.timerContainer}>
                            <Text style={styles.timerText}>{formatDuration(recordingDuration)}</Text>
                            {isRecording && (
                                <View style={styles.recordingIndicator}>
                                    <View style={styles.recordingDot} />
                                    <Text style={styles.recordingText}>Recording...</Text>
                                </View>
                            )}
                        </View>

                        {/* Recording Controls */}
                        <View style={styles.voiceControls}>
                            {!recordingUri ? (
                                // Recording phase
                                <>
                                    {!isRecording ? (
                                        <TouchableOpacity
                                            style={styles.recordButton}
                                            onPress={startRecording}
                                        >
                                            <Text style={styles.recordButtonIcon}>🎙️</Text>
                                            <Text style={styles.recordButtonText}>Start Recording</Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <TouchableOpacity
                                            style={styles.stopButton}
                                            onPress={stopRecording}
                                        >
                                            <Text style={styles.stopButtonIcon}>⏹️</Text>
                                            <Text style={styles.stopButtonText}>Stop</Text>
                                        </TouchableOpacity>
                                    )}
                                </>
                            ) : (
                                // Review phase
                                <>
                                    <View style={styles.reviewControls}>
                                        <TouchableOpacity
                                            style={styles.playButton}
                                            onPress={isPlaying ? stopPlaying : playRecording}
                                        >
                                            <Text style={styles.playButtonIcon}>{isPlaying ? '⏸️' : '▶️'}</Text>
                                            <Text style={styles.playButtonText}>{isPlaying ? 'Pause' : 'Play'}</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={styles.reRecordButton}
                                            onPress={() => {
                                                setRecordingUri(null);
                                                setRecordingDuration(0);
                                            }}
                                        >
                                            <Text style={styles.reRecordButtonIcon}>🔄</Text>
                                            <Text style={styles.reRecordButtonText}>Re-record</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <TouchableOpacity
                                        style={[styles.sendVoiceButton, isUploading && styles.buttonDisabled]}
                                        onPress={uploadAndSendVoiceAlert}
                                        disabled={isUploading}
                                    >
                                        {isUploading ? (
                                            <ActivityIndicator color="#fff" />
                                        ) : (
                                            <>
                                                <Text style={styles.sendVoiceButtonIcon}>📤</Text>
                                                <Text style={styles.sendVoiceButtonText}>Send Voice Alert</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>

                        {/* Cancel Button */}
                        <TouchableOpacity
                            style={styles.voiceCancelButton}
                            onPress={cancelRecording}
                        >
                            <Text style={styles.voiceCancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Tag Selection Modal for SOS */}
            <Modal
                visible={tagModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setTagModalVisible(false)}
            >
                <View style={styles.tagModalOverlay}>
                    <View style={styles.tagModalContent}>
                        <Text style={styles.tagModalTitle}>🚨 Select Emergency Type</Text>
                        <Text style={styles.tagModalSubtitle}>
                            Choose the type of emergency for faster response
                        </Text>

                        <View style={styles.tagGrid}>
                            {ALERT_TAGS.map((tag) => (
                                <TouchableOpacity
                                    key={tag.id}
                                    style={[
                                        styles.tagOption,
                                        { borderColor: tag.color },
                                        selectedTag?.id === tag.id && { backgroundColor: tag.color }
                                    ]}
                                    onPress={() => sendSOSWithTag(tag)}
                                    disabled={sendingAlert}
                                >
                                    {sendingAlert && selectedTag?.id === tag.id ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <>
                                            <Text style={styles.tagOptionIcon}>{tag.icon}</Text>
                                            <Text style={[
                                                styles.tagOptionLabel,
                                                selectedTag?.id === tag.id && { color: '#fff' }
                                            ]}>{tag.label}</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity
                            style={styles.tagCancelButton}
                            onPress={() => setTagModalVisible(false)}
                            disabled={sendingAlert}
                        >
                            <Text style={styles.tagCancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    gradient: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 20,
    },
    menuButton: {
        width: 30,
        height: 30,
        justifyContent: 'center',
    },
    menuLine: {
        width: 25,
        height: 3,
        backgroundColor: '#fff',
        marginVertical: 2,
        borderRadius: 2,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#fff',
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    statusText: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
    },
    subText: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.7)',
        marginBottom: 40,
    },
    sosButtonContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 50,
    },
    sosButton: {
        width: 180,
        height: 180,
        borderRadius: 90,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#e63946',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 15,
    },
    sosButtonInner: {
        width: 160,
        height: 160,
        borderRadius: 80,
        backgroundColor: 'rgba(0,0,0,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    sosText: {
        fontSize: 48,
        fontWeight: 'bold',
        color: '#fff',
        letterSpacing: 4,
    },
    pulseRing: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: 100,
        borderWidth: 2,
        borderColor: 'rgba(230, 57, 70, 0.3)',
    },
    actionContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 40,
    },
    actionButton: {
        alignItems: 'center',
    },
    actionIconContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    actionIcon: {
        fontSize: 28,
    },
    actionLabel: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
    },
    footer: {
        paddingBottom: 30,
        alignItems: 'center',
    },
    footerText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
    },
    // Sidebar Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sidebar: {
        width: width * 0.75,
        height: '100%',
    },
    sidebarGradient: {
        flex: 1,
        paddingTop: 60,
    },
    sidebarHeader: {
        alignItems: 'center',
        paddingVertical: 30,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    avatarContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 15,
    },
    avatarText: {
        fontSize: 40,
    },
    userName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
    },
    sidebarMenu: {
        paddingTop: 20,
        paddingHorizontal: 20,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
    },
    menuItemIcon: {
        fontSize: 22,
        marginRight: 15,
    },
    menuItemText: {
        fontSize: 16,
        color: '#fff',
    },
    menuDivider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginVertical: 15,
    },
    // Text Modal Styles
    textModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    textModalContent: {
        backgroundColor: '#1a1a2e',
        borderRadius: 15,
        padding: 20,
        width: '100%',
        maxWidth: 400,
    },
    textModalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 15,
        textAlign: 'center',
    },
    textInput: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 10,
        padding: 15,
        color: '#fff',
        fontSize: 16,
        minHeight: 100,
        textAlignVertical: 'top',
        marginBottom: 15,
    },
    textModalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    cancelButton: {
        flex: 1,
        padding: 15,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginRight: 10,
    },
    cancelButtonText: {
        color: '#fff',
        textAlign: 'center',
        fontWeight: '600',
    },
    sendButton: {
        flex: 1,
        padding: 15,
        borderRadius: 10,
        backgroundColor: '#e63946',
        marginLeft: 10,
    },
    sendButtonText: {
        color: '#fff',
        textAlign: 'center',
        fontWeight: '600',
    },
    // Voice Modal Styles
    voiceModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    voiceModalContent: {
        backgroundColor: '#1a1a2e',
        borderRadius: 20,
        padding: 25,
        width: '100%',
        maxWidth: 350,
        alignItems: 'center',
    },
    voiceModalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 20,
    },
    timerContainer: {
        alignItems: 'center',
        marginBottom: 30,
    },
    timerText: {
        fontSize: 48,
        fontWeight: 'bold',
        color: '#fff',
        fontVariant: ['tabular-nums'],
    },
    recordingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
    },
    recordingDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#e63946',
        marginRight: 8,
    },
    recordingText: {
        color: '#e63946',
        fontSize: 14,
    },
    voiceControls: {
        width: '100%',
        alignItems: 'center',
    },
    recordButton: {
        backgroundColor: '#e63946',
        paddingVertical: 20,
        paddingHorizontal: 40,
        borderRadius: 50,
        flexDirection: 'row',
        alignItems: 'center',
    },
    recordButtonIcon: {
        fontSize: 24,
        marginRight: 10,
    },
    recordButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    stopButton: {
        backgroundColor: '#dc3545',
        paddingVertical: 20,
        paddingHorizontal: 50,
        borderRadius: 50,
        flexDirection: 'row',
        alignItems: 'center',
    },
    stopButtonIcon: {
        fontSize: 24,
        marginRight: 10,
    },
    stopButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    reviewControls: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        marginBottom: 20,
    },
    playButton: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingVertical: 15,
        paddingHorizontal: 25,
        borderRadius: 10,
        alignItems: 'center',
    },
    playButtonIcon: {
        fontSize: 24,
    },
    playButtonText: {
        color: '#fff',
        marginTop: 5,
    },
    reRecordButton: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingVertical: 15,
        paddingHorizontal: 25,
        borderRadius: 10,
        alignItems: 'center',
    },
    reRecordButtonIcon: {
        fontSize: 24,
    },
    reRecordButtonText: {
        color: '#fff',
        marginTop: 5,
    },
    sendVoiceButton: {
        backgroundColor: '#28a745',
        paddingVertical: 15,
        paddingHorizontal: 30,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        justifyContent: 'center',
    },
    sendVoiceButtonIcon: {
        fontSize: 20,
        marginRight: 10,
    },
    sendVoiceButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    voiceCancelButton: {
        marginTop: 20,
        padding: 10,
    },
    voiceCancelButtonText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 16,
    },
    // Tag Selection Modal Styles
    tagModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    tagModalContent: {
        backgroundColor: '#1a1a2e',
        borderRadius: 20,
        padding: 25,
        width: '100%',
        maxWidth: 350,
        alignItems: 'center',
    },
    tagModalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
    },
    tagModalSubtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
        marginBottom: 25,
    },
    tagGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 20,
    },
    tagOption: {
        width: '45%',
        aspectRatio: 1.5,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 15,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 10,
    },
    tagOptionIcon: {
        fontSize: 30,
        marginBottom: 8,
    },
    tagOptionLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    tagCancelButton: {
        paddingVertical: 12,
        paddingHorizontal: 30,
    },
    tagCancelButtonText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 16,
    },
    // Officer response notification banner
    responseBanner: {
        backgroundColor: 'rgba(76, 175, 80, 0.9)',
        marginHorizontal: 15,
        marginTop: 10,
        borderRadius: 12,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    responseBannerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    responseBannerIcon: {
        fontSize: 30,
        marginRight: 10,
    },
    responseBannerText: {
        flex: 1,
    },
    responseBannerTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    responseBannerOfficer: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 12,
    },
    responseChatButton: {
        backgroundColor: '#fff',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
    },
    responseChatButtonText: {
        color: '#4CAF50',
        fontWeight: 'bold',
        fontSize: 13,
    },
});

export default DashboardScreen;
