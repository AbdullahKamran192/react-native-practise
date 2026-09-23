// Existing light colours are the source of truth: light mode returns them unchanged.
// These aliases let shared styles keep their existing spacing and light shades.
export type ColorRole = "surface" | "text" | "border" | "shadow";
export const darkPalette = {
  background: "#081419", surface: "#102329", raised: "#193139",
  text: "#F1F7F8", muted: "#A8BBC0", border: "#34515B",
  teal: "#70D1DE", tealSurface: "#153B43", tealBorder: "#35616A",
  green: "#8AD79B", greenSurface: "#183B2C", greenBorder: "#3F7151",
  blue: "#90C6FA", blueSurface: "#19354F", blueBorder: "#3E6387",
  purple: "#CBB0F0", purpleSurface: "#332544", purpleBorder: "#66517F",
  pink: "#F3A0C2", pinkSurface: "#432839", pinkBorder: "#80536A",
  red: "#FF9EA7", redSurface: "#43262D", redBorder: "#82505A",
  orange: "#F7BB7D", orangeSurface: "#422F1E", orangeBorder: "#80613B",
  yellow: "#F1D47F", yellowSurface: "#39321C", yellowBorder: "#756338",
  lime: "#C7DD8D", limeSurface: "#303B20", limeBorder: "#627841",
};

const normalize = (value: string) => {
  const upper = value === "white" ? "#FFFFFF" : value === "black" ? "#000000" : value.toUpperCase();
  return /^#[0-9A-F]{3}$/.test(upper) ? "#" + [...upper.slice(1)].map(c => c + c).join("") : upper;
};
const families = {
  teal: "#00556B #007F95 #147967 #367687 #BCDCE2 #D3ECEF #DCEDEF #E2F4F8 #E2F5EF #E3F4F6 #E4F6F0 #E5F6F4 #E7F1F3 #EFFBFA",
  green: "#205D3A #23733D #246B3A #247440 #287C3D #294A32 #365A40 #4E6F57 #5A9D79 #73BC87 #BDDFC5 #C9DFCD #D9F2E2 #DDF3E4 #E9EEEB #EAF7EC #EDF7EF",
  blue: "#1764B1 #2089DC #2F95DC #426D9C #E5F4FC #EAF4FF #ECF3FA",
  purple: "#8053AD #F3EDFC",
  pink: "#AF3264 #FDEDF4",
  red: "#7B1D1D #922F30 #9B3030 #A12F2F #A32D2D #A62B36 #B3261E #B63D3D #B72D2D #BA2436 #C62828 #C83E3E #DF7A7A #F0C8CE #F1B8B8 #F1C4C4 #F5CCD2 #FBE0DF #FBE9E9 #FDEBED #FDECEC #FFD6D6 #FFF0F1",
  orange: "#4F350B #7A5413 #884315 #925A13 #AD510B #DC9D2A #E6A550 #ECD09C #FFE0B2 #FFE0C2 #FFF3D6 #FFF3E2",
  yellow: "#705000 #715600 #806815 #916500 #E1C759 #F2E2A6 #FFF1B8 #FFF3C4 #FFF8DB",
  lime: "#587520 #A8CA68 #B7E665 #EAF4D3",
} as const;
const tones = new Map(Object.entries(families).flatMap(([tone, values]) => values.split(" ").map(value => [value, tone as keyof typeof families] as const)));
const neutralText = new Set("#000000 #222222 #333333 #444444 #555555 #102739 #354D58".split(" "));
const neutralMuted = new Set("#617783 #666666 #777777 #86939E #999999 #9A9A9A #A0A0A0 #BBBBBB #BDBDBD #CCCCCC".split(" "));
const neutralSurface = new Set("#D4D4D4 #D5D5D5 #E2E2E2 #E7E7E7 #ECECEC #EDEDED #EFEFEF #F0F0F0 #F3F3F3 #F7F7F7 #FFFFFF #F3FAFB #F6FBFC".split(" "));

export function darkColor(value: string, role: ColorRole = "text"): string {
  if (role === "shadow") return value;
  const key = normalize(value);
  if (role === "text" && key === "#FFFFFF") return value; // Text on filled buttons stays white.
  if (neutralText.has(key)) return role === "text" ? darkPalette.text : role === "border" ? darkPalette.border : darkPalette.raised;
  if (neutralMuted.has(key)) return role === "text" ? darkPalette.muted : role === "border" ? darkPalette.border : darkPalette.raised;
  if (neutralSurface.has(key)) {
    if (role === "text") return darkPalette.text;
    if (role === "border") return darkPalette.border;
    if (["#F3FAFB", "#F6FBFC", "#F7F7F7"].includes(key)) return darkPalette.background;
    return key === "#FFFFFF" ? darkPalette.surface : darkPalette.raised;
  }
  const tone = tones.get(key);
  if (!tone) return value; // Transparent overlays, photos and unrecognised brand colours are preserved.
  if (role === "text") return darkPalette[tone];
  if (role === "border") return darkPalette[`${tone}Border`];
  // Keep saturated filled controls, whose labels are white, rather than turning them pastel.
  const rgb = key.slice(1).match(/../g)!.map(c => parseInt(c, 16));
  if (Math.max(...rgb) < 210 && Math.min(...rgb) < 140) return value;
  return darkPalette[`${tone}Surface`];
}
