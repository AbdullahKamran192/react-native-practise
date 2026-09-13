import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { File } from "expo-file-system";
import { Platform } from "react-native";

export async function chooseMealPhoto(camera: boolean): Promise<string | null> {
  if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) throw new Error("Allow camera access to take a meal photo.");
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1 };
  const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled) return null;
  const asset = result.assets[0];
  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > 1200) context.resize(asset.width >= asset.height ? { width: 1200 } : { height: 1200 });
  const rendered = await context.renderAsync();
  const photo = await rendered.saveAsync({ format: SaveFormat.WEBP, compress: 0.75 });
  return photo.uri;
}

export async function readMealPhoto(uri: string): Promise<ArrayBuffer> {
  const bytes = Platform.OS === "web" ? await (await fetch(uri)).arrayBuffer() : await new File(uri).arrayBuffer();
  if (bytes.byteLength > 2 * 1024 * 1024) throw new Error("Photo is too large. Please choose a smaller photo (under 2 MB after compression).");
  return bytes;
}
