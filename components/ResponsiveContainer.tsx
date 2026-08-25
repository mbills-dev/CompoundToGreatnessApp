import { StyleSheet, View, ViewStyle } from 'react-native';
import { ReactNode } from 'react';

export const CONTENT_MAX_WIDTH = 480;

export const responsiveStyle = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  sheet: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
});

export function ResponsiveContainer({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
}) {
  return <View style={[responsiveStyle.container, style]}>{children}</View>;
}
