import React from 'react';
import { Text, StyleSheet, Pressable } from 'react-native';

const CustomButton = ({ onPress, text, type = "PRIMARY", bgColor, fgColor }) => {
    return (
        <Pressable
            onPress={onPress}
            style={[
                styles.container,
                styles[`container_${type}`],
                bgColor ? { backgroundColor: bgColor } : {},
            ]}>
            <Text
                style={[
                    styles.text,
                    styles[`text_${type}`],
                    fgColor ? { color: fgColor } : {},
                ]}>
                {text}
            </Text>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        padding: 15,
        marginVertical: 5,
        alignItems: 'center',
        borderRadius: 5,
    },
    container_PRIMARY: {
        backgroundColor: '#0056b3', // Police Blue
    },
    container_SECONDARY: {
        borderColor: '#0056b3',
        borderWidth: 2,
    },
    container_TERTIARY: {
        backgroundColor: 'transparent',
    },
    container_DANGER: {
        backgroundColor: '#d9534f', // Police Red
    },
    text: {
        fontWeight: 'bold',
        color: 'white',
    },
    text_PRIMARY: {
        color: 'white',
    },
    text_SECONDARY: {
        color: '#0056b3',
    },
    text_TERTIARY: {
        color: 'gray',
    },
    text_DANGER: {
        color: 'white',
    }
});

export default CustomButton;
