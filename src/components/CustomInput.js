import React from 'react';
import { View, TextInput, StyleSheet, Text } from 'react-native';

const CustomInput = ({
    value,
    setValue,
    placeholder,
    secureTextEntry,
    label,
    keyboardType,
    maxLength,
    editable = true,
    multiline = false,
}) => {
    return (
        <View style={styles.container}>
            {label && <Text style={styles.label}>{label}</Text>}
            <View style={[styles.inputContainer, !editable && styles.disabledContainer]}>
                <TextInput
                    value={value}
                    onChangeText={setValue}
                    placeholder={placeholder}
                    style={[styles.input, multiline && styles.multilineInput]}
                    secureTextEntry={secureTextEntry}
                    placeholderTextColor="#888"
                    keyboardType={keyboardType}
                    maxLength={maxLength}
                    editable={editable}
                    multiline={multiline}
                    numberOfLines={multiline ? 3 : 1}
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        marginBottom: 15,
    },
    label: {
        color: '#333',
        marginBottom: 5,
        fontWeight: 'bold',
    },
    inputContainer: {
        backgroundColor: '#fff',
        borderColor: '#e8e8e8',
        borderWidth: 1,
        borderRadius: 5,
        paddingHorizontal: 10,
        paddingVertical: 10,
        // Shadow for modern look
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.20,
        shadowRadius: 1.41,
        elevation: 2,
    },
    disabledContainer: {
        backgroundColor: '#f0f0f0',
        opacity: 0.7,
    },
    input: {
        fontSize: 16,
    },
    multilineInput: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
});

export default CustomInput;
