/**
 * Horizontal swipe-to-switch between the two tabs.
 *
 * Wraps a tab screen so a clear horizontal fling navigates to the sibling tab,
 * while vertical scrolling still works (the pan only activates on horizontal
 * movement and yields to vertical via failOffsetY). Pass whichever direction
 * applies — Today gets `onLeft` (→ Browse), Browse gets `onRight` (→ Today).
 */
import React from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

const DISTANCE = 64; // px of horizontal travel to count as a switch
const VELOCITY = 250; // or a quick flick

export function SwipeTabs({
  onLeft,
  onRight,
  children,
}: {
  onLeft?: () => void;
  onRight?: () => void;
  children: React.ReactNode;
}) {
  const pan = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-18, 18])
    .onEnd((e) => {
      'worklet';
      const far = Math.abs(e.translationX) > DISTANCE;
      const fast = Math.abs(e.velocityX) > VELOCITY;
      if (!far && !fast) return;
      if (e.translationX < 0 && onLeft) runOnJS(onLeft)();
      else if (e.translationX > 0 && onRight) runOnJS(onRight)();
    });

  return <GestureDetector gesture={pan}>{children}</GestureDetector>;
}
