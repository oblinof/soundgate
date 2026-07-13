import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import cookieParser from "cookie-parser";
import crypto from "crypto";

function base64URLEncode(str: Buffer) {
  return str.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function startServer() {
  const app = express();
  app.set("trust proxy", true); // Required for req.protocol and req.get("host") behind proxy
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());
  app.use(cookieParser());

  // SoundCloud API configuration
  const SC_CLIENT_ID = process.env.VITE_SOUNDCLOUD_CLIENT_ID;

  app.get("/api/soundcloud/auth", (req, res) => {
    if (!SC_CLIENT_ID) {
      return res.status(500).json({ error: "Missing VITE_SOUNDCLOUD_CLIENT_ID in backend environment variables." });
    }
    
    // The redirect URI MUST EXACTLY MATCH what's registered in the SoundCloud portal.
    const defaultRedirectUri = req.protocol + "://" + req.get("host") + "/api/soundcloud/callback";
    const redirectUri = (req.query.redirect_uri as string) || defaultRedirectUri;
    const state = req.query.state || "gate_auth";

    // Generate PKCE Challenge
    const verifier = base64URLEncode(crypto.randomBytes(32));
    const challenge = base64URLEncode(crypto.createHash('sha256').update(verifier).digest());

    // Save verifier and redirectUri in HttpOnly cookies
    res.cookie('pkce_verifier', verifier, { httpOnly: true, maxAge: 10 * 60 * 1000, secure: true, sameSite: 'lax' });
    res.cookie('oauth_redirect_uri', redirectUri, { httpOnly: true, maxAge: 10 * 60 * 1000, secure: true, sameSite: 'lax' });

    // Use secure.soundcloud.com/authorize with PKCE parameters
    const authUrl = `https://secure.soundcloud.com/authorize?client_id=${SC_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&code_challenge=${challenge}&code_challenge_method=S256&state=${state}`;
    res.redirect(authUrl);
  });

  app.get("/api/soundcloud/callback", async (req, res) => {
    const code = req.query.code;
    const state = req.query.state;
    const errorParam = req.query.error;
    const verifier = req.cookies.pkce_verifier;
    const cookieRedirectUri = req.cookies.oauth_redirect_uri;
    
    if (errorParam) {
      // If SoundCloud returns an error, redirect to frontend with error in hash
      return res.redirect(`/#error=${encodeURIComponent(errorParam as string)}&state=${state}`);
    }

    if (!code) {
      return res.redirect(`/#error=no_code&state=${state}`);
    }
    
    if (!verifier) {
      return res.redirect(`/#error=no_cookie&state=${state}`);
    }

    const defaultRedirectUri = req.protocol + "://" + req.get("host") + "/api/soundcloud/callback";
    const redirectUri = cookieRedirectUri || defaultRedirectUri;

    try {
      const tokenParams: Record<string, string> = {
        grant_type: "authorization_code",
        client_id: SC_CLIENT_ID || "",
        redirect_uri: redirectUri,
        code_verifier: verifier,
        code: code as string
      };

      const scSecret = process.env.SOUNDCLOUD_CLIENT_SECRET;
      // Many users mistakenly put their Client ID in the Client Secret field.
      // If we send a wrong client secret, SoundCloud returns invalid_client.
      // With PKCE, we don't *need* a client_secret if we don't have a valid one.
      if (scSecret && scSecret !== SC_CLIENT_ID && scSecret.trim() !== "") {
        tokenParams.client_secret = scSecret;
      }

      const response = await fetch("https://api.soundcloud.com/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "accept": "application/json; charset=utf-8"
        },
        body: new URLSearchParams(tokenParams).toString()
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Token exchange failed:", errText);
        
        let detailedError = "token_exchange_failed";
        if (errText.includes("invalid_client")) {
           detailedError = "invalid_client_secret";
        } else if (errText.includes("invalid_grant")) {
           detailedError = "invalid_grant";
        }
        
        return res.redirect(`/#error=${detailedError}&details=${encodeURIComponent(errText)}`);
      }

      const data = await response.json();
      const accessToken = data.access_token;
      
      // Redirect back to the frontend with the token in the hash (simulating implicit flow for the frontend)
      res.redirect(`/#access_token=${accessToken}&state=${state}`);

    } catch (err: any) {
      console.error(err);
      res.redirect(`/#error=internal_server_error`);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
