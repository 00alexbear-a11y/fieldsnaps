import { useState } from "react";
import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/apiUrl";

export function useWebAuthn() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const registerBiometric = async () => {
    try {
      setIsLoading(true);

      const optionsResponse = await fetch(getApiUrl("/api/webauthn/register/options"), {
        method: "POST",
        credentials: "include",
      });

      if (!optionsResponse.ok) {
        const error = await optionsResponse.json();
        throw new Error(error.message || "Failed to get registration options");
      }

      const options = await optionsResponse.json();

      const registrationResponse = await startRegistration({ optionsJSON: options });

      const verificationResponse = await fetch(getApiUrl("/api/webauthn/register/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(registrationResponse),
      });

      if (!verificationResponse.ok) {
        const error = await verificationResponse.json();
        throw new Error(error.message || "Failed to verify registration");
      }

      const verification = await verificationResponse.json();

      if (verification.verified) {
        toast({
          title: "Success",
          description: "Biometric authentication enabled successfully!",
        });
        return true;
      } else {
        throw new Error("Registration verification failed");
      }
    } catch (error: any) {
      console.error("Biometric registration error:", error);
      toast({
        variant: "destructive",
        title: "Registration Failed",
        description: error.message || "Failed to enable biometric authentication",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const authenticateWithBiometric = async () => {
    try {
      setIsLoading(true);

      const optionsResponse = await fetch(getApiUrl("/api/webauthn/authenticate/options"), {
        method: "POST",
        credentials: "include",
      });

      if (!optionsResponse.ok) {
        const error = await optionsResponse.json();
        throw new Error(error.message || "Failed to get authentication options");
      }

      const options = await optionsResponse.json();

      const authenticationResponse = await startAuthentication({ optionsJSON: options });

      const verificationResponse = await fetch(getApiUrl("/api/webauthn/authenticate/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(authenticationResponse),
      });

      if (!verificationResponse.ok) {
        const error = await verificationResponse.json();
        throw new Error(error.message || "Failed to verify authentication");
      }

      const verification = await verificationResponse.json();

      if (verification.verified) {
        toast({
          title: "Success",
          description: "Signed in with biometric authentication!",
        });
        return verification.user;
      } else {
        throw new Error("Authentication verification failed");
      }
    } catch (error: any) {
      console.error("Biometric authentication error:", error);
      toast({
        variant: "destructive",
        title: "Authentication Failed",
        description: error.message || "Failed to sign in with biometrics",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const checkBiometricSupport = async () => {
    if (!window.PublicKeyCredential) {
      return false;
    }

    try {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      return available;
    } catch {
      return false;
    }
  };

  return {
    registerBiometric,
    authenticateWithBiometric,
    checkBiometricSupport,
    isLoading,
  };
}
