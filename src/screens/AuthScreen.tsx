import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";
import { C } from "../theme/colors";
import { F } from "../theme/type";
import { Frame } from "../components/ui/Frame";
import { PixelButton } from "../components/ui/PixelButton";

type Mode = "signin" | "signup";

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // "PRESS START" blink
  const blink = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [blink]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setNotice("Check your email to confirm your account, then sign in.");
        setMode("signin");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.inner}>
        {/* Console header */}
        <Text style={styles.brand}>CARDEX</Text>
        <Text style={styles.tagline}>A POKÉDEX FOR CARS YOU SPOT</Text>

        <Animated.Text style={[styles.pressStart, { opacity: blink }]}>
          ▶ PRESS START
        </Animated.Text>

        {/* Credential frame */}
        <Frame style={styles.frame}>
          <Text style={styles.frameTitle}>
            {mode === "signin" ? "SIGN IN" : "CREATE ACCOUNT"}
          </Text>

          <TextInput
            style={styles.input}
            placeholder="EMAIL"
            placeholderTextColor={C.textDim}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="PASSWORD"
            placeholderTextColor={C.textDim}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {error && <Text style={styles.error}>{error}</Text>}
          {notice && <Text style={styles.notice}>{notice}</Text>}

          {busy
            ? <ActivityIndicator color={C.accent} style={styles.loading} />
            : (
              <PixelButton
                label={mode === "signin" ? "START" : "REGISTER"}
                onPress={submit}
                variant="primary"
                style={styles.submitBtn}
              />
            )}
        </Frame>

        <Pressable
          style={styles.switchRow}
          onPress={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          <Text style={styles.switchText}>
            {mode === "signin"
              ? "NEW PLAYER? CREATE ACCOUNT"
              : "ALREADY REGISTERED? SIGN IN"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.lcdBg },
  inner: { flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 16 },
  brand: {
    fontFamily: F.display,
    fontSize: 28,
    color: C.accent,
    textAlign: "center",
    letterSpacing: 6,
  },
  tagline: {
    fontFamily: F.body,
    fontSize: 14,
    color: C.textDim,
    textAlign: "center",
    letterSpacing: 1,
  },
  pressStart: {
    fontFamily: F.display,
    fontSize: 10,
    color: C.gold,
    textAlign: "center",
    letterSpacing: 1,
    marginVertical: 4,
  },
  frame: { marginTop: 4 },
  frameTitle: {
    fontFamily: F.display,
    fontSize: 8,
    color: C.text,
    letterSpacing: 1,
    marginBottom: 14,
  },
  input: {
    backgroundColor: C.panelHi,
    color: C.text,
    borderRadius: 2,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontFamily: F.body,
    fontSize: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.line,
    minHeight: 44,
  },
  error: { fontFamily: F.body, color: C.red, fontSize: 16, marginBottom: 6 },
  notice: { fontFamily: F.body, color: C.green, fontSize: 16, marginBottom: 6 },
  loading: { marginVertical: 14 },
  submitBtn: { marginTop: 4, width: "100%" },
  switchRow: { alignItems: "center", paddingVertical: 12 },
  switchText: { fontFamily: F.body, color: C.accent, fontSize: 16, letterSpacing: 0.5 },
});
