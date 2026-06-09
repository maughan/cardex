import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";

type Mode = "signin" | "signup";

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
        <Text style={styles.brand}>CarDex</Text>
        <Text style={styles.tagline}>Catch the cars you spot in the wild.</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#6B7178"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#6B7178"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error && <Text style={styles.error}>{error}</Text>}
        {notice && <Text style={styles.notice}>{notice}</Text>}

        <Pressable style={styles.primary} onPress={submit} disabled={busy}>
          {busy
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.primaryText}>{mode === "signin" ? "Sign in" : "Create account"}</Text>}
        </Pressable>

        <Pressable
          style={styles.switch}
          onPress={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          <Text style={styles.switchText}>
            {mode === "signin"
              ? "New here? Create an account"
              : "Already have an account? Sign in"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#0B0C0F" },
  inner: { flex: 1, justifyContent: "center", paddingHorizontal: 28 },
  brand: { color: "#fff", fontSize: 38, fontWeight: "800", textAlign: "center" },
  tagline: { color: "#9AA0A6", fontSize: 15, textAlign: "center", marginTop: 6, marginBottom: 32 },
  input: { backgroundColor: "#15171C", color: "#fff", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, marginBottom: 12, borderWidth: 1, borderColor: "#1E2127" },
  error: { color: "#E5534B", fontSize: 14, marginBottom: 8 },
  notice: { color: "#3DA35D", fontSize: 14, marginBottom: 8 },
  primary: { backgroundColor: "#2F80ED", borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 8 },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  switch: { alignItems: "center", paddingVertical: 16 },
  switchText: { color: "#2F80ED", fontSize: 14 },
});
