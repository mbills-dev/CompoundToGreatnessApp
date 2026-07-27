import React from 'react';
import { View, StyleSheet, Image } from 'react-native';

export default function BrandedLoadingScreen() {
  return (
    <View style={styles.loading}>
      <Image
        source={require('@/assets/images/c2g-wordmark-dark.png')}
        style={{ width: 260, height: 65 }}
        resizeMode="contain"
      />
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
});
