import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    RefreshControl,
    Modal,
    ScrollView,
    Image,
    TextInput,
    Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_URL from '../config';

const { width } = Dimensions.get('window');

const AdminDashboardScreen = () => {
    const navigation = useNavigation();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [pendingOfficers, setPendingOfficers] = useState([]);
    const [allOfficers, setAllOfficers] = useState([]);
    const [allCitizens, setAllCitizens] = useState([]);
    const [activeTab, setActiveTab] = useState('pending');
    const [processingId, setProcessingId] = useState(null);

    // Document viewer modal
    const [documentModalVisible, setDocumentModalVisible] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);

    // Suspension modal
    const [suspendModalVisible, setSuspendModalVisible] = useState(false);
    const [suspendReason, setSuspendReason] = useState('');
    const [userToSuspend, setUserToSuspend] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const token = await AsyncStorage.getItem('userToken');

            const [pendingRes, officersRes, citizensRes] = await Promise.all([
                fetch(`${API_URL}/admin/pending-officers`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                }),
                fetch(`${API_URL}/admin/all-officers`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                }),
                fetch(`${API_URL}/admin/all-citizens`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                }),
            ]);

            if (pendingRes.ok) setPendingOfficers(await pendingRes.json());
            if (officersRes.ok) setAllOfficers(await officersRes.json());
            if (citizensRes.ok) setAllCitizens(await citizensRes.json());
        } catch (e) {
            console.error("Error fetching data:", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const approveOfficer = async (userId) => {
        setProcessingId(userId);
        try {
            const token = await AsyncStorage.getItem('userToken');
            const response = await fetch(`${API_URL}/admin/approve/${userId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (response.ok) {
                Alert.alert("Success", "Officer approved successfully");
                fetchData();
            } else {
                const error = await response.json();
                Alert.alert("Error", error.detail || "Failed to approve");
            }
        } catch (e) {
            Alert.alert("Error", "Could not approve officer");
        } finally {
            setProcessingId(null);
        }
    };

    const rejectOfficer = async (userId) => {
        Alert.alert("Confirm Rejection", "Are you sure you want to reject this officer?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Reject", style: "destructive",
                onPress: async () => {
                    setProcessingId(userId);
                    try {
                        const token = await AsyncStorage.getItem('userToken');
                        const response = await fetch(`${API_URL}/admin/reject/${userId}`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${token}` },
                        });
                        if (response.ok) {
                            Alert.alert("Done", "Officer rejected");
                            fetchData();
                        }
                    } catch (e) {
                        Alert.alert("Error", "Could not reject officer");
                    } finally {
                        setProcessingId(null);
                    }
                }
            }
        ]);
    };

    const openSuspendModal = (user) => {
        setUserToSuspend(user);
        setSuspendReason('');
        setSuspendModalVisible(true);
    };

    const suspendUser = async () => {
        if (suspendReason.length < 10) {
            Alert.alert("Error", "Please provide a reason (at least 10 characters)");
            return;
        }

        setProcessingId(userToSuspend.id);
        try {
            const token = await AsyncStorage.getItem('userToken');
            const response = await fetch(`${API_URL}/admin/suspend/${userToSuspend.id}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ reason: suspendReason }),
            });

            if (response.ok) {
                Alert.alert("Done", "User suspended");
                setSuspendModalVisible(false);
                fetchData();
            } else {
                const error = await response.json();
                Alert.alert("Error", error.detail || "Failed to suspend");
            }
        } catch (e) {
            Alert.alert("Error", "Could not suspend user");
        } finally {
            setProcessingId(null);
        }
    };

    const unsuspendUser = async (userId) => {
        setProcessingId(userId);
        try {
            const token = await AsyncStorage.getItem('userToken');
            const response = await fetch(`${API_URL}/admin/unsuspend/${userId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (response.ok) {
                Alert.alert("Done", "User reactivated");
                fetchData();
            }
        } catch (e) {
            Alert.alert("Error", "Could not unsuspend user");
        } finally {
            setProcessingId(null);
        }
    };

    const deleteUser = async (userId) => {
        Alert.alert("⚠️ Delete Account", "This action cannot be undone. Are you sure?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete", style: "destructive",
                onPress: async () => {
                    setProcessingId(userId);
                    try {
                        const token = await AsyncStorage.getItem('userToken');
                        const response = await fetch(`${API_URL}/admin/user/${userId}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${token}` },
                        });
                        if (response.ok) {
                            Alert.alert("Done", "User deleted");
                            fetchData();
                        }
                    } catch (e) {
                        Alert.alert("Error", "Could not delete user");
                    } finally {
                        setProcessingId(null);
                    }
                }
            }
        ]);
    };

    const viewDocuments = (user) => {
        setSelectedUser(user);
        setDocumentModalVisible(true);
    };

    const handleLogout = async () => {
        await AsyncStorage.multiRemove(['userToken', 'userCnic', 'userType', 'approvalStatus']);
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    };

    const getStatusBadge = (user) => {
        if (user.account_status === 'suspended') return { color: '#f44336', text: '⛔ SUSPENDED' };
        if (user.account_status === 'deleted') return { color: '#9E9E9E', text: '🗑️ DELETED' };
        if (user.approval_status === 'pending') return { color: '#FFC107', text: '⏳ PENDING' };
        if (user.approval_status === 'rejected') return { color: '#f44336', text: '❌ REJECTED' };
        return { color: '#4CAF50', text: '✅ ACTIVE' };
    };

    const renderPendingItem = ({ item }) => (
        <View style={styles.userCard}>
            <View style={styles.cardHeader}>
                <Text style={styles.userName}>{item.full_name || 'Unknown'}</Text>
                <View style={[styles.badge, { backgroundColor: '#FFC107' }]}>
                    <Text style={styles.badgeText}>⏳ PENDING</Text>
                </View>
            </View>

            <View style={styles.cardBody}>
                <Text style={styles.infoText}>🪪 CNIC: {item.cnic}</Text>
                <Text style={styles.infoText}>🎖️ Badge: {item.police_badge_number || 'N/A'}</Text>
                <Text style={styles.infoText}>🏢 Station: {item.police_station || 'N/A'}</Text>
                <Text style={styles.infoText}>📊 Rank: {item.police_rank || 'N/A'}</Text>
            </View>

            <TouchableOpacity style={styles.viewDocsButton} onPress={() => viewDocuments(item)}>
                <Text style={styles.viewDocsText}>📄 View Documents</Text>
            </TouchableOpacity>

            <View style={styles.cardActions}>
                <TouchableOpacity
                    style={[styles.actionButton, styles.approveButton]}
                    onPress={() => approveOfficer(item.id)}
                    disabled={processingId === item.id}
                >
                    {processingId === item.id ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <Text style={styles.actionButtonText}>✅ Approve</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={() => rejectOfficer(item.id)}
                    disabled={processingId === item.id}
                >
                    <Text style={styles.actionButtonText}>❌ Reject</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderUserItem = ({ item }) => {
        const status = getStatusBadge(item);
        const isOfficer = item.user_type === 'police';

        return (
            <View style={styles.userCard}>
                <View style={styles.cardHeader}>
                    <Text style={styles.userName}>
                        {isOfficer ? '👮 ' : '👤 '}{item.full_name || 'Unknown'}
                    </Text>
                    <View style={[styles.badge, { backgroundColor: status.color }]}>
                        <Text style={styles.badgeText}>{status.text}</Text>
                    </View>
                </View>

                <View style={styles.cardBody}>
                    <Text style={styles.infoText}>🪪 CNIC: {item.cnic}</Text>
                    {item.email && <Text style={styles.infoText}>📧 {item.email}</Text>}
                    {item.phone && <Text style={styles.infoText}>📱 {item.phone}</Text>}
                    {isOfficer && (
                        <>
                            <Text style={styles.infoText}>🎖️ Badge: {item.police_badge_number || 'N/A'}</Text>
                            <Text style={styles.infoText}>🏢 Station: {item.police_station || 'N/A'}</Text>
                        </>
                    )}
                </View>

                {isOfficer && (
                    <TouchableOpacity style={styles.viewDocsButton} onPress={() => viewDocuments(item)}>
                        <Text style={styles.viewDocsText}>📄 View Documents</Text>
                    </TouchableOpacity>
                )}

                {item.account_status !== 'deleted' && (
                    <View style={styles.cardActions}>
                        {item.account_status === 'suspended' ? (
                            <TouchableOpacity
                                style={[styles.actionButton, { backgroundColor: '#4CAF50', flex: 1 }]}
                                onPress={() => unsuspendUser(item.id)}
                                disabled={processingId === item.id}
                            >
                                <Text style={styles.actionButtonText}>🔓 Unsuspend</Text>
                            </TouchableOpacity>
                        ) : (
                            <>
                                <TouchableOpacity
                                    style={[styles.actionButton, { backgroundColor: '#FF9800' }]}
                                    onPress={() => openSuspendModal(item)}
                                    disabled={processingId === item.id}
                                >
                                    <Text style={styles.actionButtonText}>⏸️ Suspend</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.actionButton, styles.rejectButton]}
                                    onPress={() => deleteUser(item.id)}
                                    disabled={processingId === item.id}
                                >
                                    <Text style={styles.actionButtonText}>🗑️ Delete</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                )}
            </View>
        );
    };

    if (loading) {
        return (
            <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.root}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={styles.loadingText}>Loading...</Text>
                </View>
            </LinearGradient>
        );
    }

    return (
        <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.root}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>🛡️ Admin Dashboard</Text>
                <TouchableOpacity onPress={handleLogout}>
                    <Text style={styles.logoutButton}>Logout</Text>
                </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
                    onPress={() => setActiveTab('pending')}
                >
                    <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
                        Pending ({pendingOfficers.length})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'officers' && styles.activeTab]}
                    onPress={() => setActiveTab('officers')}
                >
                    <Text style={[styles.tabText, activeTab === 'officers' && styles.activeTabText]}>
                        Officers ({allOfficers.length})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'citizens' && styles.activeTab]}
                    onPress={() => setActiveTab('citizens')}
                >
                    <Text style={[styles.tabText, activeTab === 'citizens' && styles.activeTabText]}>
                        Citizens ({allCitizens.length})
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Content */}
            <FlatList
                data={
                    activeTab === 'pending' ? pendingOfficers :
                        activeTab === 'officers' ? allOfficers : allCitizens
                }
                renderItem={activeTab === 'pending' ? renderPendingItem : renderUserItem}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyIcon}>📋</Text>
                        <Text style={styles.emptyText}>No users found</Text>
                    </View>
                }
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { setRefreshing(true); fetchData(); }}
                        tintColor="#fff"
                    />
                }
            />

            {/* Document Viewer Modal */}
            <Modal
                visible={documentModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setDocumentModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.documentModal}>
                        <Text style={styles.modalTitle}>📄 Documents</Text>
                        <Text style={styles.modalSubtitle}>{selectedUser?.full_name || 'Unknown'}</Text>

                        <ScrollView style={styles.documentScroll}>
                            {selectedUser?.cnic_front_image && (
                                <View style={styles.documentSection}>
                                    <Text style={styles.documentLabel}>CNIC Front:</Text>
                                    <Image
                                        source={{ uri: `${API_URL}/${selectedUser.cnic_front_image}` }}
                                        style={styles.documentImage}
                                        resizeMode="contain"
                                    />
                                </View>
                            )}
                            {selectedUser?.cnic_back_image && (
                                <View style={styles.documentSection}>
                                    <Text style={styles.documentLabel}>CNIC Back:</Text>
                                    <Image
                                        source={{ uri: `${API_URL}/${selectedUser.cnic_back_image}` }}
                                        style={styles.documentImage}
                                        resizeMode="contain"
                                    />
                                </View>
                            )}
                            {selectedUser?.police_id_front_image && (
                                <View style={styles.documentSection}>
                                    <Text style={styles.documentLabel}>Police ID Front:</Text>
                                    <Image
                                        source={{ uri: `${API_URL}/${selectedUser.police_id_front_image}` }}
                                        style={styles.documentImage}
                                        resizeMode="contain"
                                    />
                                </View>
                            )}
                            {selectedUser?.police_id_back_image && (
                                <View style={styles.documentSection}>
                                    <Text style={styles.documentLabel}>Police ID Back:</Text>
                                    <Image
                                        source={{ uri: `${API_URL}/${selectedUser.police_id_back_image}` }}
                                        style={styles.documentImage}
                                        resizeMode="contain"
                                    />
                                </View>
                            )}
                            {!selectedUser?.cnic_front_image && !selectedUser?.police_id_front_image && (
                                <Text style={styles.noDocsText}>No documents uploaded</Text>
                            )}
                        </ScrollView>

                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={() => setDocumentModalVisible(false)}
                        >
                            <Text style={styles.closeButtonText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Suspension Modal */}
            <Modal
                visible={suspendModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setSuspendModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.suspendModal}>
                        <Text style={styles.modalTitle}>⚠️ Suspend User</Text>
                        <Text style={styles.modalSubtitle}>{userToSuspend?.full_name || userToSuspend?.cnic}</Text>

                        <Text style={styles.inputLabel}>Reason for suspension:</Text>
                        <TextInput
                            style={styles.reasonInput}
                            placeholder="Enter reason (min 10 characters)..."
                            placeholderTextColor="#666"
                            value={suspendReason}
                            onChangeText={setSuspendReason}
                            multiline
                            numberOfLines={3}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, { backgroundColor: '#666' }]}
                                onPress={() => setSuspendModalVisible(false)}
                            >
                                <Text style={styles.modalButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, { backgroundColor: '#FF9800' }]}
                                onPress={suspendUser}
                                disabled={processingId !== null}
                            >
                                {processingId ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={styles.modalButtonText}>Suspend</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    root: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 15,
    },
    headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
    logoutButton: { color: '#ff6b6b', fontSize: 16 },
    tabs: {
        flexDirection: 'row',
        marginHorizontal: 15,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 10,
        padding: 4,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 8,
    },
    activeTab: { backgroundColor: '#fff' },
    tabText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
    activeTabText: { color: '#1a1a2e' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: '#fff', marginTop: 10 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
    emptyIcon: { fontSize: 60, marginBottom: 20 },
    emptyText: { fontSize: 18, color: '#fff' },
    listContent: { padding: 15, paddingTop: 20 },
    userCard: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 15,
        padding: 15,
        marginBottom: 15,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    userName: { fontSize: 16, fontWeight: 'bold', color: '#fff', flex: 1 },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    cardBody: { marginBottom: 10 },
    infoText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginBottom: 3 },
    viewDocsButton: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        padding: 10,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 10,
    },
    viewDocsText: { color: '#fff', fontSize: 14 },
    cardActions: { flexDirection: 'row', justifyContent: 'space-between' },
    actionButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
        marginHorizontal: 3,
    },
    approveButton: { backgroundColor: '#4CAF50' },
    rejectButton: { backgroundColor: '#f44336' },
    actionButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    documentModal: {
        backgroundColor: '#1a1a2e',
        borderRadius: 15,
        padding: 20,
        width: '100%',
        maxHeight: '80%',
    },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
    modalSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginBottom: 15 },
    documentScroll: { maxHeight: 400 },
    documentSection: { marginBottom: 15 },
    documentLabel: { color: '#fff', fontSize: 14, marginBottom: 8, fontWeight: '600' },
    documentImage: { width: '100%', height: 200, borderRadius: 10, backgroundColor: '#333' },
    noDocsText: { color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: 40 },
    closeButton: {
        backgroundColor: '#666',
        padding: 12,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 15,
    },
    closeButtonText: { color: '#fff', fontSize: 16 },
    suspendModal: {
        backgroundColor: '#1a1a2e',
        borderRadius: 15,
        padding: 20,
        width: '100%',
    },
    inputLabel: { color: '#fff', fontSize: 14, marginBottom: 8 },
    reasonInput: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 10,
        padding: 15,
        color: '#fff',
        fontSize: 14,
        minHeight: 80,
        textAlignVertical: 'top',
    },
    modalButtons: { flexDirection: 'row', marginTop: 15 },
    modalButton: {
        flex: 1,
        padding: 12,
        borderRadius: 10,
        alignItems: 'center',
        marginHorizontal: 5,
    },
    modalButtonText: { color: '#fff', fontWeight: 'bold' },
});

export default AdminDashboardScreen;
