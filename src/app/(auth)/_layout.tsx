import { useAppTheme } from "@/theme/AppThemeProvider";
import { Stack } from "expo-router";

export default function AuthLayout() {
  const appTheme = useAppTheme();

  return (
    <Stack
      initialRouteName="sign-in"
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: appTheme.color("#F7F7F7", "surface"),
        },
        headerTintColor: appTheme.color("#222", "text"),
        contentStyle: {
          backgroundColor: appTheme.color("#F7F7F7", "surface"),
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