import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import API_URL from '../config';

const HistoryScreen = () => {
    const navigation = useNavigation();
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [playingId, setPlayingId] = useState(null);
    const soundRef = useRef(null);

    useEffect(() => {
        fetchAlerts();

        // Cleanup on unmount
        return () => {
            if (soundRef.current) {
                soundRef.current.unloadAsync();
            }
        };
    }, []);

    const fetchAlerts = async () => {
        try {
            const token = await AsyncStorage.getItem('userToken');
            if (!token) {
                navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                return;
            }

            const response = await fetch(`${API_URL}/alerts`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setAlerts(data);
            } else if (response.status === 401) {
                // Token expired
                await AsyncStorage.removeItem('userToken');
                navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
            }
        } catch (error) {
            console.error('Error fetching alerts:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchAlerts();
    };

    const playAudio = async (alertId, audioUrl) => {
        try {
            // Stop any currently playing audio
            if (soundRef.current) {
                await soundRef.current.unloadAsync();
                soundRef.current = null;
            }

            // If clicking the same item that's playing, just stop
            if (playingId === alertId) {
                setPlayingId(null);
                return;
            }

            // Construct full URL
            const fullUrl = `${API_URL}${audioUrl}`;
            console.log('Playing audio from:', fullUrl);

            // Load and play audio
            const { sound } = await Audio.Sound.createAsync(
                { uri: fullUrl },
                { shouldPlay: true }
            );

            soundRef.current = sound;
            setPlayingId(alertId);

            // When playback finishes
            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.didJustFinish) {
                    setPlayingId(null);
                }
            });
        } catch (error) {
            console.error('Error playing audio:', error);
            setPlayingId(null);
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

    const getAlertColor = (type) => {
        switch (type) {
            case 'sos': return '#e63946';
            case 'text': return '#4361ee';
            case 'voice': return '#7209b7';
            default: return '#6c757d';
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const renderAlertItem = ({ item }) => {
        const isPlaying = playingId === item.id;
        const hasAudio = item.alert_type === 'voice' && item.audio_url;
        const hasResponse = item.status !== 'pending' && item.responding_officer;

        return (
            <View style={styles.alertCard}>
                <TouchableOpacity
                    style={styles.alertMain}
                    onPress={() => navigation.navigate('AlertDetail', { alert: item })}
                >
                    <View style={[styles.alertIconContainer, { backgroundColor: getAlertColor(item.alert_type) }]}>
                        <Text style={styles.alertIcon}>{getAlertIcon(item.alert_type)}</Text>
                    </View>
                    <View style={styles.alertContent}>
                        <Text style={styles.alertType}>
                            {item.alert_type.toUpperCase()} ALERT
                        </Text>

                        {item.content ? (
                            <Text style={styles.alertText} numberOfLines={2}>
                                {item.content}
                            </Text>
                        ) : null}

                        {hasAudio && (
                            <View style={styles.audioIndicator}>
                                <Text style={styles.audioIcon}>🎵</Text>
                                <Text style={styles.audioText}>Voice Alert</Text>
                            </View>
                        )}

                        <Text style={styles.alertTime}>{formatDate(item.created_at)}</Text>
                    </View>
                    <Text style={{ fontSize: 20, color: 'rgba(255,255,255,0.5)' }}>›</Text>
                </TouchableOpacity>

                {/* Officer Response Info */}
                {hasResponse && (
                    <View style={styles.responseInfo}>
                        <View style={styles.officerInfo}>
                            <Text style={styles.officerIcon}>👮</Text>
                            <View>
                                <Text style={styles.responseStatus}>
                                    {item.status === 'resolved' ? '✅ Resolved' : '🚔 Responded'}
                                </Text>
                                <Text style={styles.officerName}>
                                    {item.responding_officer.full_name || 'Officer'}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={styles.histChatButton}
                            onPress={() => navigation.navigate('Chat', {
                                alertId: item.id,
                                alertType: item.alert_type,
                                otherUserName: item.responding_officer.full_name || 'Officer',
                                otherUserType: 'police',
                            })}
                        >
                            <Text style={styles.histChatButtonText}>💬</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Pending Status */}
                {item.status === 'pending' && (
                    <View style={styles.pendingBadge}>
                        <Text style={styles.pendingText}>⏳ Waiting for response</Text>
                    </View>
                )}
            </View>
        );
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
                    <Text style={styles.headerTitle}>Alert History</Text>
                    <View style={styles.backButton} />
                </View>

                {/* Content */}
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#fff" />
                    </View>
                ) : alerts.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyIcon}>📭</Text>
                        <Text style={styles.emptyText}>No alerts yet</Text>
                        <Text style={styles.emptySubtext}>
                            Your emergency alerts will appear here
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        data={alerts}
                        renderItem={renderAlertItem}
                        keyExtractor={(item) => item.id.toString()}
                        contentContainerStyle={styles.listContainer}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                tintColor="#fff"
                            />
                        }
                    />
                )}
            </LinearGradient>
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
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backIcon: {
        fontSize: 28,
        color: '#fff',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#fff',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyIcon: {
        fontSize: 60,
        marginBottom: 20,
    },
    emptyText: {
        fontSize: 22,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 10,
    },
    emptySubtext: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
    },
    listContainer: {
        padding: 20,
    },
    alertCard: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 15,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    alertIconContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    alertIcon: {
        fontSize: 24,
    },
    alertContent: {
        flex: 1,
        justifyContent: 'center',
    },
    alertType: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 4,
    },
    alertText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
        marginBottom: 4,
    },
    audioIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(114, 9, 183, 0.3)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 15,
        alignSelf: 'flex-start',
        marginBottom: 4,
    },
    audioIcon: {
        fontSize: 14,
        marginRight: 5,
    },
    audioText: {
        fontSize: 12,
        color: '#fff',
    },
    alertTime: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
    },
    alertMain: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    responseInfo: {
        marginTop: 15,
        paddingTop: 15,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    officerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    officerIcon: {
        fontSize: 24,
        marginRight: 10,
    },
    responseStatus: {
        color: '#4CAF50',
        fontWeight: 'bold',
        fontSize: 12,
        marginBottom: 2,
    },
    officerName: {
        color: '#fff',
        fontSize: 13,
    },
    histChatButton: {
        backgroundColor: '#2196F3',
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    },
    histChatButtonText: {
        fontSize: 20,
    },
    pendingBadge: {
        marginTop: 15,
        paddingTop: 15,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
        flexDirection: 'row',
        alignItems: 'center',
    },
    pendingText: {
        color: '#FFC107',
        fontSize: 13,
        fontStyle: 'italic',
    },
});

export default HistoryScreen;
