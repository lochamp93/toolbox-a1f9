////////////////
// PARAMETERS //
////////////////

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);

let sbDebugMode = true;
const sbServerAddress = urlParams.get("address") || "127.0.0.1";
const sbServerPort = urlParams.get("port") || "8080";
const sbServerPassword = urlParams.get("password") || "cumming";

// General
const chatCommand = urlParams.get("chatCommand") || "!vibemeter";
const permissionLevel = GetIntParam("permissionLevel", 30);
const minRating = GetIntParam("minRating", 0);
const maxRating = GetIntParam("maxRating", 10);
const defaultDuration = GetIntParam("defaultDuration", 60);

// Appearance
const decimalPlaces = GetIntParam("decimalPlaces", 1);
const fontSize = GetIntParam("fontSize", 150);



/////////////////
// GLOBAL VARS //
/////////////////

const ratingsMap = new Map();
let isAcceptingSubmissions = false;
let isInFinalAnimation = false;
// Sons désactivés
// const tickSFX = new Audio('sfx/tick.mp3');
// const whooshSFX = new Audio('sfx/trailer-whoosh.mp3');



///////////////////
// PAGE ELEMENTS //
///////////////////

const label = document.getElementById("ratingLabel");
const box = document.getElementById("ratingBox");
const ratingBoxBackground = document.getElementById("ratingBoxBackground");
const videoEl = document.getElementById("ratingVideo");
const loadingBar = document.getElementById("loadingBar");
const ratingBoxWrapper = document.getElementById("ratingBoxWrapper");

// Set appearance
label.style.fontSize = `${fontSize}px`;



/////////////////////////
// STREAMER.BOT CLIENT //
/////////////////////////

const client = new StreamerbotClient({
	host: sbServerAddress,
	port: sbServerPort,
	password: sbServerPassword,

	onConnect: (data) => {
		console.log(`Streamer.bot connecté avec succès à ${sbServerAddress}:${sbServerPort}`)
		console.debug(data);
		SetConnectionStatus(true);
	},

	onDisconnect: () => {
		console.error(`Streamer.bot déconnecté de ${sbServerAddress}:${sbServerPort}`)
		SetConnectionStatus(false);
	}
});

client.on('Twitch.ChatMessage', (response) => {
	console.debug(response.data);
	try {
		TwitchChatMessage(response.data);
	}
	catch (error) {
		console.error(error);
	}
})

client.on('YouTube.Message', (response) => {
	console.debug(response.data);
	try {
		YouTubeMessage(response.data);
	}
	catch (error) {
		console.error(error);
	}
})



/////////////////////////
// QUICK RATING WIDGET //
/////////////////////////

function TwitchChatMessage(data) {
	const platform = `twitch`;
	const userID = data.user.id;
	const message = data.message.message;

	CheckInput(platform, userID, message, data);
}

function YouTubeMessage(data) {
	const platform = `twitch`;
	const userID = data.user.id;
	const message = data.message;

	CheckInput(platform, userID, message, data);
}

function CheckInput(platform, userID, message, data) {
	// Check for the start command
	if (message.startsWith(chatCommand)) {
		if (!IsThisUserAllowedToTypeCommandsReturnTrueIfTheyCanReturnFalseIfTheyCannot(permissionLevel, data, platform))
			return;

		const parameters = message.split(' ');
		switch (parameters[1]) {
			case "on":
				StartVibeMeter();
				break;
			case "off":
				EndVibeMeter();
				break;
			default:
				// Check if the parameter is a number
				if (Number.isInteger(Number(parameters[1])))
					StartVibeMeter(parseInt(parameters[1]));
				break;
		}
	}

	// Check if the input is valid
	if (!isNumeric(message))
		return;

	const rating = Number(message);

	if (rating < minRating || rating > maxRating)
		return;

	// TODO:
	// (1) Check ratingsMap
	// (2) If platform-username is in map, return 

	// Store the rating into map
	ratingsMap.set(`${platform}-${userID}`, rating);
	console.log(`${userID}: ${rating}`);

	// Calculate average
	try {
		CalculateAverage();
	}
	catch (error) {
		console.error(error);
	}
}

function StartVibeMeter(duration) {
	// If we are already accepting submissions, don't continue
	if (isAcceptingSubmissions || isInFinalAnimation)
		return;

	isAcceptingSubmissions = true;
	label.textContent = Number.isInteger(minRating) ? minRating.toString() : minRating.toFixed(decimalPlaces);
	box.style.backgroundColor = `rgba(255, 0, 0, 1)`;

	// Messages en français
	client.sendMessage('twitch', `/me VIBE METER ! Entrez un nombre entre ${minRating} et ${maxRating}`, { bot: true });
	client.sendMessage('youtube', `VIBE METER ! Entrez un nombre entre ${minRating} et ${maxRating}`, { bot: true });

	// Reset all the scores
	ratingsMap.clear();

	ShowWidget();

	// If no duration is provided, use the default duration
	if (!duration)
		if (duration != 0)
			duration = defaultDuration;

	console.log(duration);

	loadingBar.style.transitionDuration = `${duration}s`;
	loadingBar.style.height = 0;

	if (duration > 0) {
		// Set the countdown
		setTimeout(() => {
			EndVibeMeter();
		}, duration * 1000);

		// Compte à rebours sans son
		let countdown = Math.min(5, duration);

		setTimeout(() => {
			let count = countdown;
			const countdownInterval = setInterval(() => {
				// tickSFX.play(); // Son désactivé
				count--;
				if (count <= 1) {
					clearInterval(countdownInterval);
					console.log("C'est parti !");
				}
			}, 1000);
		}, (duration - countdown) * 1000);
	}
}

function EndVibeMeter() {
	if (!isAcceptingSubmissions) {
		client.sendMessage('twitch', `/me Tapez "${chatCommand} on" pour lancer le Vibe Meter`, { bot: true });
		client.sendMessage('youtube', `Tapez "${chatCommand} on" pour lancer le Vibe Meter`, { bot: true });
		return;
	}

	// Stop taking submissions
	isInFinalAnimation = true;
	isAcceptingSubmissions = false;

	// Son désactivé
	// whooshSFX.play();

	// Pulse animation
	ratingBoxBackground.style.animation = 'pulse 1s linear 1s forwards';

	// Calculate the final rating
	const finalRating = CalculateAverage();

	// Pas de vidéo, juste le message
	setTimeout(() => {
		// Message en français
		client.sendMessage('twitch', `/me VERDICT VIBE METER : ${finalRating}/${maxRating}`, { bot: true });
		client.sendMessage('youtube', `VERDICT VIBE METER : ${finalRating}/${maxRating}`, { bot: true });

		console.log(`Note finale : ${finalRating}`);

		// Vidéos désactivées - on passe directement à la fin
		ratingBoxBackground.style.animation = '';
		
		// On cache le widget après 3 secondes
		setTimeout(() => {
			HideWidget();
			setTimeout(() => {
				loadingBar.style.transitionDuration = `0s`;
				loadingBar.style.height = `100%`;
				isInFinalAnimation = false;
			}, 1000);
		}, 3000);
	}, 4000);
}

// Les événements vidéo ne sont plus nécessaires mais on les garde au cas où
videoEl.addEventListener('play', () => {
	console.debug('vidéo démarrée : ' + videoEl.src);
	videoEl.style.opacity = 0.5;
});

videoEl.addEventListener('ended', () => {
	console.debug('vidéo terminée : ' + videoEl.src);

	setTimeout(() => {
		HideWidget();
		setTimeout(() => {
			loadingBar.style.transitionDuration = `0s`;
			loadingBar.style.height = `100%`;
		}, 1000);
	}, 3000);
});

videoEl.addEventListener('timeupdate', () => {
	console.debug('vidéo timeupdate : ' + videoEl.src);

	// Start the fade out 1 second before the video ends
	if (videoEl.duration - videoEl.currentTime <= 1)
		videoEl.style.opacity = 0;

	setTimeout(() => {
		isInFinalAnimation = false;
	}, 1000);
});




//////////////////////
// HELPER FUNCTIONS //
//////////////////////

function CalculateAverage() {

	// Literally 4th grade mathematics
	let sum = 0;
	let count = 0;
	for (const [key, value] of ratingsMap) {
		sum += value;
		count++;
	}

	const average = count > 0 ? sum / count : 0;
	console.debug(`Note actuelle : ${average}`);

	// Update the label
	UpdateRatingBox(average);

	return average;
}

function IsThisUserAllowedToTypeCommandsReturnTrueIfTheyCanReturnFalseIfTheyCannot(targetPermissions, data, platform) {
	return GetPermissionLevel(data, platform) >= targetPermissions;
}

function GetPermissionLevel(data, platform) {
	switch (platform) {
		case 'twitch':
			if (data.message.role >= 4)
				return 40;
			else if (data.message.role >= 3)
				return 30;
			else if (data.message.role >= 2)
				return 20;
			else if (data.message.role >= 2 || data.message.subscriber)
				return 15;
			else
				return 10;
		case 'youtube':
			if (data.user.isOwner)
				return 40;
			else if (data.user.isModerator)
				return 30;
			else if (data.user.isSponsor)
				return 15;
			else
				return 10;
	}
}

function isNumeric(str) {
	return /^-?\d+(\.\d+)?$/.test(str);
}

function UpdateRatingBox(newValue, duration = 200) {
	const start = parseFloat(label.textContent) || minRating;
	const startTime = performance.now();

	function update(currentTime) {
		const elapsed = currentTime - startTime;
		const progress = Math.min(elapsed / duration, 1);
		const value = start + (newValue - start) * progress;

		// Update label with 1 decimal place
		label.textContent = Number.isInteger(value) ? value.toString() : value.toFixed(decimalPlaces);

		// Normalize value within the min-max range
		const clampedValue = Math.min(Math.max(value, minRating), maxRating);
		const range = maxRating - minRating;
		const percent = range === 0 ? 1 : (clampedValue - minRating) / range;

		// Interpolate red to green
		const red = Math.round(255 * (1 - percent));
		const green = Math.round(255 * percent);
		box.style.backgroundColor = `rgba(${red}, ${green}, 0, 1)`;
		ratingBoxBackground.style.backgroundColor = `rgba(${red}, ${green}, 0, 1)`;

		if (progress < 1) {
			requestAnimationFrame(update);
		}
	}

	requestAnimationFrame(update);
}

function ShowWidget() {
	ratingBoxWrapper.style.animation = `showWidget 0.5s ease-in-out forwards`;
}

function HideWidget() {
	ratingBoxWrapper.style.animation = `hideWidget 0.5s ease-in-out forwards`;
}



///////////////////////////////////
// STREAMER.BOT WEBSOCKET STATUS //
///////////////////////////////////

// This function sets the visibility of the Streamer.bot status label on the overlay
function SetConnectionStatus(connected) {
	let statusContainer = document.getElementById("statusContainer");
	if (connected) {
		statusContainer.style.background = "#2FB774";
		statusContainer.innerText = "Connecté !";
		statusContainer.style.opacity = 1;
		setTimeout(() => {
			statusContainer.style.transition = "all 2s ease";
			statusContainer.style.opacity = 0;
		}, 10);
	}
	else {
		statusContainer.style.background = "#D12025";
		statusContainer.innerText = "Connexion...";
		statusContainer.style.transition = "";
		statusContainer.style.opacity = 1;
	}
}
