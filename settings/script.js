////////////////
// PARAMS URL //
////////////////
const P = new URLSearchParams(location.search);
const sbHost  = str("address","127.0.0.1");
const sbPort  = str("port","8080");
const sbPass  = str("password","");

// Général
const chatCommand     = str("chatCommand","!vibemeter");
const permissionLevel = int("permissionLevel",30);
const minRating       = int("minRating",0);
const maxRating       = int("maxRating",10);
const defaultDuration = int("defaultDuration",60);

// Apparence
const decimalPlaces = int("decimalPlaces",1);
const fontSize      = int("fontSize",150);

function int(k,d){const v=P.get(k);if(v===null)return d;const n=Number(v);return Number.isFinite(n)?Math.trunc(n):d;}
function str(k,d){const v=P.get(k);return (v==null||v==="")?d:v;}

///////////////////////
// ÉLÉMENTS & ÉTAT  //
///////////////////////
const ratingsMap = new Map();
let isAcceptingSubmissions = false;
let isInFinalAnimation = false;

const label = document.getElementById("ratingLabel");
const box = document.getElementById("ratingBox");
const ratingBoxBackground = document.getElementById("ratingBoxBackground");
const loadingBar = document.getElementById("loadingBar");
const ratingBoxWrapper = document.getElementById("ratingBoxWrapper");

label.style.fontSize = `${fontSize}px`;

/////////////////////////////////
// STREAMER.BOT – CONNEXION   //
/////////////////////////////////
let client;

function connectStreamerBot(){
  if (!window.StreamerbotClient){
    console.error("[SB] StreamerbotClient non chargé.");
    SetConnectionStatus(false, "lib manquante");
    return;
  }

  // Choix du protocole : wss en HTTPS *si* tu as un proxy TLS ; sinon ws.
  // OBS accepte ws (recommandé).
  const useSecure = false; // laisse false à moins d’avoir un reverse proxy TLS vers SB
  const proto = useSecure ? "wss" : "ws";
  const endpoint = `${proto}://${sbHost}:${sbPort}/`;

  console.log("[SB] endpoint:", endpoint);

  client = new window.StreamerbotClient({
    endpoint,
    password: sbPass || undefined,
    onConnect: () => { console.log("[SB] CONNECTED"); SetConnectionStatus(true); },
    onDisconnect: () => { console.warn("[SB] DISCONNECTED"); SetConnectionStatus(false); }
  });

  // Certaines versions n’autoconnectent pas :
  if (typeof client.connect === "function") client.connect();

  // Events
  client.on?.('Twitch.ChatMessage', (res)=>{ try{TwitchChatMessage(res.data);}catch(e){console.error(e);} });
  client.on?.('YouTube.Message',     (res)=>{ try{YouTubeMessage(res.data);}catch(e){console.error(e);} });
}

/////////////////////////
// HANDLERS DE MESSAGES
/////////////////////////
function TwitchChatMessage(data){
  CheckInput('twitch', data.user.id, data.message.message, data);
}
function YouTubeMessage(data){
  CheckInput('youtube', data.user.id, data.message, data);
}

function CheckInput(platform, userID, message, data){
  // Commande
  if (message.startsWith(chatCommand)) {
    if (!IsUserAllowed(permissionLevel, data, platform)) return;
    const parts = message.trim().split(/\s+/);
    const p1 = (parts[1]||'').toLowerCase();
    if (p1
