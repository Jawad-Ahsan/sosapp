import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { API_URL } from '../config';

const QUEUE_KEY = 'offline_alerts_queue';

export const saveToQueue = async (alertData) => {
    try {
        const queueJson = await AsyncStorage.getItem(QUEUE_KEY);
        const queue = queueJson ? JSON.parse(queueJson) : [];

        // Add timestamp if not present
        alertData.queued_at = new Date().toISOString();

        queue.push(alertData);
        await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
        console.log('Alert saved to offline queue. Queue size:', queue.length);
        return true;
    } catch (e) {
        console.error('Failed to save to offline queue:', e);
        return false;
    }
};

export const processQueue = async () => {
    const queueJson = await AsyncStorage.getItem(QUEUE_KEY);
    if (!queueJson) return;

    let queue = JSON.parse(queueJson);
    if (queue.length === 0) return;

    console.log(`Processing offline queue: ${queue.length} items`);

    // Check connection first
    const state = await NetInfo.fetch();
    if (!state.isConnected) {
        console.log('Still offline, skipping sync.');
        return;
    }

    const token = await AsyncStorage.getItem('userToken');
    if (!token) return;

    const remainingQueue = [];
    let syncedCount = 0;

    for (const alert of queue) {
        try {
            console.log('Syncing alert:', alert.alert_type);
            const response = await fetch(`${API_URL}/alerts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(alert),
            });

            if (response.ok) {
                syncedCount++;
            } else {
                // If it failed but not network error (e.g. 400), maybe drop it? 
                // For safety, let's keep it if it's a server error (500), drop if client (400)
                // Simplified: Keep if status >= 500 or 0 (network), drop otherwise
                if (response.status >= 500 || response.status === 0) {
                    remainingQueue.push(alert);
                } else {
                    console.log('Dropping invalid queued alert:', response.status);
                }
            }
        } catch (e) {
            console.error('Sync failed for item:', e);
            remainingQueue.push(alert);
        }
    }

    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remainingQueue));
    return syncedCount;
};
