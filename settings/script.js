/////////////////////////
// PARAMÈTRES DE LA PAGE
/////////////////////////

const urlParams = new URLSearchParams(window.location.search);

// Fichiers par défaut : ton settings.json FR + ton overlay index.html
const settingsJson = urlParams.get("settingsJson") || "./settings.json";
const widgetURL    = urlParams.get("widgetURL")    || "../index.html";

// helper pour récupérer un booléen
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

// Variables globales
let settingsData = '';
let settingsMap = new Map();

// clé unique par widget
const parts = widgetURL.replace(/\/+$/, '').split('/');
const keyPrefix = parts[parts.length - 1];

// Afficher indicateur “cliquer pour activer son” si demandé
if (showUnmuteIndicator) unmuteLabel.style.display = 'inline';

// Placeholder du champ URL
loadUrlBox.placeholder = `${widgetURL}?...`;

/////////////////////////////
// CHARGER LE settings.json
/////////////////////////////

function LoadJSON(settingsJson) {
  fetch(settingsJson)
    .then(response => response.json())
    .then(data => {
      settingsData = data;
      settingsPanel.innerHTML = ''; // reset

      const groupedSettings = {};
      data.settings.forEach(setting => {
        if (!groupedSettings[setting.group]) groupedSettings[setting.group] = [];
        groupedSettings[setting.group].push(setting);
      });

      // rendre chaque groupe
      for (const groupName in groupedSettings) {
        const groupDiv = document.createElement('div');
        groupDiv.classList.add('setting-group');

        const groupHeader = document.createElement('h2');
        groupHeader.textContent = groupName;
        groupDiv.appendChild(groupHeader);

        groupedSettings[groupName].forEach(setting => {
          const settingItem = document.createElement('div');
          settingItem.classList.add('setting-item');
          settingItem.id = `item-${setting.id}`;

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

          const settingItemContent = document.createElement('div');
          settingItemContent.classList.add('setting-item-content');

          let inputElement;
          switch (setting.type) {
            case 'text':
            case 'password':
              inputElement = document.createElement('input');
              inputElement.type = setting.type;
              inputElement.id = setting.id;
              inputElement.value = settingsMap.has(setting.id) ? settingsMap.get(setting.id) : setting.defaultValue;
              inputElement.autocomplete = 'new-password';
              break;
            case 'checkbox':
              const labelDiv = document.createElement('label');
              labelDiv.classList.add('switch');
              const checkBoxElement = document.createElement('input');
              checkBoxElement.type = 'checkbox';
              checkBoxElement.id = setting.id;
              checkBoxElement.checked = settingsMap.has(setting.id) ? settingsMap.get(setting.id) : setting.defaultValue;
              labelDiv.appendChild(checkBoxElement);

              const slider = document.createElement('span');
              slider.classList.add('slider','round');
              labelDiv.appendChild(slider);

              labelDiv.addEventListener('click', () => {
                checkBoxElement.checked = !checkBoxElement.checked;
                UpdateSettingItemVisibility();
              });
              inputElement = labelDiv;
              break;
            case 'select':
              inputElement = document.createElement('select');
              inputElement.id = setting.id;
              setting.options.forEach(option => {
                const optionElement = document.createElement('option');
                optionElement.value = option.value;
                optionElement.textContent = option.label;
                if (option.value === setting.defaultValue) optionElement.selected = true;
                inputElement.appendChild(optionElement);
              });
              inputElement.value = settingsMap.has(setting.id) ? settingsMap.get(setting.id) : setting.defaultValue;
              break;
            case 'color':
              inputElement = document.createElement('input');
              inputElement.type = 'color';
              inputElement.id = setting.id;
              inputElement.value = settingsMap.has(setting.id) ? settingsMap.get(setting.id) : setting.defaultValue;
              break;
            case 'number':
              inputElement = document.createElement('input');
              inputElement.type = 'number';
              inputElement.id = setting.id;
              inputElement.value = settingsMap.has(setting.id) ? settingsMap.get(setting.id) : setting.defaultValue;
              inputElement.min = setting.min;
              inputElement.max = setting.max;
              inputElement.step = setting.step;
              break;
            case 'button':
              inputElement = document.createElement('button');
              inputElement.id = setting.id;
              inputElement.textContent = setting.label;
              inputElement.addEventListener('click', () => {
                widgetPreview.contentWindow[setting.callFunction]?.();
                // petit flash
                const defaultBackgroundColor = "#2e2e2e";
                const defaultTextColor = "white";
                inputElement.style.transitionDuration = '0s';
                inputElement.style.backgroundColor = "#2196f3";
                inputElement.style.color = "#ffffff";
                setTimeout(() => {
                  inputElement.style.transitionDuration = '0.2s';
                  inputElement.style.backgroundColor = defaultBackgroundColor;
                  inputElement.style.color = defaultTextColor;
                }, 100);
              });
              break;
            default:
              inputElement = document.createElement('input');
              inputElement.type = 'text';
              inputElement.id = setting.id;
              inputElement.value = settingsMap.has(setting.id) ? settingsMap.get(setting.id) : setting.defaultValue;
          }

          if (!settingsMap.has(setting.id))
            settingsMap.set(setting.id, setting.defaultValue);

          // rafraîchir preview à chaque changement
          inputElement.addEventListener('input', () => {
            const settingElement = document.getElementById(setting.id);
            if (setting.type === 'checkbox')
              settingsMap.set(setting.id, settingElement.checked);
            else
              settingsMap.set(setting.id, settingElement.value);

            SaveSettingsToStorage();
            RefreshWidgetPreview();
          });

          settingItemContent.appendChild(inputElement);

          if (setting.type === 'button') {
            settingItem.style.display = 'block';
            settingItem.appendChild(settingItemContent);
          } else {
            settingItem.appendChild(labelDescriptionDiv);
            settingItem.appendChild(settingItemContent);
          }

          groupDiv.appendChild(settingItem);
        });

        settingsPanel.appendChild(groupDiv);
      }

      function UpdateSettingItemVisibility() {
        data.settings.forEach(setting => {
          if (setting.showIf) {
            const parentInput = document.getElementById(setting.showIf);
            let shouldShow = parentInput?.checked;
            document.getElementById(`item-${setting.id}`).style.display = shouldShow ? 'flex' : 'none';
          }
        });
      }

      UpdateSettingItemVisibility();
      RefreshWidgetPreview();
      SaveSettingsToStorage();
    })
    .catch(error => console.error('Erreur chargement settings.json:', error));
}

///////////////////////
// SAUVEGARDE LOCALE
///////////////////////

function SaveSettingsToStorage() {
  const settingsArray = Array.from(settingsMap.entries());
  const settingsArrayString = JSON.stringify(settingsArray);
  localStorage.setItem(`${keyPrefix}-settings`, settingsArrayString);
}

function LoadSettingsFromStorage() {
  const settingsMapString = localStorage.getItem(`${keyPrefix}-settings`);
  if (settingsMapString) {
    const settingsMapArray = JSON.parse(settingsMapString);
    settingsMap = new Map(settingsMapArray);
  }
}

function LoadDefaultSettings() {
  localStorage.removeItem(`${keyPrefix}-settings`);
  settingsMap = new Map();
  LoadJSON(settingsJson);
  loadDefaultsBox.style.visibility = 'hidden';
  loadDefaultsBox.style.opacity = 0;
}

//////////////////////
// APERÇU WIDGET
//////////////////////

function RefreshWidgetPreview() {
  const settings = {};
  settingsData.settings.forEach(setting => {
    if (setting.type === 'button') return;
    let el = document.getElementById(setting.id);
    if (!el) return;
    if (setting.type === 'checkbox')
      settings[setting.id] = el.checked;
    else
      settings[setting.id] = el.value;
  });

  const paramString = Object.entries(settings)
    .map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  widgetUrlInput.value = widgetURL + "?" + paramString;
  widgetPreview.src = widgetUrlInput.value;
}

//////////////////////
// BOUTONS & POPUPS
//////////////////////

function CopyURLToClipboard() {
  navigator.clipboard.writeText(widgetUrlInput.value);
  const copiedMessage = document.createElement('span');
  copiedMessage.textContent = 'Copié dans le presse-papiers !';
  copiedMessage.style.position = 'absolute';
  copiedMessage.style.top = '50%'; copiedMessage.style.left = '50%';
  copiedMessage.style.transform = 'translate(-50%, -50%)';
  copiedMessage.style.backgroundColor = '#00dd63';
  copiedMessage.style.color = 'white';
  copiedMessage.style.padding = '5px 10px';
  copiedMessage.style.borderRadius = '5px';
  copiedMessage.style.zIndex = '2';
  copiedMessage.style.opacity = '0';
  copiedMessage.style.transition = 'opacity 0.2s ease-in-out';
  widgetUrlInputWrapper.appendChild(copiedMessage);
  void copiedMessage.offsetWidth; // trigger reflow
  copiedMessage.style.opacity = '1';
  setTimeout(() => {
    copiedMessage.style.opacity = '0';
    setTimeout(() => widgetUrlInputWrapper.removeChild(copiedMessage), 500);
  }, 1500);
}

function CloseDefaultsPopup(){ loadDefaultsBox.style.visibility='hidden'; loadDefaultsBox.style.opacity=0; }
function CloseSettings(){ loadSettingsBox.style.visibility='hidden'; loadSettingsBox.style.opacity=0; }

function LoadSettings() {
  const url = new URL(loadURLBox.value);
  url.searchParams.forEach((value,key) => {
    const el = document.getElementById(key);
    if (el) {
      if (el.type === 'checkbox') el.checked = value.toLowerCase() === 'true';
      else el.value = value;
      el.dispatchEvent(new Event('input'));
    }
  });
  loadURLBox.value = '';
  loadSettingsBox.style.visibility='hidden'; loadSettingsBox.style.opacity=0;
}

function OpenMembershipPage() {
  window.open("https://nutty.gg/collections/member-exclusive-widgets", '_blank').focus();
}
function OpenLoadDefaultsPopup(){ loadDefaultsBox.style.visibility='visible'; loadDefaultsBox.style.opacity=1; }
function OpenLoadSettingsPopup(){ loadSettingsBox.style.visibility='visible'; loadSettingsBox.style.opacity=1; }

/////////////////////
// INIT
/////////////////////

LoadSettingsFromStorage();
LoadJSON(settingsJson);
