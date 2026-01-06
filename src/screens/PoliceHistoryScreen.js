import React, { useState, useEffect } from 'react';
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
import API_URL from '../config';

const PoliceHistoryScreen = () => {
    const navigation = useNavigation();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [history, setHistory] = useState([]);

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            const token = await AsyncStorage.getItem('userToken');
            const response = await fetch(`${API_URL}/police/history`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (response.ok) {
                const data = await response.json();
                setHistory(data);
            }
        } catch (e) {
            console.error("Error fetching history:", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const getStatusColor = (status) => {
        const colors = {
            'en_route': '#FFC107',
            'arrived': '#2196F3',
            'resolved': '#4CAF50',
            'cancelled': '#9E9E9E',
        };
        return colors[status] || colors.resolved;
    };

    const getStatusIcon = (status) => {
        const icons = {
            'en_route': '🚗',
            'arrived': '📍',
            'resolved': '✅',
            'cancelled': '❌',
        };
        return icons[status] || '✅';
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

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const renderHistoryItem = ({ item }) => {
        const handlePress = () => {
            const alertData = {
                id: item.alert_id,
                alert_type: item.alert_type,
                status: item.status,
                content: item.alert_content,
                latitude: item.latitude,
                longitude: item.longitude,
                audio_url: item.audio_url,
                transcription: item.transcription,
                created_at: item.response_time,
                sender: {
                    full_name: item.citizen_name,
                    phone: item.citizen_phone,
                },
                responding_officer: { full_name: 'Me' }
            };
            navigation.navigate('AlertDetail', { alert: alertData });
        };

        return (
            <TouchableOpacity style={styles.historyCard} onPress={handlePress} activeOpacity={0.7}>
                <View style={styles.cardHeader}>
                    <View style={[styles.tagBadge, { backgroundColor: getTagColor(item.alert_tag) }]}>
                        <Text style={styles.tagText}>{item.alert_tag?.toUpperCase() || 'ALERT'}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                        <Text style={styles.statusIcon}>{getStatusIcon(item.status)}</Text>
                        <Text style={styles.statusText}>{item.status?.replace('_', ' ').toUpperCase()}</Text>
                    </View>
                </View>

                <View style={styles.cardBody}>
                    <Text style={styles.alertTypeBadge}>
                        {item.alert_type === 'sos' ? '🆘' : item.alert_type === 'voice' ? '🎤' : '📝'} {item.alert_type?.toUpperCase()}
                    </Text>

                    {item.alert_content ? (
                        <Text style={styles.contentText} numberOfLines={2}>{item.alert_content}</Text>
                    ) : null}

                    {item.citizen_name ? (
                        <Text style={styles.citizenText}>👤 {item.citizen_name}</Text>
                    ) : null}

                    <View style={styles.cardFooter}>
                        <Text style={styles.dateText}>📅 {formatDate(item.response_time)}</Text>
                        {item.distance_km != null && (
                            <Text style={styles.distanceText}>📍 {item.distance_km.toFixed(1)} km away</Text>
                        )}
                    </View>
                </View>
                <Text style={{ position: 'absolute', right: 15, top: '50%', fontSize: 20, color: 'rgba(255,255,255,0.3)' }}>›</Text>
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.root}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={styles.loadingText}>Loading history...</Text>
                </View>
            </LinearGradient>
        );
    }

    return (
        <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.root}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backIcon}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>📋 Response History</Text>
                <View style={{ width: 40 }} />
            </View>

            {history.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyIcon}>📋</Text>
                    <Text style={styles.emptyText}>No response history yet</Text>
                    <Text style={styles.emptySubtext}>
                        Your responses to alerts will appear here
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={history}
                    renderItem={renderHistoryItem}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => {
                                setRefreshing(true);
                                fetchHistory();
                            }}
                            tintColor="#fff"
                        />
                    }
                />
            )}
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    root: {
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
    backButton: {
        padding: 10,
    },
    backIcon: {
        fontSize: 24,
        color: '#fff',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
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
    historyCard: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 15,
        padding: 15,
        marginBottom: 15,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    tagBadge: {
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 15,
    },
    tagText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: 'bold',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 15,
    },
    statusIcon: {
        fontSize: 12,
        marginRight: 4,
    },
    statusText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    cardBody: {},
    alertTypeBadge: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    contentText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
        marginBottom: 8,
    },
    citizenText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 13,
        marginBottom: 8,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    dateText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
    },
    distanceText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
    },
});

export default PoliceHistoryScreen;
