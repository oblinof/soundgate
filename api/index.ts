import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import crypto from "crypto";

function base64URLEncode(str: Buffer) {
  return str.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

const app = express();
app.set("trust proxy", true);
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// SoundCloud API configuration

app.get("/api/soundcloud/auth", (req, res) => {
  const SC_CLIENT_ID = process.env.VITE_SOUNDCLOUD_CLIENT_ID || process.env.SOUNDCLOUD_CLIENT_ID;
  if (!SC_CLIENT_ID) {
    const envKeys = Object.keys(process.env).filter(k => k.includes('SOUNDCLOUD')).join(', ');
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Configuración de Vercel Incompleta</title>
          <style>
            body { font-family: system-ui, sans-serif; background: #09090b; color: #fff; display: flex; align-items: center; justify-center; height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
            .card { background: #18181b; padding: 2rem; border-radius: 12px; max-width: 600px; margin: 0 auto; text-align: left; border: 1px solid #27272a; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
            h2 { color: #facc15; margin-top: 0; }
            code { background: #27272a; padding: 2px 6px; border-radius: 4px; color: #a1a1aa; }
            ol { color: #d4d4d8; line-height: 1.6; }
            li { margin-bottom: 8px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>⚠️ Falta Configuración en Vercel</h2>
            <p>La variable de entorno <code>VITE_SOUNDCLOUD_CLIENT_ID</code> no está configurada en tu proyecto de Vercel.</p>
            <p>Variables detectadas relacionadas: <code>${envKeys || 'Ninguna'}</code></p>
            <p>Para arreglar esto y que el login funcione:</p>
            <ol>
              <li>Ve al panel de tu proyecto en <b>Vercel</b>.</li>
              <li>Ve a <b>Settings</b> &rarr; <b>Environment Variables</b>.</li>
              <li>Añade <code>VITE_SOUNDCLOUD_CLIENT_ID</code> con tu Client ID de SoundCloud.</li>
              <li>Añade <code>SOUNDCLOUD_CLIENT_SECRET</code> con tu Client Secret de SoundCloud.</li>
              <li>Ve a la pestaña <b>Deployments</b>, haz clic en los 3 puntos de tu último despliegue y selecciona <b>Redeploy</b>.</li>
            </ol>
            <p style="color: #a1a1aa; font-size: 0.9em; margin-top: 24px;">Una vez hecho esto, vuelve a intentar conectarte.</p>
          </div>
        </body>
      </html>
    `);
  }
  
  // Try to use the host from the request, fallback to a relative path for the frontend to handle if needed,
  // but for Vercel, req.headers.host is usually correct.
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const defaultRedirectUri = `${protocol}://${host}/api/soundcloud/callback`;
  
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
  const SC_CLIENT_ID = process.env.VITE_SOUNDCLOUD_CLIENT_ID || process.env.SOUNDCLOUD_CLIENT_ID;
  const code = req.query.code;
  const state = req.query.state;
  const errorParam = req.query.error;
  const verifier = req.cookies.pkce_verifier;
  const cookieRedirectUri = req.cookies.oauth_redirect_uri;
  
  if (errorParam) {
    return res.redirect(`/#error=${encodeURIComponent(errorParam as string)}&state=${state}`);
  }

  if (!code) {
    return res.redirect(`/#error=no_code&state=${state}`);
  }
  
  if (!verifier) {
    return res.redirect(`/#error=no_cookie&state=${state}`);
  }

  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const defaultRedirectUri = `${protocol}://${host}/api/soundcloud/callback`;
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
    
    res.redirect(`/#access_token=${accessToken}&state=${state}`);
  } catch (err: any) {
    console.error(err);
    res.redirect(`/#error=internal_server_error`);
  }
});

export default app;
