import React from 'react';
import { View, StyleSheet, Image, Text } from 'react-native';

export default function BrandedLoadingScreen() {
  return (
    <View style={styles.loading}>
      <Image
        source={require('@/assets/images/logo-mark.png')}
        style={{ width: 72, height: 72, resizeMode: 'contain', marginBottom: 16 }}
      />
      <Text style={styles.title}>
        COMPOUND TO
      </Text>
      <Text style={styles.subtitle}>
        GREATNESS
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  title: {
    fontFamily: 'Inter-Black',
    fontSize: 22,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Inter-Black',
    fontSize: 22,
    color: '#CCFF00',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
