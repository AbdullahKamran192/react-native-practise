import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack
      initialRouteName="sign-in"
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: "#F7F7F7",
        },
        headerTintColor: "#222",
        contentStyle: {
          backgroundColor: "#F7F7F7",
        },
      }}
    >
      <Stack.Screen
        name="sign-in"
        options={{
          title: "Sign in",
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="sign-up"
        options={{
          title: "Create account",
        }}
      />
    </Stack>
  );
}