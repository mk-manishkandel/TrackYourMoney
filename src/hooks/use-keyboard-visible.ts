import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

/** True while the software keyboard is on screen (or animating in). */
export function useKeyboardVisible() {
  const [visible, setVisible] = useState(Keyboard.isVisible());
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', () => setVisible(true));
    const hide = Keyboard.addListener('keyboardWillHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}
