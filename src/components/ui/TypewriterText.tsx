import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Text } from "react-native";
import type { StyleProp, TextStyle } from "react-native";

interface Props {
  text: string;
  style?: StyleProp<TextStyle>;
  speed?: number; // ms per character
  reduceMotion?: boolean;
  onDone?: () => void;
}

export function TypewriterText({ text, style, speed = 40, reduceMotion = false, onDone }: Props) {
  const [displayed, setDisplayed] = useState(reduceMotion ? text : "");
  const done = useRef(reduceMotion);

  const finish = useCallback(() => {
    if (!done.current) {
      done.current = true;
      setDisplayed(text);
      onDone?.();
    }
  }, [text, onDone]);

  useEffect(() => {
    if (reduceMotion) {
      setDisplayed(text);
      done.current = true;
      onDone?.();
      return;
    }
    done.current = false;
    setDisplayed("");
    let i = 0;
    const tick = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(tick);
        done.current = true;
        onDone?.();
      }
    }, speed);
    return () => clearInterval(tick);
  }, [text, speed, reduceMotion, onDone]);

  return (
    <Pressable onPress={finish} hitSlop={8}>
      <Text style={style}>{displayed}</Text>
    </Pressable>
  );
}
