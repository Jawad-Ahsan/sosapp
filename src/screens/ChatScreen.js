import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_URL from '../config';

const ChatScreen = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { alertId, alertType, otherUserName, otherUserType } = route.params || {};

    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const flatListRef = useRef(null);
    const pollIntervalRef = useRef(null);

    useEffect(() => {
        fetchMessages();
        // Poll for new messages every 3 seconds
        pollIntervalRef.current = setInterval(fetchMessages, 3000);

        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }
        };
    }, []);

    const fetchMessages = async () => {
        try {
            const token = await AsyncStorage.getItem('userToken');
            const response = await fetch(`${API_URL}/chat/${alertId}`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (response.ok) {
                const data = await response.json();
                setMessages(data);
            }
        } catch (e) {
            console.error("Error fetching messages:", e);
        } finally {
            setLoading(false);
        }
    };

    const sendMessage = async () => {
        if (!newMessage.trim() || sending) return;

        setSending(true);
        try {
            const token = await AsyncStorage.getItem('userToken');
            const response = await fetch(`${API_URL}/chat/${alertId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    message: newMessage.trim(),
                    message_type: 'text',
                }),
            });

            if (response.ok) {
                setNewMessage('');
                fetchMessages();
            }
        } catch (e) {
            console.error("Error sending message:", e);
        } finally {
            setSending(false);
        }
    };

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return 'Today';
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const renderMessage = ({ item, index }) => {
        const isAutoMessage = item.message_type === 'auto';
        const showDateHeader = index === 0 ||
            formatDate(messages[index - 1]?.created_at) !== formatDate(item.created_at);

        return (
            <>
                {showDateHeader && (
                    <View style={styles.dateHeader}>
                        <Text style={styles.dateHeaderText}>{formatDate(item.created_at)}</Text>
                    </View>
                )}

                {isAutoMessage ? (
                    <View style={styles.autoMessageContainer}>
                        <Text style={styles.autoMessageText}>{item.message}</Text>
                    </View>
                ) : (
                    <View style={[
                        styles.messageContainer,
                        item.is_mine ? styles.myMessage : styles.theirMessage
                    ]}>
                        {!item.is_mine && (
                            <Text style={styles.senderName}>
                                {item.sender_type === 'police' ? '👮 ' : '👤 '}{item.sender_name}
                            </Text>
                        )}
                        <Text style={[
                            styles.messageText,
                            item.is_mine ? styles.myMessageText : styles.theirMessageText
                        ]}>
                            {item.message}
                        </Text>
                        <Text style={[
                            styles.timeText,
                            item.is_mine ? styles.myTimeText : styles.theirTimeText
                        ]}>
                            {formatTime(item.created_at)}
                            {item.is_mine && (item.read_at ? ' ✓✓' : ' ✓')}
                        </Text>
                    </View>
                )}
            </>
        );
    };

    if (loading) {
        return (
            <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.root}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={styles.loadingText}>Loading chat...</Text>
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
                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle}>
                        {otherUserType === 'police' ? '👮 ' : '👤 '}{otherUserName || 'Chat'}
                    </Text>
                    <Text style={styles.headerSubtitle}>
                        {alertType?.toUpperCase()} Alert #{alertId}
                    </Text>
                </View>
            </View>

            {/* Messages */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.chatContainer}
                keyboardVerticalOffset={0}
            >
                {messages.length === 0 ? (
                    <View style={styles.emptyChat}>
                        <Text style={styles.emptyChatIcon}>💬</Text>
                        <Text style={styles.emptyChatText}>No messages yet</Text>
                        <Text style={styles.emptyChatSubtext}>Send a message to start the conversation</Text>
                    </View>
                ) : (
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        renderItem={renderMessage}
                        keyExtractor={(item) => item.id.toString()}
                        contentContainerStyle={styles.messagesList}
                        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
                        onLayout={() => flatListRef.current?.scrollToEnd()}
                    />
                )}

                {/* Input */}
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.textInput}
                        placeholder="Type a message..."
                        placeholderTextColor="#666"
                        value={newMessage}
                        onChangeText={setNewMessage}
                        multiline
                        maxLength={500}
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, (!newMessage.trim() || sending) && styles.sendButtonDisabled]}
                        onPress={sendMessage}
                        disabled={!newMessage.trim() || sending}
                    >
                        {sending ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <Text style={styles.sendButtonText}>➤</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    root: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingTop: 50,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    backButton: { padding: 10 },
    backIcon: { fontSize: 24, color: '#fff' },
    headerInfo: { marginLeft: 10, flex: 1 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
    headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: '#fff', marginTop: 10 },
    chatContainer: { flex: 1 },
    emptyChat: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
    emptyChatIcon: { fontSize: 60, marginBottom: 15 },
    emptyChatText: { fontSize: 18, color: '#fff', fontWeight: 'bold' },
    emptyChatSubtext: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center' },
    messagesList: { padding: 15, paddingBottom: 10 },
    dateHeader: { alignItems: 'center', marginVertical: 15 },
    dateHeaderText: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 10,
    },
    autoMessageContainer: {
        backgroundColor: 'rgba(76, 175, 80, 0.3)',
        borderRadius: 10,
        padding: 12,
        marginVertical: 5,
        alignSelf: 'center',
        maxWidth: '90%',
    },
    autoMessageText: { color: '#fff', fontSize: 14, textAlign: 'center' },
    messageContainer: {
        maxWidth: '80%',
        borderRadius: 15,
        padding: 12,
        marginVertical: 3,
    },
    myMessage: {
        alignSelf: 'flex-end',
        backgroundColor: '#0084ff',
        borderBottomRightRadius: 5,
    },
    theirMessage: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderBottomLeftRadius: 5,
    },
    senderName: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.6)',
        marginBottom: 4,
    },
    messageText: { fontSize: 15, lineHeight: 20 },
    myMessageText: { color: '#fff' },
    theirMessageText: { color: '#fff' },
    timeText: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
    myTimeText: { color: 'rgba(255,255,255,0.6)' },
    theirTimeText: { color: 'rgba(255,255,255,0.4)' },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: 10,
        paddingBottom: 20,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    textInput: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 10,
        color: '#fff',
        fontSize: 15,
        maxHeight: 100,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#0084ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    sendButtonDisabled: { backgroundColor: '#555' },
    sendButtonText: { fontSize: 20, color: '#fff' },
});

export default ChatScreen;
