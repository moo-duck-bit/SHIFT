import {
  CameraMode,
  CameraType,
  CameraView,
  useCameraPermissions,
} from "expo-camera";
import { useRef, useState, useEffect } from "react";
import { Button, Pressable, StyleSheet, Text, View, Modal, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import AntDesign from "@expo/vector-icons/AntDesign";
import Feather from "@expo/vector-icons/Feather";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import MyModule from "../../modules/my-module";
import {  getCurrentUser } from "../config/firebase";
import { verifyPlanEvidence } from "../VLM/vlm";

interface CameraScreenProps {
  visible?: boolean;
  isInt?: boolean;
  onClose?: () => void;
  pln?: { act: string; ts?: string; alt?: string };
}

export const CameraScreen = ({ visible = false, isInt: initialIsInt = false, onClose, pln }: CameraScreenProps) => {
  const [perm, reqPerm] = useCameraPermissions();
  const ref = useRef<CameraView>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [mode, setMode] = useState<CameraMode>("picture");
  const [facing, setFacing] = useState<CameraType>("back");
  const [record, setRecord] = useState(false);
  const [isInt, setIsInt] = useState(initialIsInt);
  const [isLoad, setIsLoad] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [showError, setShowError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  
  const msg = [
    "Amazing! You're following your plan!",
    "Great choice! Keep it up!",
    "You're doing great! Be proud of yourself!",
    "You're one step closer to your goal!",
    "Your willpower is amazing! These moments create change!",
    "I'm proud of you for choosing action over reels!",
    "You look great executing your plan!",
    "Small actions are the beginning of big changes!"
  ];
  
  const getRandMsg = () => {
    try {
      const idx = Math.floor(Math.random() * msg.length);
      return msg[idx];
    } catch (error) {
      console.error("Error getting random message:", error);
      return "Great job taking action!";
    }
  };
  
  useEffect(() => {
    setIsInt(initialIsInt);
  }, [initialIsInt]);

  useEffect(() => {
    if (!visible) {
      const resetState = () => {
        try {
          setUri(null);
          setRecord(false);
          setIsInt(initialIsInt);
          setIsLoad(false);
          setShowSuccess(false);
          setSuccessMsg("");
          setShowError(false);
          setErrorMsg("");
          setShowConfirm(false);
        } catch (error) {
          console.error("Error resetting camera state:", error);
        }
      };
      
      const timeoutId = setTimeout(resetState, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [visible]);

  useEffect(() => {
    if (visible && perm?.granted) {
      try {
        // Check user authentication status
        const user = getCurrentUser();
        if (!user) {
          setShowError(true);
          return;
        }
        
        console.log("User login confirmed:", user.email);
        setTimeout(() => {
          setShowConfirm(true);
        }, 500);
      } catch (error) {
        console.error("Error showing initial confirmation:", error);
      }
    }
  }, [visible, perm?.granted]);

  const handleClose = () => {
    try {
      setUri(null);
      setRecord(false);
      setIsInt(false);
      setIsLoad(false);
      setShowSuccess(false);
      setSuccessMsg("");
      setShowError(false);
      setErrorMsg("");
      setShowConfirm(false);
      onClose?.();
    } catch (error) {
      console.error("Error closing camera:", error);
    }
  };

  const handleConfirm = () => {
    try {
      setShowConfirm(false);
    } catch (error) {
      console.error("Error handling confirmation:", error);
    }
  };

  const handleSuccess = () => {
    try {
      setShowSuccess(false);
      setSuccessMsg("");
      handleClose();
    } catch (error) {
      console.error("Error handling success:", error);
    }
  };

  const handleError = () => {
    try {
      setShowError(false);
      setErrorMsg("");
    } catch (error) {
      console.error("Error handling error:", error);
    }
  };

  if (!perm) {
    return null;
  }

  const renderPerm = () => (
    <View style={styles.permissionContainer}>
      <Text style={styles.permissionText}>
        Camera permission required
      </Text>
      <View style={styles.buttonContainer}>
        <Button onPress={reqPerm} title="Allow" />
        <Button onPress={handleClose} title="Close" />
      </View>
    </View>
  );
  
  const takePic = async () => {
    try {
      performTakePic();
    } catch (error) {
      console.error("Error taking photo:", error);
    }
  };

  const performTakePic = async () => {
    try {
      if (!ref.current) return;
      
      setIsLoad(true);
      
      const photo = await ref.current.takePictureAsync({
        quality: 0.8,
        base64: true,
      });
      
      if (photo?.uri) {
        try {
          const img = photo.base64 || "";
          const plan = { activity: pln?.act || "", timeSlot: pln?.ts };
          const res = await verifyPlanEvidence(img, plan);
          setIsLoad(false);
          if (res.verified) {
            setSuccessMsg("Plan verified. " + (res.reason || ""));
            setShowSuccess(true);
          } else {
            setErrorMsg((res.reason && res.reason.length > 0) ? res.reason : "Not enough evidence. Please retake.");
            setShowError(true);
          }
          
        } catch (storageError) {
          console.error("Storage save error:", storageError);
          setIsLoad(false);
          
          // Provide specific error messages
          let errorMessage = "Failed to save photo.";
          if (storageError instanceof Error) {
            if (storageError.message.includes("로그인")) {
              errorMessage = "Login required. Please log in again.";
            } else if (storageError.message.includes("네트워크")) {
              errorMessage = "Please check your network connection.";
            } else if (storageError.message.includes("권한")) {
              errorMessage = "No storage permission. Please check your settings.";
            }
          }
          
          setErrorMsg(errorMessage);
          setShowError(true);
        }
      } else {
        throw new Error("Photo capture failed");
      }
      
    } catch (error) {
      console.error("Photo capture error:", error);
      setIsLoad(false);
      setErrorMsg("Failed to take photo. Please try again.");
      setShowError(true);
    }
  };
  
  const recVid = async () => {
    try {
      performRecVid();
    } catch (error) {
      console.error("Error recording video:", error);
    }
  };

  const performRecVid = async () => {
    try {
      if (record) {
        if (ref.current) {
          ref.current.stopRecording();
        }
        setRecord(false);
        return;
      }
      
      if (!ref.current) return;
      
      setRecord(true);
      
      const video = await ref.current.recordAsync({
        maxDuration: 30,
      });
      
      if (video?.uri) {
        setIsLoad(true);
        
        setTimeout(() => {
          try {
            setIsLoad(false);
            const msg = getRandMsg();
            setSuccessMsg(isInt ? "You chose to execute your plan instead of watching short-form content. These moments create big changes!" : msg);
            setShowSuccess(true);
          } catch (error) {
            console.error("Error showing message:", error);
            setIsLoad(false);
          }
        }, 1500);
      }
      
    } catch (error) {
      console.error("Video recording error:", error);
      setIsLoad(false);
      setRecord(false);
      setErrorMsg("Failed to record video. Please try again.");
      setShowError(true);
    }
  };
  
  const toggleMode = () => {
    setMode((prev) => (prev === "picture" ? "video" : "picture"));
  };

  const toggleFacing = () => {
    setFacing((prev) => (prev === "back" ? "front" : "back"));
  };

  const renderPicture = () => {
    return (
      <View style={styles.previewContainer}>
        <Image
          source={{ uri }}
          contentFit="contain"
          style={styles.previewImage}
        />
        <View style={styles.buttonContainer}>
          <Button 
            onPress={() => setUri(null)} 
            title="Retake" 
          />
          <Button 
            onPress={() => {
              try {
                console.log("Photo saved:", uri);
                setUri(null);
                handleClose();
              } catch (error) {
                console.error("Error saving photo:", error);
              }
            }} 
            title="Save & Close" 
          />
        </View>
      </View>
    );
  };
  
  const renderCamera = () => {
    return (
      <CameraView
        style={styles.camera}
        ref={ref}
        mode={mode}
        facing={facing}
        mute={false}
        responsiveOrientationWhenOrientationLocked
      >
        {isLoad && (
          <View style={styles.loadOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadText}>Processing...</Text>
          </View>
        )}
        
        {isInt && (
          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>
              Verify Action
            </Text>
          </View>
        )}
        
        <Pressable style={styles.closeButton} onPress={handleClose}>
          <AntDesign name="close" size={24} color="white" />
        </Pressable>
        
        <View style={styles.shutterContainer}>
          <Pressable onPress={toggleMode} style={styles.iconButton}>
            {mode === "picture" ? (
              <AntDesign name="picture" size={32} color="white" />
            ) : (
              <Feather name="video" size={32} color="white" />
            )}
          </Pressable>
          
          <Pressable onPress={mode === "picture" ? takePic : recVid}>
            {({ pressed }) => (
              <View
                style={[
                  styles.shutterBtn,
                  {
                    opacity: pressed ? 0.5 : 1,
                    transform: [{ scale: pressed ? 0.95 : 1 }]
                  },
                ]}
              >
                <View
                  style={[
                    styles.shutterBtnInner,
                    {
                      backgroundColor: mode === "picture" ? "white" : record ? "red" : "white",
                      borderRadius: record ? 10 : 50,
                    },
                  ]}
                />
              </View>
            )}
          </Pressable>
          
          <Pressable onPress={toggleFacing} style={styles.iconButton}>
            <FontAwesome6 name="rotate-left" size={32} color="white" />
          </Pressable>
        </View>
      </CameraView>
    );
  };

  const renderContent = () => {
    if (!perm.granted) {
      return renderPerm();
    }
    
    return (
      <View style={styles.container}>
        {uri ? renderPicture() : renderCamera()}
      </View>
    );
  };

  const renderSuccessModal = () => (
    <Modal
      visible={showSuccess}
      transparent={true}
      animationType="fade"
      onRequestClose={() => {}}
    >
      <View style={styles.successOverlay}>
        <View style={styles.successCard}>
          
          <Text style={styles.successTitle}>
            Plan Verified
          </Text>
          
          <Text style={styles.successMessage}>
            {successMsg}
          </Text>
          
          <Pressable 
            style={styles.successButton}
            onPress={handleSuccess}
          >
            <Text style={styles.successButtonText}>
              Continue
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );

  const renderErrorModal = () => (
    <Modal
      visible={showError}
      transparent={true}
      animationType="fade"
      onRequestClose={() => {}}
    >
      <View style={styles.successOverlay}>
        <View style={styles.successCard}>
          
          <Text style={styles.errorTitle}>
            Retake Required
          </Text>
          
          <Text style={styles.successMessage}>
            {errorMsg}
          </Text>
          
          <Pressable 
            style={styles.errorButton}
            onPress={handleError}
          >
            <Text style={styles.successButtonText}>
              Try Again
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );

  const renderConfirmModal = () => (
    <Modal
      visible={showConfirm}
      transparent={true}
      animationType="fade"
      onRequestClose={() => {}}
    >
      <View style={styles.successOverlay}>
        <View style={styles.successCard}>
          
          <Text style={styles.confirmTitle}>
            Verify Plan
          </Text>
          
          <Text style={styles.successMessage}>
            Please verify your current plan with a photo!
          </Text>
          
          <Pressable 
            style={styles.confirmButton}
            onPress={handleConfirm}
          >
            <Text style={styles.successButtonText}>
              Confirm
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleClose}
      >
        {renderContent()}
      </Modal>
      
      {renderSuccessModal()}
      {renderErrorModal()}
      {renderConfirmModal()}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  permissionText: {
    fontSize: 18,
    textAlign: "center",
    marginBottom: 30,
    color: "#333",
  },
  camera: {
    flex: 1,
    width: "100%",
  },
  loadOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  loadText: {
    color: "white",
    fontSize: 16,
    marginTop: 12,
    fontWeight: "bold",
  },
  statusContainer: {
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 1,
  },
  statusText: {
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    color: "white",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    fontSize: 16,
    fontWeight: "bold",
  },
  closeButton: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 2,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 20,
    padding: 8,
  },
  shutterContainer: {
    position: "absolute",
    bottom: 44,
    left: 0,
    width: "100%",
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 30,
  },
  shutterBtn: {
    backgroundColor: "transparent",
    borderWidth: 5,
    borderColor: "white",
    width: 85,
    height: 85,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterBtnInner: {
    width: 70,
    height: 70,
    borderRadius: 50,
  },
  iconButton: {
    padding: 8,
  },
  previewContainer: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
  },
  previewImage: {
    width: "90%",
    height: "70%",
    borderRadius: 10,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 20,
    marginTop: 30,
  },
  successOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  successCard: {
    backgroundColor: "white",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    width: "90%",
    maxWidth: 340,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F0FDF4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  successEmoji: {
    fontSize: 36,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 12,
    textAlign: "center",
  },
  successMessage: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 28,
  },
  successButton: {
    backgroundColor: "#10B981",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    width: "100%",
    alignItems: "center",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  successButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#DC2626",
    marginBottom: 12,
    textAlign: "center",
  },
  errorButton: {
    backgroundColor: "#DC2626",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    width: "100%",
    alignItems: "center",
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F0F9FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  confirmTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 12,
    textAlign: "center",
  },
  confirmButton: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    width: "100%",
    alignItems: "center",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
});