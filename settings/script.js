/////////////////////////////
// URLS ABSOLUES (GitHub Pages)
/////////////////////////////

// settings.json est dans le même dossier que cette page
const settingsJson = "./settings.json";

// Calcule automatiquement l'URL absolue de l'overlay à partir de l'URL de la page config.
// Ex: https://lochamp93.github.io/toolbox-a1f9/settings/ -> https://lochamp93.github.io/toolbox-a1f9/
const baseFromSettings = (function () {
  const { origin, pathname } = window.location;
  const rootPath = pathname.replace(/\/settings\/.*$/, "/");
  return origin + rootPath; // ex: https://lochamp93.github.io/toolbox-a1f9/
})();

// Surchargable via ?widgetURL=... si tu veux forcer autre chose
const urlParams = new URLSearchParams(location.search);
const widgetURL = urlParams.get("widgetURL") || baseFromSettings;

// helper bool
function GetBooleanParam(name, def=false){
  const v = urlParams.get(name);
  if (v == null) return def;
  return ["1","true","yes","on"].includes(String(v).toLowerCase());
}
const showUnmuteIndicator = GetBooleanParam("showUnmuteIndicator", false);

/////////////////////////
// ÉLÉMENTS DE LA PAGE
/////////////////////////

const widgetUrlInputWrapper = document.getElementById('widgetUrlInputWrapper');
const widgetUrlInput = document.getElementById('widgetUrlInput');
const urlLabel = document.getElementById('urlLabel');
const settingsPanel = document.getElementById('settingsPanel');
const widgetPreview = document.getElementById('widgetPreview');
const loadURLBox = document.getElementById('loadUrlBox');
const loadDefaultsBox = document.getElementById('loadDefaultsWrapper');
const loadSettingsBox = document.getElementById('loadSettingsWrapper');
const unmuteLabel = document.getElementById('unmute-label');

let settingsData = '';
let settingsMap = new Map();

// clé de stockage (basée sur le nom de l'overlay)
const parts = widgetURL.replace(/\/+$/, '').split('/');
const keyPrefix = parts[parts.length - 1] || 'overlay';

if (showUnmuteIndicator) unmuteLabel.style.display = 'inline';
loadUrlBox.placeholder = `${widgetURL}?...`;

/////////////////////////////
// CHARGER settings.json
/////////////////////////////
function LoadJSON(url) {
  fetch(url)
    .then(r => r.json())
    .then(data => {
      settingsData = data;
      settingsPanel.innerHTML = '';

      const grouped = {};
      data.settings.forEach(s => (grouped[s.group] ||= []).push(s));

      for (const groupName in grouped) {
        const groupDiv = document.createElement('div');
        groupDiv.classList.add('setting-group');

        const groupHeader = document.createElement('h2');
        groupHeader.textContent = groupName;
        groupDiv.appendChild(groupHeader);

        grouped[groupName].forEach(setting => {
          const item = document.createElement('div');
          item.classList.add('setting-item');
          item.id = `item-${setting.id}`;

          const labelDescriptionDiv = document.createElement('div');
          if (setting.label) {
            const label = document.createElement('label');
            label.textContent = setting.label;
            labelDescriptionDiv.appendChild(label);
          }
          if (setting.description) {
            const description = document.createElement('p');
            description.innerHTML = setting.description;
            labelDescriptionDiv.appendChild(description);
          }

          const content = document.createElement('div');
          content.classList.add('setting-item-content');

          let input;
          switch (setting.type) {
            case 'text':
            case 'password': {
              input = document.createElement('input');
              input.type = setting.type;
              input.id = setting.id;
              input.value = settingsMap.has(setting.id) ? settingsMap.get(setting.id) : setting.defaultValue;
              input.autocomplete = 'new-password';
              break;
            }
            case 'checkbox': {
              const labelDiv = document.createElement('label');
              labelDiv.classList.add('switch');
              const cb = document.createElement('input');
              cb.type = 'checkbox';
              cb.id = setting.id;
              cb.checked = settingsMap.has(setting.id) ? settingsMap.get(setting.id) : setting.defaultValue;
              labelDiv.appendChild(cb);

              const slider = document.createElement('span');
              slider.classList.add('slider','round');
              labelDiv.appendChild(slider);

              labelDiv.addEventListener('click', () => {
                cb.checked = !cb.checked;
                UpdateSettingItemVisibility();
              });
              input = labelDiv;
              break;
            }
            case 'select': {
              input = document.createElement('select');
              input.id = setting.id;
              setting.options.forEach(opt => {
                const o = document.createElement('option');
                o.value = opt.value;
                o.textContent = opt.label;
                if (opt.value === setting.defaultValue) o.selected = true;
                input.appendChild(o);
              });
              input.value = settingsMap.has(setting.id) ? settingsMap.get(setting.id) : setting.defaultValue;
              break;
            }
            case 'color': {
              input = document.createElement('input');
              input.type = 'color';
              input.id = setting.id;
              input.value = settingsMap.has(setting.id) ? settingsMap.get(setting.id) : setting.defaultValue;
              break;
            }
            case 'number': {
              input = document.createElement('input');
              input.type = 'number';
              input.id = setting.id;
              input.value = settingsMap.has(setting.id) ? settingsMap.get(setting.id) : setting.defaultValue;
              input.min = setting.min;
              input.max = setting.max;
              input.step = setting.step;
              break;
            }
            case 'button': {
              input = document.createElement('button');
              input.id = setting.id;
              input.textContent = setting.label;
              input.addEventListener('click', () => {
                widgetPreview.contentWindow?.[setting.callFunction]?.();
                const bg = "#2e2e2e", fg = "white";
                input.style.transitionDuration='0s';
                input.style.backgroundColor="#2196f3";
                input.style.color="#fff";
                setTimeout(()=>{input.style.transitionDuration='.2s';input.style.backgroundColor=bg;input.style.color=fg;},100);
              });
              break;
            }
            default: {
              input = document.createElement('input');
              input.type = 'text';
              input.id = setting.id;
              input.value = settingsMap.has(setting.id) ? settingsMap.get(setting.id) : setting.defaultValue;
            }
          }

          if (!settingsMap.has(setting.id)) settingsMap.set(setting.id, setting.defaultValue);

          input.addEventListener('input', () => {
            const el = document.getElementById(setting.id);
            if (setting.type === 'checkbox') settingsMap.set(setting.id, el.checked);
            else settingsMap.set(setting.id, el.value);
            SaveSettingsToStorage();
            RefreshWidgetPreview();
          });

          content.appendChild(input);
          if (setting.type === 'button') {
            item.style.display='block';
            item.appendChild(content);
          } else {
            item.appendChild(labelDescriptionDiv);
            item.appendChild(content);
          }
          groupDiv.appendChild(item);
        });

        settingsPanel.appendChild(groupDiv);
      }

      function UpdateSettingItemVisibility() {
        data.settings.forEach(setting => {
          if (setting.showIf) {
            const parentInput = document.getElementById(setting.showIf);
            const show = !!parentInput?.checked;
            document.getElementById(`item-${setting.id}`).style.display = show ? 'flex' : 'none';
          }
        });
      }

      UpdateSettingItemVisibility();
      RefreshWidgetPreview();
      SaveSettingsToStorage();
    })
    .catch(err => console.error('Erreur settings.json:', err));
}

///////////////////////
// STOCKAGE LOCAL
///////////////////////
function SaveSettingsToStorage(){
  localStorage.setItem(`${keyPrefix}-settings`, JSON.stringify(Array.from(settingsMap.entries())));
}
function LoadSettingsFromStorage(){
  const s = localStorage.getItem(`${keyPrefix}-settings`);
  if (s){ settingsMap = new Map(JSON.parse(s)); }
}
function LoadDefaultSettings(){
  localStorage.removeItem(`${keyPrefix}-settings`);
  settingsMap = new Map();
  LoadJSON(settingsJson);
  loadDefaultsBox.style.visibility='hidden'; loadDefaultsBox.style.opacity=0;
}

///////////////////////
// APERÇU
///////////////////////
function RefreshWidgetPreview(){
  const settings = {};
  settingsData.settings.forEach(s=>{
    if (s.type === 'button') return;
    const el = document.getElementById(s.id);
    if (!el) return;
    settings[s.id] = (s.type === 'checkbox') ? el.checked : el.value;
  });

  const qs = Object.entries(settings)
    .map(([k,v])=>`${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  widgetUrlInput.value = widgetURL + "?" + qs;
  widgetPreview.src = widgetUrlInput.value;
}

///////////////////////
// POPUPS & BOUTONS
///////////////////////
function CopyURLToClipboard(){
  navigator.clipboard.writeText(widgetUrlInput.value);
  const m = document.createElement('span');
  m.textContent = 'Copié dans le presse-papiers !';
  m.style.position='absolute'; m.style.top='50%'; m.style.left='50%';
  m.style.transform='translate(-50%,-50%)'; m.style.background='#00dd63';
  m.style.color='#fff'; m.style.padding='5px 10px'; m.style.borderRadius='5px';
  m.style.zIndex='2'; m.style.opacity='0'; m.style.transition='opacity .2s';
  widgetUrlInputWrapper.appendChild(m); void m.offsetWidth; m.style.opacity='1';
  setTimeout(()=>{m.style.opacity='0'; setTimeout(()=>widgetUrlInputWrapper.removeChild(m),500);},1500);
}
function CloseDefaultsPopup(){ loadDefaultsBox.style.visibility='hidden'; loadDefaultsBox.style.opacity=0; }
function CloseSettings(){ loadSettingsBox.style.visibility='hidden'; loadSettingsBox.style.opacity=0; }
function OpenLoadDefaultsPopup(){ loadDefaultsBox.style.visibility='visible'; loadDefaultsBox.style.opacity=1; }
function OpenLoadSettingsPopup(){ loadSettingsBox.style.visibility='visible'; loadSettingsBox.style.opacity=1; }

function LoadSettings(){
  const url = new URL(loadURLBox.value);
  url.searchParams.forEach((value, key)=>{
    const el = document.getElementById(key);
    if (!el) return;
    if (el.type === 'checkbox') el.checked = value.toLowerCase() === 'true';
    else el.value = value;
    el.dispatchEvent(new Event('input'));
  });
  loadURLBox.value='';
  loadSettingsBox.style.visibility='hidden'; loadSettingsBox.style.opacity=0;
}

///////////////////////
// INIT
///////////////////////
LoadSettingsFromStorage();
LoadJSON(settingsJson);
