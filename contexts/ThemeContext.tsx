import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Theme = 'light' | 'dark';

interface ThemeColors {
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  primary: string;
  primaryDark: string;
  border: string;
  card: string;
  cardGradient: string[];
  success: string;
  error: string;
  warning: string;
}

interface ThemeContextType {
  theme: Theme;
  colors: ThemeColors;
  toggleTheme: () => void;
  isDark: boolean;
}

const lightColors: ThemeColors = {
  background: '#F5F5F0',
  backgroundSecondary: '#EBEBЕ6',
  backgroundTertiary: '#E0E0DB',
  text: '#000000',
  textSecondary: '#404040',
  textTertiary: '#808080',
  primary: '#ccff00',
  primaryDark: '#ccff00',
  border: '#E0E0DB',
  card: '#FFFFFF',
  cardGradient: ['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.9)'],
  success: '#ccff00',
  error: '#EF4444',
  warning: '#fc433d',
};

const darkColors: ThemeColors = {
  background: '#000000',
  backgroundSecondary: '#1A1A1A',
  backgroundTertiary: '#111111',
  text: '#FFFFFF',
  textSecondary: '#B0B0B0',
  textTertiary: '#808080',
  primary: '#ccff00',
  primaryDark: '#aed900',
  border: '#2A2A2A',
  card: '#1A1A1A',
  cardGradient: ['rgba(26, 26, 26, 0.95)', 'rgba(17, 17, 17, 0.95)'],
  success: '#ccff00',
  error: '#EF4444',
  warning: '#fc433d',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@app_theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setTheme(savedTheme);
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    }
  };

  const toggleTheme = async () => {
    try {
      const newTheme = theme === 'light' ? 'dark' : 'light';
      setTheme(newTheme);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const colors = theme === 'light' ? lightColors : darkColors;
  const isDark = theme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, colors, toggleTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
