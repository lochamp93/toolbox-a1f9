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

  // OBS accepte ws:// (recommandé). wss:// seulement si reverse proxy TLS vers SB.
  const useSecure = false;
  const proto = useSecure ? "wss" : "ws";
  const endpoint = `${proto}://${sbHost}:${sbPort}/`;

  console.log("[SB] endpoint:", endpoint);

  client = new window.StreamerbotClient({
    endpoint,
    password: sbPass || undefined,
    onConnect: () => { console.log("[SB] CONNECTED"); SetConnectionStatus(true); },
    onDisconnect: () => { console.warn("[SB] DISCONNECTED"); SetConnectionStatus(false); }
  });

  if (typeof client.connect === "function") client.connect();

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
  if (message.startsWith(chatCommand)) {
    if (!IsUserAllowed(permissionLevel, data, platform)) return;
    const parts = message.trim().split(/\s+/);
    const p1 = (parts[1]||'').toLowerCase();
    if (p1 === 'on') StartVibeMeter();
    else if (p1 === 'off') EndVibeMeter();
    else if (Number.isInteger(Number(p1))) StartVibeMeter(parseInt(p1,10));
  }

  if (!/^-?\d+(\.\d+)?$/.test(message)) return;
  const rating = Number(message);
  if (rating < minRating || rating > maxRating) return;

  ratingsMap.set(`${platform}-${userID}`, rating);
  CalculateAverage();
}

/////////////////////////
// LOGIQUE DU METER    //
/////////////////////////
function StartVibeMeter(duration){
  if (isAcceptingSubmissions || isInFinalAnimation) return;

  isAcceptingSubmissions = true;
  label.textContent = Number.isInteger(minRating)?String(minRating):minRating.toFixed(decimalPlaces);
  box.style.backgroundColor = `rgba(255,0,0,1)`;

  client?.sendMessage?.('twitch', `/me VIBE METER ! Entrez un nombre entre ${minRating} et ${maxRating}`, { bot:true });
  client?.sendMessage?.('youtube', `VIBE METER ! Entrez un nombre entre ${minRating} et ${maxRating}`, { bot:true });

  ratingsMap.clear();
  ShowWidget();

  if (duration == null) duration = defaultDuration;
  loadingBar.style.transitionDuration = `${duration}s`;
  loadingBar.style.height = 0;

  if (duration > 0) setTimeout(EndVibeMeter, duration * 1000);
}

function EndVibeMeter(){
  if (!isAcceptingSubmissions){
    client?.sendMessage?.('twitch', `/me Tapez "${chatCommand} on" pour démarrer le Vibe Meter`, { bot:true });
    client?.sendMessage?.('youtube', `Tapez "${chatCommand} on" pour démarrer le Vibe METER`, { bot:true });
    return;
  }

  isInFinalAnimation = true;
  isAcceptingSubmissions = false;

  ratingBoxBackground.style.animation = 'pulse 1s linear 1s forwards';
  const finalRating = CalculateAverage();

  setTimeout(()=>{
    client?.sendMessage?.('twitch', `/me VERDICT VIBE METER : ${finalRating}/${maxRating}`, { bot:true });
    client?.sendMessage?.('youtube', `VERDICT VIBE METER : ${finalRating}/${maxRating}`, { bot:true });

    ratingBoxBackground.style.animation = '';
    setTimeout(()=>{
      HideWidget();
      setTimeout(()=>{
        loadingBar.style.transitionDuration = `0s`;
        loadingBar.style.height = `100%`;
        isInFinalAnimation = false;
      }, 1000);
    }, 2000);
  }, 1000);
}

/////////////////////////
// UTILITAIRES         //
/////////////////////////
function CalculateAverage(){
  let sum=0,count=0;
  for (const [,v] of ratingsMap){ sum+=v; count++; }
  const average = count>0 ? sum/count : 0;
  UpdateRatingBox(average);
  return average;
}

function IsUserAllowed(target, data, platform){ return GetPermissionLevel(data, platform) >= target; }
function GetPermissionLevel(data, platform){
  switch (platform){
    case 'twitch':
      if (data.message.role >= 4) return 40;
      if (data.message.role >= 3) return 30;
      if (data.message.role >= 2) return 20;
      if (data.message.role >= 2 || data.message.subscriber) return 15;
      return 10;
    case 'youtube':
      if (data.user.isOwner) return 40;
      if (data.user.isModerator) return 30;
      if (data.user.isSponsor) return 15;
      return 10;
    default: return 10;
  }
}

function UpdateRatingBox(newValue, duration=200){
  const start = parseFloat((label.textContent||'').replace(',','.')) || minRating;
  const t0 = performance.now();

  function step(t){
    const k = Math.min((t - t0)/duration, 1);
    const v = start + (newValue - start)*k;

    label.textContent = Number.isInteger(v)?String(v):v.toFixed(decimalPlaces);

    const clamped = Math.min(Math.max(v, minRating), maxRating);
    const range = maxRating - minRating;
    const p = range===0 ? 1 : (clamped - minRating)/range;

    const red = Math.round(255*(1-p));
    const green = Math.round(255*p);
    const color = `rgba(${red},${green},0,1)`;
    box.style.backgroundColor = color;
    ratingBoxBackground.style.backgroundColor = color;

    if (k<1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function ShowWidget(){ ratingBoxWrapper.style.animation = `showWidget 0.5s ease-in-out forwards`; }
function HideWidget(){ ratingBoxWrapper.style.animation = `hideWidget 0.5s ease-in-out forwards`; }

///////////////////////////////////
// STATUT CONNEXION (étiquette) //
///////////////////////////////////
function SetConnectionStatus(connected, hint=""){
  const el = document.getElementById("statusContainer");
  if (connected){
    el.style.background = "#2FB774";
    el.innerText = "Connecté !";
    el.style.opacity = 1;
    setTimeout(()=>{ el.style.transition = "all 2s ease"; el.style.opacity = 0; }, 10);
  } else {
    el.style.background = "#D12025";
    el.innerText = "Connexion…" + (hint ? ` (${hint})` : "");
    el.style.transition = "";
    el.style.opacity = 1;
  }
}

// GO
connectStreamerBot();
