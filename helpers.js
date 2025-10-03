// Helper functions pour récupérer les paramètres d'URL

function GetIntParam(paramName, defaultValue) {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const value = urlParams.get(paramName);
    
    if (value === null) return defaultValue;
    
    const parsed = parseInt(value);
    return isNaN(parsed) ? defaultValue : parsed;
}

function GetBooleanParam(paramName, defaultValue) {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const value = urlParams.get(paramName);
    
    if (value === null) return defaultValue;
    
    return value.toLowerCase() === 'true';
}

function GetStringParam(paramName, defaultValue) {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const value = urlParams.get(paramName);
    
    return value === null ? defaultValue : value;
}
