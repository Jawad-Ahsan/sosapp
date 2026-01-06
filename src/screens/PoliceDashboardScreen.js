import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Modal,
    Dimensions,
    StatusBar,
    Alert,
    ActivityIndicator,
    Linking,
    Platform,
    ScrollView,
    RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import API_URL from '../config';

const { width } = Dimensions.get('window');

const PoliceDashboardScreen = () => {
    const navigation = useNavigation();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [alerts, setAlerts] = useState([]);
    const [location, setLocation] = useState(null);
    const [respondingTo, setRespondingTo] = useState(null);
    const [officerInfo, setOfficerInfo] = useState(null);
    const alertSoundRef = useRef(null);
    const previousAlertIds = useRef(new Set());

    // Audio playback state
    const [playingAudioId, setPlayingAudioId] = useState(null);
    const voiceSoundRef = useRef(null);
    const [finishingAlertId, setFinishingAlertId] = useState(null);

    // Request location permissions and start tracking
    useEffect(() => {
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Location permission is required for police officers');
                return;
            }

            // Get current location
            const loc = await Location.getCurrentPositionAsync({});
            setLocation(loc.coords);

            // Update location on server
            updateLocationOnServer(loc.coords);

            // Start watching location
            Location.watchPositionAsync(
                { accuracy: Location.Accuracy.High, distanceInterval: 100 },
                (loc) => {
                    setLocation(loc.coords);
                    updateLocationOnServer(loc.coords);
                }
            );
        })();

        fetchOfficerInfo();
        loadAlertSound();

        return () => {
            if (alertSoundRef.current) {
                alertSoundRef.current.unloadAsync();
            }
        };
    }, []);

    // Fetch alerts when location is available
    useEffect(() => {
        if (location) {
            fetchNearbyAlerts();
            const interval = setInterval(fetchNearbyAlerts, 10000); // Poll every 10 seconds
            return () => clearInterval(interval);
        }
    }, [location]);

    const loadAlertSound = async () => {
        try {
            const { sound } = await Audio.Sound.createAsync(
                require('../../assets/alert_sound.mp3'),
                { shouldPlay: false }
            );
            alertSoundRef.current = sound;
        } catch (e) {
            // If alert sound doesn't exist, we'll skip it
            console.log("Alert sound not found, skipping");
        }
    };

    const playAlertSound = async () => {
        try {
            if (alertSoundRef.current) {
                await alertSoundRef.current.replayAsync();
            }
        } catch (e) {
            console.log("Could not play alert sound:", e);
        }
    };

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
            console.error("Error updating location:", e);
        }
    };

    const fetchOfficerInfo = async () => {
        try {
            const token = await AsyncStorage.getItem('userToken');
            const response = await fetch(`${API_URL}/profile`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (response.ok) {
                const data = await response.json();
                setOfficerInfo(data);
            }
        } catch (e) {
            console.error("Error fetching officer info:", e);
        }
    };

    const fetchNearbyAlerts = async () => {
        if (!location) return;

        try {
            const token = await AsyncStorage.getItem('userToken');
            const response = await fetch(
                `${API_URL}/alerts/nearby?latitude=${location.latitude}&longitude=${location.longitude}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );

            if (response.ok) {
                const data = await response.json();

                // Check for new alerts within 10km for sound
                const newAlerts = data.filter(
                    alert => alert.distance_km <= 10 && !previousAlertIds.current.has(alert.id)
                );

                if (newAlerts.length > 0) {
                    playAlertSound();
                }

                // Update previous alert IDs
                previousAlertIds.current = new Set(data.map(a => a.id));

                setAlerts(data);
            }
        } catch (e) {
            console.error("Error fetching alerts:", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const respondToAlert = async (alert) => {
        setRespondingTo(alert.id);
        try {
            const token = await AsyncStorage.getItem('userToken');
            const response = await fetch(`${API_URL}/alerts/${alert.id}/respond`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    officer_latitude: location.latitude,
                    officer_longitude: location.longitude,
                }),
            });

            if (response.ok) {
                // Open Google Maps with directions
                const destination = `${alert.latitude},${alert.longitude}`;
                const origin = `${location.latitude},${location.longitude}`;

                const url = Platform.select({
                    ios: `maps://app?saddr=${origin}&daddr=${destination}`,
                    android: `google.navigation:q=${destination}&mode=d`,
                });

                const canOpen = await Linking.canOpenURL(url);
                if (canOpen) {
                    await Linking.openURL(url);
                } else {
                    await Linking.openURL(
                        `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`
                    );
                }

                // Refresh alerts
                fetchNearbyAlerts();

                // Navigate to chat screen
                navigation.navigate('Chat', {
                    alertId: alert.id,
                    alertType: alert.alert_type,
                    otherUserName: alert.sender?.full_name || 'Citizen',
                    otherUserType: 'citizen',
                });

                Alert.alert("Responding", "Navigation started. Citizen has been notified via chat.");
            } else {
                const error = await response.json();
                Alert.alert("Error", error.detail || "Could not respond to alert");
            }
        } catch (e) {
            Alert.alert("Error", "Failed to respond to alert");
            console.error(e);
        } finally {
            setRespondingTo(null);
        }
    };

    const getTagColor = (tag) => {
        const colors = {
            'police': '#2196F3',
            'fire': '#FF5722',
            'ambulance': '#4CAF50',
            'wildlife': '#8BC34A',
            'other': '#9E9E9E',
        };
        return colors[tag] || colors.other;
    };

    const getTagIcon = (tag) => {
        const icons = {
            'police': '🚔',
            'fire': '🔥',
            'ambulance': '🚑',
            'wildlife': '🦁',
            'other': '⚠️',
        };
        return icons[tag] || icons.other;
    };

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
        return date.toLocaleDateString();
    };

    const handleLogout = async () => {
        await AsyncStorage.multiRemove(['userToken', 'userCnic', 'userType', 'approvalStatus']);
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    };

    // Play/Stop voice alert audio
    const playVoiceAlert = async (alertId, audioUrl) => {
        try {
            // If already playing this audio, stop it
            if (playingAudioId === alertId && voiceSoundRef.current) {
                await voiceSoundRef.current.stopAsync();
                await voiceSoundRef.current.unloadAsync();
                voiceSoundRef.current = null;
                setPlayingAudioId(null);
                return;
            }

            // Stop any currently playing audio
            if (voiceSoundRef.current) {
                await voiceSoundRef.current.stopAsync();
                await voiceSoundRef.current.unloadAsync();
                voiceSoundRef.current = null;
            }

            // Construct full URL
            const fullUrl = audioUrl.startsWith('http') ? audioUrl : `${API_URL}${audioUrl}`;

            const { sound } = await Audio.Sound.createAsync(
                { uri: fullUrl },
                { shouldPlay: true }
            );
            voiceSoundRef.current = sound;
            setPlayingAudioId(alertId);

            // Listen for playback completion
            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.didJustFinish) {
                    setPlayingAudioId(null);
                    sound.unloadAsync();
                    voiceSoundRef.current = null;
                }
            });
        } catch (e) {
            console.error("Error playing audio:", e);
            Alert.alert("Error", "Could not play audio");
            setPlayingAudioId(null);
        }
    };

    // Mark alert as finished/resolved
    const finishAlert = async (alertId) => {
        setFinishingAlertId(alertId);
        try {
            const token = await AsyncStorage.getItem('userToken');
            const response = await fetch(`${API_URL}/alerts/${alertId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ status: 'resolved' }),
            });

            if (response.ok) {
                Alert.alert("Success", "Alert marked as resolved");
                fetchNearbyAlerts();
            } else {
                const error = await response.json();
                Alert.alert("Error", error.detail || "Could not finish alert");
            }
        } catch (e) {
            Alert.alert("Error", "Failed to finish alert");
        } finally {
            setFinishingAlertId(null);
        }
    };

    const renderAlertItem = ({ item }) => {
        const isWithin10km = item.distance_km <= 10;
        const sender = item.sender;

        return (
            <View style={[styles.alertCard, isWithin10km && styles.alertCardUrgent]}>
                <View style={styles.alertHeader}>
                    <View style={[styles.tagBadge, { backgroundColor: getTagColor(item.tag) }]}>
                        <Text style={styles.tagIcon}>{getTagIcon(item.tag)}</Text>
                        <Text style={styles.tagText}>{item.tag?.toUpperCase() || 'ALERT'}</Text>
                    </View>
                    <View style={styles.distanceBadge}>
                        <Text style={styles.distanceText}>{item.distance_km} km</Text>
                    </View>
                </View>

                <View style={styles.alertBody}>
                    <Text style={styles.alertType}>
                        {item.alert_type === 'sos' ? '🆘 SOS Alert' :
                            item.alert_type === 'voice' ? '🎙️ Voice Alert' : '📝 Text Alert'}
                    </Text>

                    {/* Text Content */}
                    {item.content && (
                        <Text style={styles.alertContent} numberOfLines={2}>{item.content}</Text>
                    )}

                    {/* Voice Alert - Transcription */}
                    {item.alert_type === 'voice' && (
                        <View style={styles.voiceSection}>
                            {item.audio_url && (
                                <TouchableOpacity
                                    style={styles.audioPlayButton}
                                    onPress={() => playVoiceAlert(item.id, item.audio_url)}
                                >
                                    <Text style={styles.audioPlayText}>
                                        {playingAudioId === item.id ? '⏹️ Stop' : '▶️ Play Voice'}
                                    </Text>
                                </TouchableOpacity>
                            )}
                            {item.transcription_status === 'completed' && item.transcription && (
                                <View style={styles.transcriptionBox}>
                                    <Text style={styles.transcriptionLabel}>📝 Transcription:</Text>
                                    <Text style={styles.transcriptionText}>{item.transcription}</Text>
                                    {item.transcription_keywords && (
                                        <View style={styles.keywordsRow}>
                                            <Text style={styles.keywordsLabel}>🔑 Keywords:</Text>
                                            <Text style={styles.keywordsText}>{item.transcription_keywords}</Text>
                                        </View>
                                    )}
                                </View>
                            )}
                            {item.transcription_status === 'pending' && (
                                <View style={styles.transcriptionPending}>
                                    <ActivityIndicator size="small" color="#4CAF50" />
                                    <Text style={styles.transcriptionPendingText}>Transcribing audio...</Text>
                                </View>
                            )}
                            {item.transcription_status === 'failed' && (
                                <Text style={styles.transcriptionFailed}>⚠️ Transcription failed</Text>
                            )}
                        </View>
                    )}

                    <Text style={styles.alertTime}>{formatTime(item.created_at)}</Text>

                    {/* Citizen Details */}
                    {sender && (
                        <View style={styles.senderDetails}>
                            <Text style={styles.senderTitle}>👤 Citizen Information:</Text>
                            {sender.full_name && <Text style={styles.senderInfo}>👤 {sender.full_name}</Text>}
                            {sender.phone && <Text style={styles.senderInfo}>📱 {sender.phone}</Text>}
                            {sender.email && <Text style={styles.senderInfo}>📧 {sender.email}</Text>}
                            {sender.address && <Text style={styles.senderInfo}>📍 {sender.address}</Text>}
                            {sender.gender && <Text style={styles.senderInfo}>👥 {sender.gender}</Text>}
                            {sender.cnic_masked && <Text style={styles.senderInfo}>🪪 CNIC: {sender.cnic_masked}</Text>}
                        </View>
                    )}
                </View>

                {isWithin10km && item.status === 'pending' && (
                    <TouchableOpacity
                        style={styles.respondButton}
                        onPress={() => respondToAlert(item)}
                        disabled={respondingTo === item.id}
                    >
                        {respondingTo === item.id ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.respondButtonText}>🚨 RESPOND</Text>
                        )}
                    </TouchableOpacity>
                )}

                {item.status !== 'pending' && (
                    <View style={styles.respondedSection}>
                        <View style={styles.respondedBadge}>
                            <Text style={styles.respondedText}>
                                {item.status === 'resolved' ? '✅ Resolved' : '🚔 Responding'}
                            </Text>
                        </View>
                        {item.status === 'responded' && (
                            <TouchableOpacity
                                style={styles.finishButton}
                                onPress={() => finishAlert(item.id)}
                                disabled={finishingAlertId === item.id}
                            >
                                {finishingAlertId === item.id ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={styles.finishButtonText}>✓ Alert Finished</Text>
                                )}
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={styles.chatButton}
                            onPress={() => navigation.navigate('Chat', {
                                alertId: item.id,
                                alertType: item.alert_type,
                                otherUserName: sender?.full_name || 'Citizen',
                                otherUserType: 'citizen',
                            })}
                        >
                            <Text style={styles.chatButtonText}>💬 Chat</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={styles.root}>
            <StatusBar barStyle="light-content" />

            <LinearGradient
                colors={['#1a1a2e', '#16213e', '#0f3460']}
                style={styles.container}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => setSidebarOpen(true)} style={styles.menuButton}>
                        <Text style={styles.menuIcon}>☰</Text>
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <Text style={styles.headerTitle}>🚔 Police Dashboard</Text>
                        {location && (
                            <Text style={styles.locationText}>
                                📍 Location Active
                            </Text>
                        )}
                    </View>
                    <View style={styles.alertCount}>
                        <Text style={styles.alertCountText}>{alerts.filter(a => a.distance_km <= 10).length}</Text>
                    </View>
                </View>

                {/* Officer Info */}
                {officerInfo && (
                    <View style={styles.officerBanner}>
                        <Text style={styles.officerName}>{officerInfo.full_name || 'Officer'}</Text>
                        <Text style={styles.officerBadge}>Badge: {officerInfo.police_badge_number}</Text>
                    </View>
                )}

                {/* Alerts List */}
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#fff" />
                        <Text style={styles.loadingText}>Loading nearby alerts...</Text>
                    </View>
                ) : alerts.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyIcon}>✅</Text>
                        <Text style={styles.emptyText}>No active alerts in your area</Text>
                        <Text style={styles.emptySubtext}>
                            Alerts within 10km will appear here with sound notification
                        </Text>
                    </View>
                ) : (
                    <ScrollView
                        contentContainerStyle={styles.listContent}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={() => {
                                setRefreshing(true);
                                fetchNearbyAlerts();
                            }} tintColor="#fff" />
                        }
                    >
                        {/* Active Responses Section */}
                        {alerts.some(a => a.status === 'responded') && (
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>My Active Responses</Text>
                            </View>
                        )}
                        {alerts.filter(a => a.status === 'responded').map(item => (
                            <View key={item.id} style={styles.listItemContainer}>
                                {renderAlertItem({ item })}
                            </View>
                        ))}

                        {/* Nearby Alerts Section */}
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Nearby Alerts</Text>
                        </View>
                        {alerts.filter(a => a.status === 'pending').length === 0 ? (
                            <Text style={styles.emptySectionText}>No new pending alerts nearby</Text>
                        ) : (
                            alerts.filter(a => a.status === 'pending').map(item => (
                                <View key={item.id} style={styles.listItemContainer}>
                                    {renderAlertItem({ item })}
                                </View>
                            ))
                        )}
                    </ScrollView>
                )}
            </LinearGradient>

            {/* Sidebar */}
            <Modal
                visible={sidebarOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setSidebarOpen(false)}
            >
                <TouchableOpacity
                    style={styles.sidebarOverlay}
                    activeOpacity={1}
                    onPress={() => setSidebarOpen(false)}
                >
                    <View style={styles.sidebar}>
                        <Text style={styles.sidebarTitle}>🚔 Menu</Text>

                        <TouchableOpacity
                            style={styles.sidebarItem}
                            onPress={() => {
                                setSidebarOpen(false);
                                navigation.navigate('PoliceHistory');
                            }}
                        >
                            <Text style={styles.sidebarItemText}>📋 Response History</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.sidebarItem}
                            onPress={() => {
                                setSidebarOpen(false);
                                navigation.navigate('Profile');
                            }}
                        >
                            <Text style={styles.sidebarItemText}>👤 My Profile</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.sidebarItem, styles.logoutItem]}
                            onPress={handleLogout}
                        >
                            <Text style={[styles.sidebarItemText, styles.logoutText]}>🚪 Logout</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        paddingTop: 50,
        paddingBottom: 15,
    },
    menuButton: {
        padding: 10,
    },
    menuIcon: {
        fontSize: 24,
        color: '#fff',
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    locationText: {
        fontSize: 12,
        color: '#4CAF50',
        marginTop: 2,
    },
    alertCount: {
        backgroundColor: '#ff4444',
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
    },
    alertCountText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    officerBanner: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingVertical: 10,
        paddingHorizontal: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    officerName: {
        color: '#fff',
        fontWeight: 'bold',
    },
    officerBadge: {
        color: 'rgba(255,255,255,0.7)',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#fff',
        marginTop: 10,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
    },
    emptyIcon: {
        fontSize: 60,
        marginBottom: 20,
    },
    emptyText: {
        fontSize: 18,
        color: '#fff',
        fontWeight: 'bold',
        textAlign: 'center',
    },
    emptySubtext: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
        marginTop: 10,
    },
    listContent: {
        padding: 15,
    },
    alertCard: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 15,
        padding: 15,
        marginBottom: 15,
    },
    alertCardUrgent: {
        borderWidth: 2,
        borderColor: '#ff4444',
    },
    alertHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    tagBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 15,
    },
    tagIcon: {
        fontSize: 14,
        marginRight: 5,
    },
    tagText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    distanceBadge: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 15,
    },
    distanceText: {
        color: '#fff',
        fontSize: 12,
    },
    alertBody: {
        marginBottom: 10,
    },
    alertType: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 5,
    },
    alertContent: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
        marginBottom: 5,
    },
    alertTime: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
    },
    senderInfo: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
        marginTop: 5,
    },
    respondButton: {
        backgroundColor: '#ff4444',
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    respondButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    respondedBadge: {
        backgroundColor: 'rgba(76,175,80,0.3)',
        paddingVertical: 8,
        borderRadius: 10,
        alignItems: 'center',
    },
    respondedText: {
        color: '#4CAF50',
        fontSize: 14,
    },
    sidebarOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sidebar: {
        width: width * 0.7,
        height: '100%',
        backgroundColor: '#1a1a2e',
        padding: 20,
        paddingTop: 60,
    },
    sidebarTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 30,
    },
    sidebarItem: {
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    sidebarItemText: {
        fontSize: 16,
        color: '#fff',
    },
    logoutItem: {
        marginTop: 'auto',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
        borderBottomWidth: 0,
    },
    logoutText: {
        color: '#ff6b6b',
    },
    senderDetails: {
        marginTop: 10,
        padding: 10,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 8,
    },
    senderTitle: {
        color: '#fff',
        fontSize: 13,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    respondedSection: {
        marginTop: 5,
    },
    // Voice transcription styles
    voiceSection: {
        marginTop: 10,
        marginBottom: 10,
    },
    audioIndicator: {
        backgroundColor: 'rgba(76, 175, 80, 0.2)',
        padding: 8,
        borderRadius: 8,
        marginBottom: 8,
    },
    audioText: {
        color: '#4CAF50',
        fontSize: 13,
    },
    transcriptionBox: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        padding: 12,
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: '#4CAF50',
    },
    transcriptionLabel: {
        color: '#4CAF50',
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    transcriptionText: {
        color: '#fff',
        fontSize: 14,
        lineHeight: 20,
    },
    keywordsRow: {
        marginTop: 8,
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
    },
    keywordsLabel: {
        color: '#FFC107',
        fontSize: 11,
        marginRight: 5,
    },
    keywordsText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 11,
        fontStyle: 'italic',
    },
    transcriptionPending: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
    },
    transcriptionPendingText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
        marginLeft: 8,
    },
    transcriptionFailed: {
        color: '#ff6b6b',
        fontSize: 12,
        fontStyle: 'italic',
    },
    audioPlayButton: {
        backgroundColor: '#2196F3',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 8,
    },
    audioPlayText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    finishButton: {
        backgroundColor: '#4CAF50',
        padding: 10,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 8,
    },
    finishButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    chatButton: {
        backgroundColor: '#0084ff',
        padding: 10,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 8,
    },
    chatButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    // New Section Styles
    sectionHeader: {
        paddingVertical: 10,
        paddingHorizontal: 5,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        marginBottom: 10,
        marginTop: 10,
    },
    sectionTitle: {
        color: '#4CAF50',
        fontSize: 14,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    emptySectionText: {
        color: 'rgba(255,255,255,0.5)',
        fontStyle: 'italic',
        textAlign: 'center',
        marginVertical: 10,
    },
    listItemContainer: {
        marginBottom: 15,
    },
});

export default PoliceDashboardScreen;
