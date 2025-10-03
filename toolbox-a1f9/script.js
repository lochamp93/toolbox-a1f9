//////////////////////////
// PARAMÈTRES D'URL     //
//////////////////////////

const params = new URLSearchParams(location.search);
const sbServerAddress  = str("address","127.0.0.1");
const sbServerPort     = str("port","8080");
const sbServerPassword = str("password","");

// Général
const chatCommand     = str("chatCommand","!vibemeter");
const permissionLevel = int("permissionLevel", 30);
const minRating       = int("minRating", 0);
const maxRating       = int("maxRating", 10);
const defaultDuration = int("defaultDuration", 60);

// Apparence
const decimalPlaces = int("decimalPlaces", 1);
const fontSize      = int("fontSize", 150);

// Helpers de params
function int(name, def){ const v = params.get(name); if(v===null) return def; const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : def; }
function str(name, def){ const v = params.get(name); return (v===null || v==='') ? def : v; }

/////////////////
// ÉTAT GLOBAL //
/////////////////

const ratingsMap = new Map();
let isAcceptingSubmissions = false;
let isInFinalAnimation = false;

//////////////////////
// ÉLÉMENTS DE PAGE //
//////////////////////

const label = document.getElementById("ratingLabel");
const box = document.getElementById("ratingBox");
const ratingBoxBackground = document.getElementById("ratingBoxBackground");
const loadingBar = document.getElementById("loadingBar");
const ratingBoxWrapper = document.getElementById("ratingBoxWrapper");

// Apparence
label.style.fontSize = `${fontSize}px`;

////////////////////////////////
// CLIENT STREAMER.BOT (WS)   //
////////////////////////////////

let client;
if (window.StreamerbotClient) {
  client = new window.StreamerbotClient({
    endpoint: `ws://${sbServerAddress}:${sbServerPort}/`,
    password: sbServerPassword || undefined,
    onConnect: (data) => { console.log(`Streamer.bot connecté`); SetConnectionStatus(true); },
    onDisconnect: () => { console.error(`Streamer.bot déconnecté`); SetConnectionStatus(false); }
  });

  client.on('Twitch.ChatMessage', (res) => { try{ TwitchChatMessage(res.data); }catch(e){ console.error(e);} });
  client.on('YouTube.Message',     (res) => { try{ YouTubeMessage(res.data);   }catch(e){ console.error(e);} });
} else {
  console.warn('StreamerbotClient absent — testez dans OBS.');
}

////////////////////////////
// TRAITEMENT DES MESSAGES//
////////////////////////////

function TwitchChatMessage(data) {
  const platform = 'twitch';
  const userID = data.user.id;
  const message = data.message.message;
  CheckInput(platform, userID, message, data);
}

function YouTubeMessage(data) {
  const platform = 'youtube';
  const userID = data.user.id;
  const message = data.message;
  CheckInput(platform, userID, message, data);
}

function CheckInput(platform, userID, message, data) {
  // Commande
  if (message.startsWith(chatCommand)) {
    if (!IsUserAllowed(permissionLevel, data, platform)) return;
    const parts = message.trim().split(/\s+/);
    switch ((parts[1]||'').toLowerCase()) {
      case "on":  StartVibeMeter(); break;
      case "off": EndVibeMeter();   break;
      default:
        if (Number.isInteger(Number(parts[1]))) StartVibeMeter(parseInt(parts[1],10));
        break;
    }
  }

  // Votes
  if (!/^-?\d+(\.\d+)?$/.test(message)) return;
  const rating = Number(message);
  if (rating < minRating || rating > maxRating) return;

  ratingsMap.set(`${platform}-${userID}`, rating);
  CalculateAverage();
}

///////////////////////////
// DÉROULÉ DU VIBE METER //
///////////////////////////

function StartVibeMeter(duration) {
  if (isAcceptingSubmissions || isInFinalAnimation) return;

  isAcceptingSubmissions = true;
  label.textContent = Number.isInteger(minRating) ? String(minRating) : minRating.toFixed(decimalPlaces);
  box.style.backgroundColor = `rgba(255, 0, 0, 1)`;

  if (client?.sendMessage) {
    client.sendMessage('twitch', `/me VIBE METER ! Entrez un nombre entre ${minRating} et ${maxRating}`, { bot: true });
    client.sendMessage('youtube', `VIBE METER ! Entrez un nombre entre ${minRating} et ${maxRating}`, { bot: true });
  }

  ratingsMap.clear();
  ShowWidget();

  if (duration == null) duration = defaultDuration;

  loadingBar.style.transitionDuration = `${duration}s`;
  loadingBar.style.height = 0;

  if (duration > 0) {
    setTimeout(() => { EndVibeMeter(); }, duration * 1000);
  }
}

function EndVibeMeter() {
  if (!isAcceptingSubmissions) {
    if (client?.sendMessage) {
      client.sendMessage('twitch', `/me Tapez "${chatCommand} on" pour démarrer le Vibe Meter`, { bot: true });
      client.sendMessage('youtube', `Tapez "${chatCommand} on" pour démarrer le Vibe Meter`, { bot: true });
    }
    return;
  }

  isInFinalAnimation = true;
  isAcceptingSubmissions = false;

  ratingBoxBackground.style.animation = 'pulse 1s linear 1s forwards';
  const finalRating = CalculateAverage();

  setTimeout(() => {
    if (client?.sendMessage) {
      client.sendMessage('twitch', `/me VERDICT VIBE METER : ${finalRating}/${maxRating}`, { bot: true });
      client.sendMessage('youtube', `VERDICT VIBE METER : ${finalRating}/${maxRating}`, { bot: true });
    }
    ratingBoxBackground.style.animation = '';
    // Petite pause avant de cacher
    setTimeout(() => {
      HideWidget();
      setTimeout(() => {
        loadingBar.style.transitionDuration = `0s`;
        loadingBar.style.height = `100%`;
        isInFinalAnimation = false;
      }, 1000);
    }, 2000);
  }, 1000);
}

///////////////////////////
// FONCTIONS UTILITAIRES //
///////////////////////////

function CalculateAverage() {
  let sum = 0, count = 0;
  for (const [, v] of ratingsMap) { sum += v; count++; }
  const avg = count > 0 ? sum / count : 0;
  UpdateRatingBox(avg);
  return avg;
}

function IsUserAllowed(targetPermissions, data, platform) {
  return GetPermissionLevel(data, platform) >= targetPermissions;
}

function GetPermissionLevel(data, platform) {
  switch (platform) {
    case 'twitch':
      if (data.message.role >= 4) return 40;        // Broadcaster
      else if (data.message.role >= 3) return 30;   // Mod
      else if (data.message.role >= 2) return 20;   // VIP
      else if (data.message.role >= 2 || data.message.subscriber) return 15; // Sub
      else return 10;
    case 'youtube':
      if (data.user.isOwner) return 40;
      else if (data.user.isModerator) return 30;
      else if (data.user.isSponsor) return 15;
      else return 10;
    default:
      return 10;
  }
}

function UpdateRatingBox(newValue, duration = 200) {
  const start = parseFloat(label.textContent.replace(',','.')) || minRating;
  const startTime = performance.now();

  function update(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const value = start + (newValue - start) * progress;

    label.textContent = Number.isInteger(value) ? String(value) : value.toFixed(decimalPlaces);

    const clamped = Math.min(Math.max(value, minRating), maxRating);
    const range = maxRating - minRating;
    const percent = range === 0 ? 1 : (clamped - minRating) / range;

    const red = Math.round(255 * (1 - percent));
    const green = Math.round(255 * percent);
    const color = `rgba(${red}, ${green}, 0, 1)`;
    box.style.backgroundColor = color;
    ratingBoxBackground.style.backgroundColor = color;

    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

function ShowWidget(){ ratingBoxWrapper.style.animation = `showWidget 0.5s ease-in-out forwards`; }
function HideWidget(){ ratingBoxWrapper.style.animation = `hideWidget 0.5s ease-in-out forwards`; }

//////////////////////////////
// STATUT WEBSOCKET (UI)    //
//////////////////////////////

function SetConnectionStatus(connected) {
  const status = document.getElementById("statusContainer");
  if (connected) {
    status.style.background = "#2FB774";
    status.innerText = "Connecté !";
    status.style.opacity = 1;
    setTimeout(() => {
      status.style.transition = "all 2s ease";
      status.style.opacity = 0;
    }, 10);
  } else {
    status.style.background = "#D12025";
    status.innerText = "Connexion…";
    status.style.transition = "";
    status.style.opacity = 1;
  }
}
