import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, ScrollView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../config';

const SafeWalkScreen = () => {
    const navigation = useNavigation();
    const [isActive, setIsActive] = useState(false);
    const [duration, setDuration] = useState('15');
    const [timeLeft, setTimeLeft] = useState(null);
    const [sessionId, setSessionId] = useState(null);
    const [location, setLocation] = useState(null);
    const timerRef = useRef(null);
    const locationSubscriptionRef = useRef(null);

    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission to access location was denied');
            }
        })();

        // Cleanup on unmount
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (locationSubscriptionRef.current) locationSubscriptionRef.current.remove();
        };
    }, []);

    const startSafeWalk = async () => {
        try {
            const token = await AsyncStorage.getItem('userToken');
            const currentLocation = await Location.getCurrentPositionAsync({});

            const response = await fetch(`${API_URL}/safewalk/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    duration_minutes: parseInt(duration),
                    start_latitude: currentLocation.coords.latitude,
                    start_longitude: currentLocation.coords.longitude
                })
            });

            const data = await response.json();
            if (response.ok) {
                setSessionId(data.id);
                setIsActive(true);
                setTimeLeft(parseInt(duration) * 60);
                startTracking(data.id);
                startTimer();
            } else {
                Alert.alert('Error', data.detail || 'Failed to start Safe Walk');
            }
        } catch (e) {
            Alert.alert('Error', 'Network error. Please try again.');
            console.error(e);
        }
    };

    const startTimer = () => {
        timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const startTracking = async (id) => {
        locationSubscriptionRef.current = await Location.watchPositionAsync(
            {
                accuracy: Location.Accuracy.High,
                timeInterval: 30000,
                distanceInterval: 50,
            },
            (newLoc) => {
                setLocation(newLoc);
                sendHeartbeat(id, newLoc);
            }
        );
    };

    const sendHeartbeat = async (id, loc) => {
        try {
            const token = await AsyncStorage.getItem('userToken');
            await fetch(`${API_URL}/safewalk/${id}/checkin`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude
                })
            });
        } catch (e) {
            console.log('Heartbeat failed', e);
        }
    };

    const endSafeWalk = async () => {
        try {
            const token = await AsyncStorage.getItem('userToken');
            const response = await fetch(`${API_URL}/safewalk/${sessionId}/end`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok || response.status === 400 || response.status === 404) {
                setIsActive(false);
                setSessionId(null);
                if (timerRef.current) clearInterval(timerRef.current);
                if (locationSubscriptionRef.current) locationSubscriptionRef.current.remove();
                Alert.alert("Safe!", "You have successfully ended your Safe Walk.");
            }
        } catch (e) {
            Alert.alert('Error', 'Failed to end session. Check network.');
        }
    };

    const panic = async () => {
        try {
            const token = await AsyncStorage.getItem('userToken');
            await fetch(`${API_URL}/safewalk/${sessionId}/panic`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            Alert.alert("SOS SENT!", "Emergency contacts have been notified.");
            setIsActive(false); // Optionally keep it active to track, but for now we reset UI
        } catch (e) {
            Alert.alert('Error', 'Failed to send Panic signal.');
        }
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>🛡️ Safe Walk</Text>

            {!isActive ? (
                <View style={styles.setupContainer}>
                    <Text style={styles.label}>Duration (minutes)</Text>
                    <TextInput
                        style={styles.input}
                        value={duration}
                        onChangeText={setDuration}
                        keyboardType="numeric"
                    />
                    <TouchableOpacity style={styles.startButton} onPress={startSafeWalk}>
                        <Text style={styles.buttonText}>Start Safe Walk</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.activeContainer}>
                    <View style={styles.timerCircle}>
                        <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
                        <Text style={styles.subText}>Remaining</Text>
                    </View>

                    <Text style={styles.infoText}>We are tracking your location...</Text>

                    <TouchableOpacity style={styles.endButton} onPress={endSafeWalk}>
                        <Text style={styles.buttonText}>I'M SAFE</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.panicButton} onPress={panic}>
                        <Text style={styles.buttonText}>PANIC</Text>
                    </TouchableOpacity>
                </View>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        padding: 20,
        backgroundColor: '#0e1c26',
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#e74c3c',
        marginBottom: 40,
    },
    setupContainer: {
        width: '100%',
        alignItems: 'center',
    },
    label: {
        color: '#fff',
        marginBottom: 10,
        fontSize: 16,
    },
    input: {
        backgroundColor: '#1f2b36',
        color: '#fff',
        width: '50%',
        padding: 15,
        borderRadius: 10,
        fontSize: 20,
        textAlign: 'center',
        marginBottom: 30,
    },
    startButton: {
        backgroundColor: '#2ecc71',
        padding: 20,
        borderRadius: 50,
        width: '80%',
        alignItems: 'center',
    },
    activeContainer: {
        width: '100%',
        alignItems: 'center',
    },
    timerCircle: {
        width: 200,
        height: 200,
        borderRadius: 100,
        borderWidth: 5,
        borderColor: '#3498db',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 40,
    },
    timerText: {
        fontSize: 48,
        color: '#fff',
        fontWeight: 'bold',
    },
    subText: {
        color: '#bdc3c7',
    },
    infoText: {
        color: '#bdc3c7',
        marginBottom: 40,
        fontStyle: 'italic',
    },
    endButton: {
        backgroundColor: '#2ecc71',
        padding: 20,
        borderRadius: 15,
        width: '80%',
        alignItems: 'center',
        marginBottom: 20,
    },
    panicButton: {
        backgroundColor: '#c0392b',
        padding: 20,
        borderRadius: 15,
        width: '80%',
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});

export default SafeWalkScreen;
