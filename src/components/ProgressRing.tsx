import { useAppTheme, useThemeStyles } from "@/theme/AppThemeProvider";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
type Props = {
  progress: number; size?: number; strokeWidth?: number; colour?: string;
  trackColour?: string; animationKey?: string; label: string; children?: ReactNode;
};
export default function ProgressRing({
  progress, size=72, strokeWidth=6, colour="#5A9D79", trackColour="#E9EEEB",
  animationKey, label, children,
}: Props) {
  const appTheme = useAppTheme();
  const styles = useThemeStyles(baseStyles);

  const value = useRef(new Animated.Value(0)).current;
  const [reduceMotion,setReduceMotion] = useState<boolean|null>(null);
  const fraction = Number.isFinite(progress) ? Math.min(1,Math.max(0,progress)) : 0;
  const radius=(size-strokeWidth)/2;
  const circumference=2*Math.PI*radius;
  useEffect(()=>{
    let active=true;
    void AccessibilityInfo.isReduceMotionEnabled().then(enabled=>{if(active)setReduceMotion(enabled);}).catch(()=>{if(active)setReduceMotion(false);});
    const subscription=AccessibilityInfo.addEventListener("reduceMotionChanged",setReduceMotion);
    return ()=>{active=false;subscription.remove();};
  },[]);
  useEffect(()=>{
    value.stopAnimation();
    value.setValue(0);
    if(reduceMotion===null)return;
    if(reduceMotion){value.setValue(fraction);return;}
    const animation=Animated.timing(value,{
      toValue:fraction,duration:2000,easing:Easing.inOut(Easing.cubic),useNativeDriver:false,
    });
    animation.start();
    return ()=>animation.stop();
  },[fraction,animationKey,reduceMotion,value]);
  return <View style={{width:size,height:size}} accessible accessibilityRole="progressbar"
    accessibilityLabel={label} accessibilityValue={{min:0,max:100,now:Math.round(fraction*100)}}>
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} accessible={false}>
      <Circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={appTheme.color(trackColour, "surface")} strokeWidth={strokeWidth}/>
      <AnimatedCircle cx={size/2} cy={size/2} r={radius} fill="none" stroke={appTheme.color(colour, "text")} strokeWidth={strokeWidth}
        strokeLinecap="round" strokeDasharray={[circumference,circumference]}
        strokeDashoffset={value.interpolate({inputRange:[0,1],outputRange:[circumference,0]})}
        opacity={value.interpolate({inputRange:[0,0.001,1],outputRange:[0,1,1],extrapolate:"clamp"})}
        rotation={-90} origin={`${size/2}, ${size/2}`}/>
    </Svg>
    <View pointerEvents="none" style={styles.center}>{children}</View>
  </View>;
}
const baseStyles=StyleSheet.create({center:{position:"absolute",top:0,right:0,bottom:0,left:0,alignItems:"center",justifyContent:"center",padding:12}});
