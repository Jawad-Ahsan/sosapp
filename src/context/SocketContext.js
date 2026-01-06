import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        let newSocket;

        const initSocket = async () => {
            const token = await AsyncStorage.getItem('userToken');
            const userData = await AsyncStorage.getItem('user'); // Assuming we store user obj

            if (token && userData) {
                const user = JSON.parse(userData);

                // Initialize Socket
                newSocket = io(API_URL, {
                    transports: ['websocket'],
                    query: { token: token } // If we wanted auth middleware
                });

                newSocket.on('connect', () => {
                    console.log('Socket Connected:', newSocket.id);

                    // Join user-specific room
                    newSocket.emit('join_room', `user_${user.id}`);

                    // Join role-specific room (e.g. police_all)
                    if (user.user_type === 'police') {
                        newSocket.emit('join_room', 'police_all');
                    }
                });

                newSocket.on('disconnect', () => {
                    console.log('Socket Disconnected');
                });

                setSocket(newSocket);
            }
        };

        const checkAuth = async () => {
            // We listen for changes or just run once? 
            // Ideally we rely on App state, but for now lets try init on mount.
            await initSocket();
        }

        checkAuth();

        return () => {
            if (newSocket) newSocket.disconnect();
        };
    }, []);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
};
