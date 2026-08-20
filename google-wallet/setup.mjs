import crypto from 'node:crypto';
import fs from 'node:fs';

const credentialsJson = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON;
if (!credentialsJson) {
  throw new Error('Missing GOOGLE_WALLET_SERVICE_ACCOUNT_JSON GitHub secret.');
}

let credentials;
try {
  credentials = JSON.parse(credentialsJson);
} catch {
  throw new Error('GOOGLE_WALLET_SERVICE_ACCOUNT_JSON is not valid JSON. Paste the complete service-account JSON into the GitHub secret.');
}

if (!credentials.client_email || !credentials.private_key) {
  throw new Error('The Google Wallet service-account secret is missing client_email or private_key.');
}

const config = JSON.parse(fs.readFileSync(new URL('./config.json', import.meta.url), 'utf8'));
const ISSUER_ID = config.issuerId;
const WALLET_BASE = 'https://walletobjects.googleapis.com/walletobjects/v1';
const SITE_URL = 'https://valerganicolas.github.io/core-value-pass/';
const SITE_ORIGIN = 'https://valerganicolas.github.io';

const descriptions = {
  'People First': 'Our players and Team Members are integral to our success, and their ideas and opinions matter. We are committed to growing our staff professionally and stand beside them through success and hardship—just as they stand with us. Together, we win!',
  'Excellence': 'We work tirelessly to be #1 in everything we do, and we are positioned to set the pace for everyone else through consistent strong performance in and out of the game, by listening and learning, and by being innovative and making continual improvements.',
  'Celebrate Individuality': 'We respect and value all identities, experiences, and perspectives of our players and team members. Our appreciation of individuality makes us stronger, it informs our inclusive policies and practices, and our businesses, fans, and communities benefit from the unique contributions of our diverse teams.',
  'Community': 'We take pride in the growth and success of the entire Gulf South region and are committed to leveraging our resources and goodwill to foster meaningful change for the greater good of society.',
  'Teamwork': 'Just like being in the game, we achieve more when we collaborate and share knowledge rather than operate in a silo.',
  'Integrity': 'We act with our fans’ and Organization’s best interests in mind. We take pride in our jobs, our role as brand ambassadors, and in doing the right thing.'
};

const passDesign = {
  saints: {
    cardTitle: 'Saints',
    background: '#000000',
    logo: 'https://lightgreen-whale-804521.hostingersite.com/wp-content/uploads/2026/08/SAINTS_WEB.png',
    logoDescription: 'New Orleans Saints logo'
  },
  pelicans: {
    cardTitle: 'Pelicans /Squadron',
    background: '#0A2340',
    logo: 'https://lightgreen-whale-804521.hostingersite.com/wp-content/uploads/2026/08/PELS_WEB.png',
    logoDescription: 'New Orleans Pelicans logo'
  },
  city: {
    cardTitle: 'City Edition',
    background: '#000000',
    logo: `${SITE_URL}assets/city-edition-logo.png`,
    wideLogo: `${SITE_URL}assets/city-edition-logo.png`,
    logoDescription: 'Pelicans City Edition logo'
  },
  benson: {
    cardTitle: 'Benson Enterprises',
    background: '#15334D',
    logo: 'https://lightgreen-whale-804521.hostingersite.com/wp-content/uploads/2026/08/BENSON_WH_WEB_2.png',
    logoDescription: 'Benson Enterprises logo'
  }
};

function base64url(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return buffer.toString('base64url');
}

function signJwt(claims) {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    ...(credentials.private_key_id ? { kid: credentials.private_key_id } : {})
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), credentials.private_key);
  return `${unsigned}.${base64url(signature)}`;
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = credentials.token_uri || 'https://oauth2.googleapis.com/token';
  const assertion = signJwt({
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/wallet_object.issuer',
    aud: tokenUri,
    iat: now,
    exp: now + 3600
  });

  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) {
    throw new Error(`Could not authenticate the service account (${response.status}): ${JSON.stringify(body)}`);
  }
  return body.access_token;
}

const accessToken = await getAccessToken();

async function walletRequest(method, path, body) {
  const response = await fetch(`${WALLET_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }

  if (!response.ok) {
    const error = new Error(`${method} ${path} failed (${response.status}): ${typeof data === 'string' ? data : JSON.stringify(data)}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function exists(path) {
  try {
    return await walletRequest('GET', path);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

function localized(value) {
  return {
    defaultValue: {
      language: 'en-US',
      value
    }
  };
}

function image(uri, description) {
  return {
    sourceUri: { uri },
    contentDescription: localized(description)
  };
}

function makeObject(themeKey, pass) {
  const design = passDesign[themeKey];
  if (!design) throw new Error(`No Google Wallet design is configured for ${themeKey}.`);

  const classId = `${ISSUER_ID}.${pass.classSuffix}`;
  const objectId = `${ISSUER_ID}.${pass.objectSuffix}`;
  const textModulesData = Object.entries(descriptions).map(([header, body], index) => ({
    id: `core_value_${index + 1}`,
    header,
    body
  }));

  const object = {
    id: objectId,
    classId,
    state: 'ACTIVE',
    genericType: 'GENERIC_OTHER',
    cardTitle: localized(design.cardTitle),
    subheader: localized('OUR CORE VALUES'),
    header: localized('How we show up every day.'),
    hexBackgroundColor: design.background,
    logo: image(design.logo, design.logoDescription),
    textModulesData,
    linksModuleData: {
      uris: [{
        id: 'core_values_site',
        uri: SITE_URL,
        description: 'View Our Core Values'
      }]
    }
  };

  if (design.wideLogo) {
    object.wideLogo = image(design.wideLogo, design.logoDescription);
  }

  return object;
}

async function upsertClass(classId) {
  const path = `/genericClass/${encodeURIComponent(classId)}`;
  if (await exists(path)) {
    console.log(`Class exists: ${classId}`);
    return;
  }

  await walletRequest('POST', '/genericClass', { id: classId });
  console.log(`Created class: ${classId}`);
}

async function upsertObject(object) {
  const path = `/genericObject/${encodeURIComponent(object.id)}`;
  if (await exists(path)) {
    await walletRequest('PATCH', path, object);
    console.log(`Updated object: ${object.id}`);
    return;
  }

  await walletRequest('POST', '/genericObject', object);
  console.log(`Created object: ${object.id}`);
}

function makeSaveLink(object) {
  const now = Math.floor(Date.now() / 1000);
  const token = signJwt({
    iss: credentials.client_email,
    aud: 'google',
    typ: 'savetowallet',
    iat: now,
    origins: [SITE_ORIGIN],
    payload: {
      genericObjects: [{ id: object.id, classId: object.classId }]
    }
  });
  return `https://pay.google.com/gp/v/save/${token}`;
}

const links = {};

for (const [themeKey, pass] of Object.entries(config.passes)) {
  const classId = `${ISSUER_ID}.${pass.classSuffix}`;
  const object = makeObject(themeKey, pass);
  await upsertClass(classId);
  await upsertObject(object);
  links[themeKey] = makeSaveLink(object);
}

const output = `// Generated automatically by the Google Wallet GitHub Action.\n// Signed Save to Google Wallet links are safe to publish. Private credentials never leave GitHub Secrets.\nwindow.GOOGLE_WALLET_LINKS = ${JSON.stringify(links, null, 2)};\n`;
fs.writeFileSync(new URL('../wallet-links.js', import.meta.url), output);
console.log('Generated wallet-links.js for Saints, Pelicans /Squadron, City Edition, and Benson Enterprises.');
