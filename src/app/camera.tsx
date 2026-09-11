import { Ionicons } from "@expo/vector-icons";
import {
  CameraType,
  CameraView,
  useCameraPermissions,
} from "expo-camera";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import {
  useCallback,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type CameraIntent =
  | "pantry"
  | "consume";

export default function CameraScreen() {
  const { intent } =
    useLocalSearchParams<{
      intent?: CameraIntent;
    }>();

  const [facing, setFacing] =
    useState<CameraType>("back");

  const [hasScanned, setHasScanned] =
    useState(false);

  const [cameraActive, setCameraActive] =
    useState(false);

  const [permission, requestPermission] =
    useCameraPermissions();

  /*
   * This updates immediately and prevents several
   * navigation events from one barcode scan.
   */
  const scanLock = useRef(false);

  useFocusEffect(
    useCallback(() => {
      /*
       * Start the camera and unlock scanning whenever
       * this page receives focus.
       */
      setCameraActive(true);
      setHasScanned(false);
      scanLock.current = false;

      return () => {
        /*
         * Stop and unmount the camera when leaving
         * this page.
         */
        setCameraActive(false);
      };
    }, [])
  );

  function toggleCameraFacing() {
    setFacing((current) =>
      current === "back" ? "front" : "back"
    );
  }

  function handleBarcodeScanned({
    data,
  }: {
    data: string;
  }) {
    /*
     * Ignore scan events fired after the first one.
     */
    if (scanLock.current) {
      return;
    }

    /*
     * A ref changes immediately, unlike React state.
     */
    scanLock.current = true;
    setHasScanned(true);
    setCameraActive(false);

    const destination =
      intent === "consume"
        ? "/productConsume"
        : "/productPantry";

    /*
     * Missing or invalid intent values safely fall
     * back to the existing add-to-pantry flow.
     */
    router.push({
      pathname: destination,
      params: { data },
    });
  }

  if (!permission) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color="#222"
        />

        <Text style={styles.loadingText}>
          Preparing camera...
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <View style={styles.permissionIcon}>
          <Ionicons
            name="camera-outline"
            size={36}
            color="#222"
          />
        </View>

        <Text style={styles.permissionTitle}>
          Camera access required
        </Text>

        <Text style={styles.permissionMessage}>
          Allow camera access so you can scan food
          barcodes and view their nutritional
          information.
        </Text>

        <Pressable
          style={styles.permissionButton}
          onPress={requestPermission}
        >
          <Ionicons
            name="camera-outline"
            size={21}
            color="#fff"
          />

          <Text style={styles.permissionButtonText}>
            Allow Camera
          </Text>
        </Pressable>
      </View>
    );
  }

  /*
   * CameraView is unmounted when cameraActive is
   * false. This releases the camera while the
   * selected product page is open.
   */
  if (!cameraActive) {
    return null;
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing={facing}
        barcodeScannerSettings={{
          barcodeTypes: [
            "ean13",
            "ean8",
            "upc_a",
            "upc_e",
            "code128",
          ],
        }}
        onBarcodeScanned={
          hasScanned
            ? undefined
            : handleBarcodeScanned
        }
      />

      <View style={styles.scanFrame}>
        <View
          style={[
            styles.corner,
            styles.topLeft,
          ]}
        />

        <View
          style={[
            styles.corner,
            styles.topRight,
          ]}
        />

        <View
          style={[
            styles.corner,
            styles.bottomLeft,
          ]}
        />

        <View
          style={[
            styles.corner,
            styles.bottomRight,
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },

  camera: {
    flex: 1,
  },

  topContent: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },

  title: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "700",
  },

  instructions: {
    color: "#D5D5D5",
    fontSize: 14,
    marginTop: 5,
  },

  scanFrame: {
    width: "88%",
    height: 180,
    position: "absolute",
    top: "38%",
    left: 20,
  },

  corner: {
    position: "absolute",
    width: 34,
    height: 34,
    borderColor: "#fff",
  },

  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },

  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },

  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },

  bottomRight: {
    right: 0,
    bottom: 0,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderBottomRightRadius: 12,
  },

  flipButton: {
    height: 54,
    minWidth: 170,
    borderRadius: 16,
    backgroundColor: "#222",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 22,
  },

  flipButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: "#F7F7F7",
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: {
    color: "#777",
    fontSize: 14,
    marginTop: 14,
  },

  permissionContainer: {
    flex: 1,
    backgroundColor: "#F7F7F7",
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },

  permissionIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#EDEDED",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },

  permissionTitle: {
    color: "#222",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },

  permissionMessage: {
    color: "#777",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 24,
  },

  permissionButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: "#222",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
  },

  permissionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
