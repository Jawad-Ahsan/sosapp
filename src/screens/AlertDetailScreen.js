import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    ActivityIndicator,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Audio } from 'expo-av';
import { Linking } from 'react-native';
import API_URL from '../config';

const { width, height } = Dimensions.get('window');

const AlertDetailScreen = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { alert } = route.params;

    const [isPlaying, setIsPlaying] = useState(false);
    const soundRef = useRef(null);
    const mapRef = useRef(null);

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            if (soundRef.current) {
                soundRef.current.unloadAsync();
            }
        };
    }, []);

    const playAudio = async () => {
        try {
            if (isPlaying && soundRef.current) {
                await soundRef.current.pauseAsync();
                setIsPlaying(false);
                return;
            }

            if (soundRef.current) {
                await soundRef.current.playAsync();
                setIsPlaying(true);
                return;
            }

            const fullUrl = alert.audio_url.startsWith('http') ? alert.audio_url : `${API_URL}${alert.audio_url}`;
            const { sound } = await Audio.Sound.createAsync(
                { uri: fullUrl },
                { shouldPlay: true }
            );

            soundRef.current = sound;
            setIsPlaying(true);

            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.didJustFinish) {
                    setIsPlaying(false);
                    sound.unloadAsync();
                    soundRef.current = null;
                }
            });
        } catch (error) {
            console.error('Error playing audio:', error);
            setIsPlaying(false);
        }
    };

    const getAlertIcon = (type) => {
        switch (type) {
            case 'sos': return '🆘';
            case 'text': return '✏️';
            case 'voice': return '🎤';
            default: return '⚠️';
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString();
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#1a1a2e', '#16213e', '#0f3460']}
                style={styles.gradient}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Text style={styles.backIcon}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Alert Details</Text>
                    <View style={styles.backButton} />
                </View>

                <ScrollView style={styles.content}>
                    {/* Map */}
                    {alert.latitude && alert.longitude && (
                        <View style={styles.mapContainer}>
                            <MapView
                                provider={PROVIDER_GOOGLE}
                                style={styles.map}
                                initialRegion={{
                                    latitude: alert.latitude,
                                    longitude: alert.longitude,
                                    latitudeDelta: 0.01,
                                    longitudeDelta: 0.01,
                                }}
                            >
                                <Marker
                                    coordinate={{
                                        latitude: alert.latitude,
                                        longitude: alert.longitude,
                                    }}
                                    title="Alert Location"
                                />
                            </MapView>
                        </View>
                    )}

                    {/* Alert Info Card */}
                    <View style={styles.card}>
                        <View style={styles.typeHeader}>
                            <Text style={styles.icon}>{getAlertIcon(alert.alert_type)}</Text>
                            <Text style={styles.typeText}>{alert.alert_type.toUpperCase()} ALERT</Text>
                            <Text style={styles.dateText}>{formatDate(alert.created_at)}</Text>
                        </View>

                        {/* Status */}
                        <View style={styles.statusContainer}>
                            <Text style={styles.statusLabel}>Status: </Text>
                            <Text style={[styles.statusValue,
                            { color: alert.status === 'resolved' ? '#4CAF50' : '#FFC107' }
                            ]}>
                                {alert.status.toUpperCase()}
                            </Text>
                        </View>

                        {/* Content */}
                        {alert.content && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Content</Text>
                                <Text style={styles.contentText}>{alert.content}</Text>
                            </View>
                        )}

                        {/* Citizen Info (for officers) */}
                        {alert.sender && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Citizen Details</Text>
                                <View style={styles.officerBox}>
                                    <Text style={styles.officerName}>
                                        👤 {alert.sender.full_name || 'Unknown Citizen'}
                                    </Text>
                                    {alert.sender.phone && (
                                        <TouchableOpacity onPress={() => Linking.openURL(`tel:${alert.sender.phone}`)}>
                                            <Text style={styles.officerDetail}>📞 {alert.sender.phone}</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Audio Player */}
                        {alert.alert_type === 'voice' && alert.audio_url && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Voice Message</Text>
                                <TouchableOpacity
                                    style={styles.playButton}
                                    onPress={playAudio}
                                >
                                    <Text style={styles.playButtonText}>
                                        {isPlaying ? '⏸️ Pause Audio' : '▶️ Play Audio'}
                                    </Text>
                                </TouchableOpacity>

                                {/* Transcription */}
                                {alert.transcription && (
                                    <View style={styles.transcriptionBox}>
                                        <Text style={styles.transcriptionLabel}>Transcription:</Text>
                                        <Text style={styles.transcriptionText}>{alert.transcription}</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Officer Info */}
                        {alert.responding_officer && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Responding Officer</Text>
                                <View style={styles.officerBox}>
                                    <Text style={styles.officerName}>
                                        👮 {alert.responding_officer.full_name || 'Officer'}
                                    </Text>
                                    {alert.responding_officer.badge_number && (
                                        <Text style={styles.officerDetail}>
                                            Badge: {alert.responding_officer.badge_number}
                                        </Text>
                                    )}
                                    <TouchableOpacity
                                        style={styles.chatButton}
                                        onPress={() => navigation.navigate('Chat', {
                                            alertId: alert.id,
                                            alertType: alert.alert_type,
                                            otherUserName: alert.responding_officer.full_name || 'Officer',
                                            otherUserType: 'police',
                                        })}
                                    >
                                        <Text style={styles.chatButtonText}>💬 Open Chat</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </View>
                </ScrollView>
            </LinearGradient>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    gradient: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 20,
    },
    backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    backIcon: { fontSize: 28, color: '#fff' },
    headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
    content: { flex: 1, padding: 20 },
    mapContainer: {
        height: 200,
        borderRadius: 15,
        overflow: 'hidden',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    map: { width: '100%', height: '100%' },
    card: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 15,
        padding: 20,
        marginBottom: 30,
    },
    typeHeader: { alignItems: 'center', marginBottom: 20 },
    icon: { fontSize: 40, marginBottom: 10 },
    typeText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    dateText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 5 },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        backgroundColor: 'rgba(0,0,0,0.2)',
        padding: 8,
        borderRadius: 8,
    },
    statusLabel: { color: 'rgba(255,255,255,0.7)', marginRight: 5 },
    statusValue: { fontWeight: 'bold' },
    section: { marginBottom: 20 },
    sectionTitle: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    contentText: { color: '#fff', fontSize: 16, lineHeight: 24 },
    playButton: {
        backgroundColor: '#2196F3',
        padding: 12,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 10,
    },
    playButtonText: { color: '#fff', fontWeight: 'bold' },
    transcriptionBox: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 12,
        borderRadius: 8,
        marginTop: 5,
    },
    transcriptionLabel: { color: '#4CAF50', fontSize: 12, marginBottom: 4 },
    transcriptionText: { color: 'rgba(255,255,255,0.9)', fontStyle: 'italic' },
    officerBox: {
        backgroundColor: 'rgba(76, 175, 80, 0.15)',
        padding: 15,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(76, 175, 80, 0.3)',
    },
    officerName: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
    officerDetail: { color: 'rgba(255,255,255,0.7)', marginBottom: 10 },
    chatButton: {
        backgroundColor: '#4CAF50',
        padding: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    chatButtonText: { color: '#fff', fontWeight: 'bold' },
});

export default AlertDetailScreen;
