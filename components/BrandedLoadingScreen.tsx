import React from 'react';
import { View, StyleSheet, Image, Dimensions } from 'react-native';

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

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const styles = StyleSheet.create({
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    zIndex: 999,
  },
});
