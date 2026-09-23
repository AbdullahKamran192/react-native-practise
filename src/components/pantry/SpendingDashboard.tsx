import { useAppTheme, useThemeStyles } from "@/theme/AppThemeProvider";
import { formatNumber } from "@/utils/formatNumber";
import { Text, View } from "react-native";
import Svg, { Line, Polyline, Text as SvgText } from "react-native-svg";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { shoppingUser, yearlySpending } from "@/api/shopping";
import { spendingSeries } from "@/utils/shoppingSpending";
import { MealButton, mealStyles as baseS } from "@/components/meals/ui";
import { brand } from "@/components/brand/theme";

export default function SpendingDashboard({ dailyBudget }: { dailyBudget: number }) {
  const appTheme = useAppTheme();
  const s = useThemeStyles(baseS);

  const today = new Date();
  const year = today.getFullYear();
  const query = useQuery({ queryKey: ["shopping-spending", year], queryFn: async () => {
    const user = await shoppingUser();
    const { data, error } = await supabase.from("shopping_trips").select("completed_at")
      .eq("user_id", user).order("completed_at").limit(1).maybeSingle();
    if (error) throw error;
    return { first: data?.completed_at ?? null, trips: await yearlySpending(year) };
  } });
  const series = query.data ? spendingSeries(query.data.trips, query.data.first, Number(dailyBudget), today) : null;
  const maximum = Math.max(1, series?.spent ?? 0, series?.expected ?? 0);
  const y = (value: number) => 145 - value / maximum * 115;
  const x = (day: number) => 50 + day / (series?.days ?? 1) * 240;
  const difference = (series?.spent ?? 0) - (series?.expected ?? 0);
  return <View style={[s.card, { marginVertical: 16 }]}>
    <Text style={s.heading}>Food spending · {year}</Text>
    {query.isLoading ? <Text style={s.muted}>Loading spending…</Text> : query.error ? <>
      <Text style={s.error}>Could not load spending.</Text>
      <MealButton title="Try again" secondary onPress={() => { void query.refetch(); }} />
    </> : series ? <>
      <Text style={s.title}>£{formatNumber(series.spent)}</Text>
      <Text style={s.muted}>Tracked since {new Date(query.data!.first!).toLocaleDateString()}</Text>
      <View accessibilityLabel={`Cumulative spending £${formatNumber(series.spent)}. Budget for this tracked period £${formatNumber(series.expected)}.`}>
        <Svg width="100%" height={180} viewBox="0 0 310 180">
          <Line x1={50} x2={290} y1={145} y2={145} stroke={appTheme.color(brand.border, "border")} />
          <SvgText x={0} y={35} fill={appTheme.color(brand.muted, "text")} fontSize={11}>£{maximum.toFixed(0)}</SvgText>
          <SvgText x={15} y={145} fill={appTheme.color(brand.muted, "text")} fontSize={11}>£0</SvgText>
          {dailyBudget > 0 && <Line x1={50} y1={145} x2={290} y2={y(series.expected)} stroke={appTheme.color("#DC9D2A", "text")} strokeWidth={2} strokeDasharray="5 5" />}
          <Polyline points={series.points.map(p => `${x(p.day)},${y(p.spent)}`).join(" ")} fill="none" stroke={appTheme.color(brand.teal, "text")} strokeWidth={3} />
          <SvgText x={50} y={170} fill={appTheme.color(brand.muted, "text")} fontSize={11}>{series.start.toLocaleDateString(undefined, { day: "numeric", month: "short" })}</SvgText>
          <SvgText x={290} y={170} textAnchor="end" fill={appTheme.color(brand.muted, "text")} fontSize={11}>Today</SvgText>
        </Svg>
      </View>
      <Text style={s.muted}>Teal: purchases · Dashed gold: budget</Text>
      {dailyBudget > 0 ? <><Text style={s.text}>Budget for this period: £{formatNumber(series.expected)}</Text>
        <Text style={[s.text, { color: appTheme.color(difference > 0 ? brand.red : brand.deepTeal, "text") }]}>£{formatNumber(Math.abs(difference))} {difference > 0 ? "over" : "under"} budget</Text>
        <Text style={s.muted}>Uses your current £{formatNumber(dailyBudget)} daily budget, from {series.start.toLocaleDateString()} through today.</Text></>
        : <Text style={s.muted}>Set a food budget in Settings to compare your spending.</Text>}
    </> : <Text style={s.muted}>Complete your first shopping trip to start tracking spending. Quick pantry additions are not counted.</Text>}
    <MealButton title="Start shopping" onPress={() => router.push("/shopping")} />
    <MealButton title="Purchase history" secondary onPress={() => router.push("/shoppingHistory")} />
  </View>;
}
