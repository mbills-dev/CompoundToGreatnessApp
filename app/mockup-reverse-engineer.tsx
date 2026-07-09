import { SafeAreaView, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import ReverseEngineerMockup from '@/components/identity/ReverseEngineerMockup';

export default function MockupReverseEngineerRoute() {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <ReverseEngineerMockup />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
