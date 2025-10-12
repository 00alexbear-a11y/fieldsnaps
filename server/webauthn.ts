import { Express } from "express";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
} from "@simplewebauthn/server";
import { storage } from "./storage";
import { isAuthenticated } from "./replitAuth";

declare module 'express-session' {
  interface SessionData {
    currentChallenge?: string;
    userId?: string;
  }
}

const rpName = "Construction Photo PWA";
const rpID = process.env.REPLIT_DOMAINS?.split(",")[0] || "localhost";
const origin = process.env.NODE_ENV === 'production' 
  ? `https://${rpID}` 
  : `http://localhost:5000`;

export function setupWebAuthn(app: Express) {
  app.post("/api/webauthn/register/options", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const userCredentials = await storage.getUserCredentials(userId);

      const options = await generateRegistrationOptions({
        rpName,
        rpID,
        userID: Buffer.from(userId),
        userName: user.email || "",
        userDisplayName: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "",
        timeout: 60000,
        attestationType: "none",
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "required",
        },
        supportedAlgorithmIDs: [-7, -257],
        excludeCredentials: userCredentials.map((cred) => ({
          id: Buffer.from(cred.credentialId, "base64url"),
          transports: cred.transports as ("ble" | "cable" | "hybrid" | "internal" | "nfc" | "smart-card" | "usb")[] | undefined,
        })),
      });

      req.session.currentChallenge = options.challenge;

      res.json(options);
    } catch (error) {
      console.error("Error generating registration options:", error);
      res.status(500).json({ message: "Failed to generate registration options" });
    }
  });

  app.post("/api/webauthn/register/verify", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const body = req.body;

      const expectedChallenge = req.session.currentChallenge;
      if (!expectedChallenge) {
        return res.status(400).json({ message: "No challenge found in session" });
      }

      const verification: VerifiedRegistrationResponse = await verifyRegistrationResponse({
        response: body,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });

      if (verification.verified && verification.registrationInfo) {
        const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

        await storage.createCredential({
          userId,
          credentialId: credential.id,
          publicKey: Buffer.from(credential.publicKey).toString("base64url"),
          counter: credential.counter,
          transports: body.response.transports,
        });

        delete req.session.currentChallenge;

        res.json({ verified: true });
      } else {
        res.status(400).json({ message: "Verification failed" });
      }
    } catch (error) {
      console.error("Error verifying registration:", error);
      res.status(500).json({ message: "Failed to verify registration" });
    }
  });

  app.post("/api/webauthn/authenticate/options", async (req, res) => {
    try {
      const options = await generateAuthenticationOptions({
        rpID,
        timeout: 60000,
        userVerification: "required",
      });

      req.session.currentChallenge = options.challenge;

      res.json(options);
    } catch (error) {
      console.error("Error generating authentication options:", error);
      res.status(500).json({ message: "Failed to generate authentication options" });
    }
  });

  app.post("/api/webauthn/authenticate/verify", async (req: any, res) => {
    try {
      const body = req.body;

      const expectedChallenge = req.session.currentChallenge;
      if (!expectedChallenge) {
        return res.status(400).json({ message: "No challenge found in session" });
      }

      const credential = await storage.getCredentialByCredentialId(body.id);

      if (!credential) {
        return res.status(404).json({ message: "Credential not found" });
      }

      const verification: VerifiedAuthenticationResponse = await verifyAuthenticationResponse({
        response: body,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: credential.credentialId,
          publicKey: Buffer.from(credential.publicKey, "base64url"),
          counter: credential.counter,
        },
      });

      if (verification.verified) {
        await storage.updateCredentialCounter(
          credential.id,
          verification.authenticationInfo.newCounter
        );

        const user = await storage.getUser(credential.userId);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        req.session.userId = user.id;
        req.user = {
          claims: {
            sub: user.id,
            email: user.email,
            first_name: user.firstName,
            last_name: user.lastName,
            profile_image_url: user.profileImageUrl,
          },
        };

        delete req.session.currentChallenge;

        res.json({ verified: true, user });
      } else {
        res.status(400).json({ message: "Authentication failed" });
      }
    } catch (error) {
      console.error("Error verifying authentication:", error);
      res.status(500).json({ message: "Failed to verify authentication" });
    }
  });

  app.get("/api/webauthn/credentials", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const credentials = await storage.getUserCredentials(userId);
      res.json(credentials);
    } catch (error) {
      console.error("Error fetching credentials:", error);
      res.status(500).json({ message: "Failed to fetch credentials" });
    }
  });
}
