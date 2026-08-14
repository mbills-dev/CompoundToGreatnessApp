import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  View,
  InputAccessoryView,
  Text,
  TouchableOpacity,
} from 'react-native';

export const KEYBOARD_DONE_ACCESSORY_ID = 'onboarding-keyboard-done';

export type KeyboardStepWrapperRef = {
  scrollToEnd: (options?: { animated?: boolean }) => void;
};

const KeyboardStepWrapper = forwardRef<KeyboardStepWrapperRef, {
  children: React.ReactNode;
  contentContainerStyle?: any;
  scrollEnabled?: boolean;
}>(({ children, contentContainerStyle, scrollEnabled = true }, ref) => {
  const scrollRef = useRef<ScrollView>(null);

  useImperativeHandle(ref, () => ({
    scrollToEnd: (options?: { animated?: boolean }) => {
      scrollRef.current?.scrollToEnd(options);
    },
  }));

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={contentContainerStyle}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          scrollEnabled={scrollEnabled}
          automaticallyAdjustKeyboardInsets={true}
        >
          {children}
        </ScrollView>
      </TouchableWithoutFeedback>
      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={KEYBOARD_DONE_ACCESSORY_ID}>
          <View style={{ backgroundColor: '#1A1A1A', flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' }}>
            <TouchableOpacity onPress={Keyboard.dismiss}>
              <Text style={{ color: '#CCFF00', fontFamily: 'Inter-Bold', fontSize: 16 }}>Done</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      )}
    </KeyboardAvoidingView>
  );
});

KeyboardStepWrapper.displayName = 'KeyboardStepWrapper';

export default KeyboardStepWrapper;
