/**
 * TuxTwitchTalker: A bot to interact with Twitch Chat.
 * See https://github.com/LinuxLovah/TuxTwitchTalker
 *
 * Parts of this program were modeled on:
 * 		https://dev.twitch.tv/docs/irc
 * 		https://d-fischer.github.io/twitch-chat-client/reference/classes/ChatClient.html
 * 		https://github.com/tmijs/tmi.js/issues/363
 * 		https://twurple.js.org/docs/examples/chat/basic-bot.html
 * 		https://socket.io/get-started/chat
 */



//--------------------- Load dependency objects
const tmi = require('tmi.js');
const path = require('path');
const fs = require('fs');
const { exec } = require("child_process");
const { exit } = require('process');
const http = require('http');
const url = require('url');
const { Server } = require("socket.io");


//--------------------- Global variables
var allChattersFile = "data/all_chatters.txt";
var browserSourceAlertContent = "";
var configFile = "";
var env = {};
var periodicMessageTimers = [];
var seenUsers = [];
var webServer;
var socketServer;


var hitCounter=0;

//--------------------- Constants
const cADMIN_USERS =		"ADMIN_USERS";
const cAUDIO_FILE_PATH = 	"AUDIO_FILE_PATH";
const cBAN = 				"BAN";
const cBOT_NAME = 			"BOT_NAME";
const cCHANNELS = 			"CHANNELS";
const cCHAT = 				"CHAT";
const cCOMMANDS_FEATURE_FLAGS =  "COMMANDS_FEATURE_FLAGS";
const cDEFAULT = 			"default";
const cDEFAULT_MOD = 		"default_mod";
const cDEFAULT_VIP = 		"default_vip";
const cFEATURE_FLAGS = 		"COMMANDS_FEATURE_FLAGS";
const cFIRST_TIME_CHATTER = "first_time_chatter";
const cFORBIDDEN_PHRASES = 	"FORBIDDEN_PHRASES";
const cGREETINGS = 			"GREETINGS";
const cIGNORE_USERS = 		"IGNORE_USERS";
const cMEDIA = 				"MEDIA";
const cMEDIAFILE = 			"MEDIAFILE";
const cMEDIA_PLAYER_COMMAND = "MEDIA_PLAYER_COMMAND";
const cPERIODIC_MESSAGES = 	"PERIODIC_MESSAGES";
const cPORT = 				"PORT";
const cRANDOM_FILE_LINE_COMMANDS = "RANDOM_FILE_LINE_COMMANDS";
const cSHOUTOUT = 			"SHOUTOUT";
const cTIMER_ALERT = 		"TIMER_ALERT";
const cTIMERNAME = 			"TIMERNAME";
const cTIMEOUT = 			"TIMEOUT";
const cTMI_OAUTH = 			"TMI_OAUTH";
const cTRIGGERED_MESSAGES = "TRIGGERED_MESSAGES";
const cUSERNAME = 			"USERNAME";
const cWEB_SERVER = 		"WEB_SERVER"

//--------------------- Config
// First parameter is the config file to load
// Default is "./config.json"
configFile = process.argv[2];
if (!configFile || configFile.length === 0) {
	configFile = "./config.json";
}
if (!configFile || configFile.length === 0) {
	console.log(`No config file specified. Exiting.`);
	process.exit(1);
} else if (!fs.existsSync(configFile)) {
	console.log(`Config file '${configFile}' does not exist.  Exiting.`);
	process.exit(1);
}
loadConfigFile();
const channel = env[cCHANNELS][0];

//--------------------- Connect and register handlers
// Define tmi configuration options
const opts = {
	identity: {
		username: env[cBOT_NAME],
		password: env[cTMI_OAUTH]
	},
	channels: env[cCHANNELS]
};

const client = new tmi.client(opts);

client.on('connected', onConnectedHandler);
client.on('message', onMessageHandler);

// Connect to Twitch:
client.connect();

// If the bot dies, say so in chat
process.on('uncaughtException', function (err) {
	console.log("*** ERROR: UNHANDLED EXCEPTION ***");
	console.log(err);
	client.say(env[cCHANNELS], `${env[cBOT_NAME]} technical difficulties, please check logs!`);
}
);



//--------------------- Browser Source web server
if (isFeatureEnabled("webserver")) {
	if(! env[cWEB_SERVER]) {
		env[cWEB_SERVER] = { PORT:8888 };
	}
	webServer = http.createServer(onWebRequest).listen(env[cWEB_SERVER][cPORT]);
	console.log(`Web server has started listing on ${env[cWEB_SERVER][cPORT]}`);
	socketServer = new Server(webServer);
	socketServer.on('connection', (socket) => {
		console.log('Socket connection established');
		socket.on('disconnect', () => {
			console.log('user disconnected');
	  });
	});
};

//--------------------- Event Handlers
// Called every time the bot connects to Twitch chat
function onConnectedHandler(addr, port) {
	console.log(`Connected to ${addr}:${port}`);
}


// Called every time a message comes in.  This is effectively the main chat processing loop.
function onMessageHandler(target, user, msg) {
	if (env[cIGNORE_USERS] && env[cIGNORE_USERS].includes(user.username.toLowerCase())) {
		return;
	}

	// Remove whitespace from chat message
	let commandName = msg.replace(/[^\x20-\x7E]/g, '').trim();
	// Split arguments once here for all commands to use
	let args = commandName.split(/(\s+)/)

	// If we haven't seen this user before, greet them
	runFirstSeen(target, user, commandName, args);

	// If the command is known, let's execute it
	// Admin commands begin with !!
	if (commandName.startsWith("!!")) {
		runAdminCommand(target, user, commandName, args);
	} else if (commandName.slice(0, 1) === "!") {
		runUserCommand(target, user, commandName, args);
	}

	// Does the post contain forbidden phrases?
	runForbiddenPhrases(target, user, commandName, args);

	// Is it a message triggered by a regular expression in chat
	runTriggeredMessage(target, user, commandName, args);

	// Is this a command to return a random line from a a file defined in RANDOM_FILE_LINE_COMMANDS?
	runRandomFileLineCommands(target, user, commandName);

	// Is it a GIPHY URL?
	runImageLink(target, user, commandName, args);
}



function runAdminCommand(target, user, commandName, args) {
	if (user && user.username && env[cADMIN_USERS].includes(user.username.toLowerCase())) {
		if (commandName === '!!clearSeen') {
			seenUsers = [];
			console.log(`Seen list is now ${seenUsers}`);
		} else if (commandName === '!!exit') {
			console.log(`Exiting due to !!exit command`);
			process.exit(1);
		} else if (commandName === "!!reload") {
			loadConfigFile();
		} else if (commandName.startsWith("!!delSeen ")) {
			user = commandName.split(" ")[1];
			for (var i = 0; i < seenUsers.length; i++) {
				if (seenUsers[i] === user) {
					seenUsers.splice(i, 1);
				}
			}
			console.log(`Seen list is now ${seenUsers}`);
		} else if (commandName.startsWith("!!addSeen ")) {
			user = commandName.split(" ")[1];
			seenUsers.push(user);
			console.log(`Seen list is now ${seenUsers}`);
		} else if (commandName.startsWith("!!testGreeting ")) {
			let username = commandName.split(" ")[1];
			// If the user typed @ to look up the name we want to remove it
			username = username.replace("@", "");
			let testUser = {
				"username": username
			}
			greetUser(target, testUser, commandName);
		} else if (commandName === "!!greetingsOn") {
			enableFeature("greetings");
		} else if (commandName === "!!greetingsOff") {
			disableFeature("greetings");
		}
	} else {
		console.log(`Ignoring admin command '${commandName}' from '${user.username}'`);
	}
}


function runUserCommand(target, user, commandName, args) {
	if (commandName === '!audio') {
		updateMediaBrowserWithAudio("wilhelmscream.mp3");
	} else if (commandName === '!dice' && isFeatureEnabled("dice")) {
		runRollDice(target, user, commandName);
	} else if (commandName.startsWith("!timer ")) {
		runTimer(target, user, commandName, args);
	} else if (commandName.startsWith("!+") && isFeatureEnabled("counter")) {
		counterInc(target, user, commandName, args);
	} else if (commandName.startsWith("!-") && isFeatureEnabled("counter")) {
		counterDec(target, user, commandName, args);
	} else if (commandName.startsWith("!=") && isFeatureEnabled("counter")) {
		counterSet(target, user, commandName, args);
	} else if (commandName.startsWith("!?") && isFeatureEnabled("counter")) {
		counterQuery(target, user, commandName, args);
	}
}

function runTriggeredMessage(target, user, message, args) {
	for (const trigger in env[cTRIGGERED_MESSAGES]) {
		// Triggered commands that start with !! are for admin users.
		if (message.startsWith("!!") && user && user.username && !env[cADMIN_USERS].includes(user.username.toLowerCase())) {
			console.log(`User ${user.username} is not an admin and cannot run the triggered command ${message}`);
			return
		}

		const regex = new RegExp(trigger);
		const matches = message.match(regex);
		if (matches) {
			console.log(`Found triggered message matching ${regex}`);
			if (cCHAT in env[cTRIGGERED_MESSAGES][trigger]) {
				let reply = env[cTRIGGERED_MESSAGES][trigger][cCHAT];
				sendChat(target, user, reply, matches);
			}
			if (cMEDIA in env[cTRIGGERED_MESSAGES][trigger]) {
				let mediaFile = env[cTRIGGERED_MESSAGES][trigger][cMEDIA];
				playMedia(target, user, mediaFile);
			}
			if (cSHOUTOUT in env[cTRIGGERED_MESSAGES][trigger]) {
				let shoutOutCommand = env[cTRIGGERED_MESSAGES][trigger][cSHOUTOUT];
				sendShoutOut(target, user, shoutOutCommand, matches);
			}
		}
	}
}

function runImageLink(target, user, message, args) {
	if (isFeatureEnabled("imagelink")) {
		// TODO Drive this from configuration
		let imageLinkRegex = new RegExp("^(https://media.giphy.com/media/[a-zA-Z0-9]*/giphy.gif|https://media.giphy.com/media/[a-zA-Z0-9]*/giphy-downsized-large.gif)$");
		let outputFile = "data/giphy_popup.html";
		if (message.match(imageLinkRegex)) {
			let contents = `<img src="${message}" width="100%" height="100%">`;
			fs.writeFile(outputFile, contents, err => {
				if (err) {
					console.error(err)
					return
				}
				console.log(`Wrote image link ${contents} for ${user.username}`);
			});
		}
	}
}


function runForbiddenPhrases(target, user, message, args) {
	// We dont want to take actions against mods and VIPs automatically
	// However, if the feature flag forbiddenForModsVIPs is true then we will
	// We never want to trigger for the broadcaster though
	if ((!isFeatureEnabled("forbiddenForModsVIPs")) && (user.mod || user.vip)) {
		return;
	}
	if ("badges" in user && user.badges && "broadcaster" in user.badges) {
		return;
	}

	for (const trigger in env[cFORBIDDEN_PHRASES]) {
		const regex = new RegExp(trigger);
		const matches = message.match(regex);
		if (matches) {
			console.log(`Found forbidden message matching ${regex}`);
			if (cCHAT in env[cFORBIDDEN_PHRASES][trigger]) {
				let reply = env[cFORBIDDEN_PHRASES][trigger][cCHAT];
				sendChat(target, user, reply, matches);
			}
			if (cTIMEOUT in env[cFORBIDDEN_PHRASES][trigger]) {
				let timeoutSeconds = env[cFORBIDDEN_PHRASES][trigger][cTIMEOUT];
				console.log(`Timing out user ${user.username}`);
				sendChat(target, user, `/timeout ${user.username} ${timeoutSeconds}`, matches);
			}
			if (cBAN in env[cFORBIDDEN_PHRASES][trigger]) {
				sendChat(target, user, `/ban ${user.username}`, matches);
			}
		}
	}
}


// Greet viewers the first time we see them in chat
function runFirstSeen(target, user, commandName, args) {
	// Don't greet the broadcaster, he doesn't like talking to themselves
	// This code sometimes throws " TypeError: Cannot use 'in' operator to search for 'broadcaster' in null"
	// which shouldn't happen, so I'm catching it until I can understand it better
	try {
		if ("badges" in user && user.badges && "broadcaster" in user.badges) {
			return;
		}
	} catch (err) {
		console.log("Caught error checking for broadcaster:");
		console.log(err);
		console.log("user object:");
		console.log(JSON.stringify(user, null, 2));
		console.log("Ignoring error");
	}

	if (!seenUsers.includes(user.username.toLowerCase())) {
		seenUsers.push(user.username.toLowerCase());
		console.log(`New user seen '${user.username}'`);

		// Look it up once here or we will get a different answer for the second call
		user.firstTimeChatter = isFirstTimeChatter(user.username);
		greetUser(target, user, commandName);
	}
}

// Function called when the "dice" command is issued
function runRollDice(target, user, commandName) {
	const sides = 6;
	var num = Math.floor(Math.random() * sides) + 1;
	client.say(target, `You rolled a ${num}, ${user.username}`);
}

// Some commands are to read a random line from a file.
// These commands will be defined in the RANDOM_FILE_LINE_COMMANDS array in the config file
function runRandomFileLineCommands(target, user, commandName) {
	if (env[cRANDOM_FILE_LINE_COMMANDS] && commandName in env[cRANDOM_FILE_LINE_COMMANDS]) {
		var fileName = env[cRANDOM_FILE_LINE_COMMANDS][commandName];
		client.say(target, readRandomLine(fileName));
	}
}

// Start a timer with the !timer command.  When the time is up,
// the CHAT entry will be sent to chat and/or MEDIA entry played
function runTimer(target, user, commandName, args) {
	if (!isFeatureEnabled("timer")) {
		return;
	}

	let timerName = "";
	if ((!args[2]) || isNaN(args[2])) {
		client.say(target, "Missing or invalid timer length in minutes");
		return;
	}
	let timeout = Number(args[2]) * 60000;

	if (args[4]) {
		timerName = args.slice(4).join("");
	}
	client.say(target, `Starting timer '${timerName}' for ${timeout}ms`);
	setTimeout(() => {
		if (cTIMER_ALERT in env) {
			if (cCHAT in env[cTIMER_ALERT]) {
				sendChat(target, user, env[cTIMER_ALERT][cCHAT].replace(cTIMERNAME, timerName));
			}
			if (cMEDIA in env[cTIMER_ALERT]) {
				playMedia(target, user, env[cTIMER_ALERT][cMEDIA].replace(cTIMERNAME, timerName));
			}
		}
	}, timeout, timerName);

}


function runPeriodicMessages() {
	// Unload any existing periodic messages
	for (const timer of periodicMessageTimers) {
		clearInterval(timer);
	}
	periodicMessageTimers = [];


	// Load periodic messages
	for (const periodicMessage in env[cPERIODIC_MESSAGES]) {

		console.log(`Loading periodic message '${periodicMessage}' to run every ${env[cPERIODIC_MESSAGES][periodicMessage]["INTERVAL"]} minutes`);

		let timer = setInterval(() => {
			console.log(`Posting periodic message ${periodicMessage} every ${env[cPERIODIC_MESSAGES][periodicMessage]["INTERVAL"]} minute`);
			if (cCHAT in env[cPERIODIC_MESSAGES][periodicMessage]) {
				sendChat(channel, "", env[cPERIODIC_MESSAGES][periodicMessage][cCHAT]);
			}
			if (cMEDIA in env[cPERIODIC_MESSAGES][periodicMessage]) {
				playMedia(channel, "", env[cPERIODIC_MESSAGES][periodicMessage][cMEDIA]);
			}
		}, env[cPERIODIC_MESSAGES][periodicMessage]["INTERVAL"] * 60000); // milliseconds = minutes * 60 * 1000
		periodicMessageTimers.push(timer);
	}
}


// Web server incoming request handler
function onWebRequest(request, response) {
	const queryString = request.url;
	console.log(`Web request: ${queryString}`);

	if (queryString.startsWith("/audio/")) {
		serveAudio(queryString, response);
	} else if (queryString.startsWith("/alert")) {
		response.writeHead(200);
		response.write(`${browserSourceAlertContent}`);
		response.end();
	} else if (queryString.startsWith("/counter")) {
		serveCounterBrowserSource(queryString, response);
	} else if (queryString.startsWith("/media")) {
		serveMediaBrowserSource(queryString, response);
	} else if (queryString.startsWith("/peng")) {
		response.writeHead(200);
		response.write('<html><head></head><body><iframe src="https://giphy.com/embed/VkMV9TldsPd28" frameBorder="0" ></iframe></body>');
		response.end();
	}
}

// Sends the template with HTML and JS to view a particular counter.
// Counter updates will call socketServer.emit to send the new counter value
// which will trigger the page to update.
function serveCounterBrowserSource(queryString, response) {
	var counterName = getCounterName(queryString.match(/[a-zA-Z0-9_-]*$/)[0]);
	console.log(`Counter is "${counterName}"`);
	var counterValue = counterRead(counterName);

	var content="";
	if (fs.existsSync(`html/counter_${counterName}_template.html`)) {
		content = fs.readFileSync(`html/counter_${counterName}_template.html`, 'UTF-8');
	} else {
		content = fs.readFileSync(`html/counter_template.html`, 'UTF-8');
	}
	content = content.replace(/COUNTER_NAME/g, counterName).replace(/COUNTER_VALUE/g, counterValue);
	response.writeHead(200);
	response.write(content);
	response.end();
}

// Sends the template with HTML and JS to play media, but without the audio tag
// serveAudio() will call socketServer.emit to send the audio tag for playing the media
// and stream the audio file to the client.
function serveMediaBrowserSource(queryString, response) {
	var content="";
	content = fs.readFileSync(`html/media_template.html`, 'UTF-8');
	response.writeHead(200);
	response.write(content);
	response.end();
}

// Triggers the browser source to build an audio tag, which will request the audio
function updateMediaBrowserWithAudio(baseFileName) {
	socketServer.emit(`play_audio`, baseFileName );
}

function serveAudio(queryString, response) {
	let filePath = getAudioFilePath(queryString);
	if(filePath) {
		let fileStat = fs.statSync(filePath);
		// set response header info
		response.writeHead(200, {
			'Content-Type': 'audio/mpeg',
			'Content-Length': fileStat.size
		});
		//create read stream
		const readStream = fs.createReadStream(filePath);
		// attach this stream with response stream
		readStream.pipe(response);
	}

}


//--------------------- Helper Methods

function greetUser(target, user, commandName) {
	if ("GREETINGS" in env && isFeatureEnabled("greetings")) {
		let greeting = "";

		// Find and format greeting text
		if (user && user.username.toLowerCase() in env[cGREETINGS] && cCHAT in env[cGREETINGS][user.username.toLowerCase()]) {
			greeting = env[cGREETINGS][user.username.toLowerCase()][cCHAT];
		} else if (user.mod && cDEFAULT_MOD in env[cGREETINGS] && cCHAT in env[cGREETINGS][cDEFAULT_MOD]) {
			greeting = env[cGREETINGS][cDEFAULT_MOD][cCHAT];
		} else if (user.vip && cDEFAULT_VIP in env[cGREETINGS] && cCHAT in env[cGREETINGS][cDEFAULT_VIP]) {
			greeting = env[cGREETINGS][cDEFAULT_VIP][cCHAT];
		} else if (user.firstTimeChatter && cFIRST_TIME_CHATTER in env[cGREETINGS] && cCHAT in env[cGREETINGS][cFIRST_TIME_CHATTER]) {
			greeting = env[cGREETINGS][cFIRST_TIME_CHATTER][cCHAT];
		} else if (cCHAT in env[cGREETINGS][cDEFAULT]) {
			greeting = env[cGREETINGS][cDEFAULT][cCHAT];
		}
		sendChat(target, user, greeting);

		// Find and play media
		greeting = "";
		if (env[cGREETINGS][user.username.toLowerCase()] && env[cGREETINGS][user.username.toLowerCase()][cMEDIA]) {
			greeting = env[cGREETINGS][user.username.toLowerCase()][cMEDIA];
		} else if (user.mod && env[cGREETINGS][cDEFAULT_MOD][cMEDIA]) {
			greeting = env[cGREETINGS][cDEFAULT_MOD][cMEDIA];
		} else if (user.vip && GREETINGS[cDEFAULT_VIP][cMEDIA]) {
			greeting = env[cGREETINGS][cDEFAULT_VIP][cMEDIA];
		} else if (user.firstTimeChatter && cFIRST_TIME_CHATTER in env[cGREETINGS] && cMEDIA in env[cGREETINGS][cFIRST_TIME_CHATTER]) {
			greeting = env[cGREETINGS][cFIRST_TIME_CHATTER][cMEDIA];
		} else if (env[cGREETINGS][cDEFAULT][cMEDIA]) {
			greeting = env[cGREETINGS][cDEFAULT][cMEDIA];
		}
		playMedia(target, user, greeting);

		// Shout out the user.  Does not do the shouting out itself but runs your shoutout command.
		// We want to delay this a bit so it doesn't clash with any media playing
		if (user.username.toLowerCase() in env[cGREETINGS] && cSHOUTOUT in env[cGREETINGS][user.username.toLowerCase()]) {
			sendShoutOut(target, user, env[cGREETINGS][user.username.toLowerCase()][cSHOUTOUT]);
		}
	}
}


// Send a message to chat.
// USERNAME will be replaced by the username
// replacements is an array of values to insert into the string replacing _1_, _2_, _3_, .etc
// If message is an array, one will be chosen at random.
function sendChat(target, user, message, replacements) {
	if (target && message && message.length > 0) {
		let reply;
		if (Array.isArray(message)) {
			var num = Math.floor(Math.random() * message.length);
			reply = message[num];
		} else {
			reply = message;
		}

		// Replace username
		if (user && user.username) {
			reply = reply.replace(cUSERNAME, user.username)
		}

		// replace the positional parameters
		if (replacements) {
			for (let index = 1; index <= 9 && replacements[index]; index++) {
				reply = reply.replace(`_${index}_`, replacements[index]);
			}
		}

		client.say(target, reply);
	}
}

// Shout out a user.The shoutoutCommand should contain USERNAME for sendChat to replace with the username
function sendShoutOut(target, user, shoutOutCommand, replacements) {
	setTimeout(() => {
		sendChat(target, user, shoutOutCommand, replacements);
	}, 5000, target, user, shoutOutCommand, replacements);
}

// Play a media file.
// USERNAME will be replaced by the username for per-username sounds
// replacements is an array of values to insert into the string replacing _1_, _2_, _3_, .etc
// If media is an array, one will be chosen at random.
function playMedia(target, user, media, replacements) {
	if (media && media.length > 0) {
		let file;
		if (Array.isArray(media)) {
			var num = Math.floor(Math.random() * media.length);
			file = media[num];
		} else {
			file = media;
		}
		// Replace username
		if (user && user.username) {
			file = file.replace(cUSERNAME, user.username)
		}

		// replace the positional parameters
		if (replacements) {
			for (let index = 1; index <= 9 && replacements[index]; index++) {
				file = file.replace(`_${file}_`, replacements[index]);
			}
		}

		// If Media browser source is enabled, then use that, else play using external media player
		if(env[cWEB_SERVER] && env[cWEB_SERVER][cAUDIO_FILE_PATH]) {
			updateMediaBrowserWithAudio(getAudioFileName(file));
		} else if(env[cMEDIA_PLAYER_COMMAND]) {
			let command = env[cMEDIA_PLAYER_COMMAND].replace(cMEDIAFILE, file);

			exec(command, (error, stdout, stderr) => {
				if (error) {
					console.log(`error: ${error.message}`);
					return;
				}
				if (stderr) {
					console.log(`stderr: ${stderr}`);
					return;
				}
				console.log(`stdout: ${stdout}`);
			});
		} else {
			console.log("ERROR: Neither MEDIA_PLAYER_COMMAND or WEB_SERVER[cAUDIO_FILE_PATH]. Can't play audio.");
		}


	}
}


// Is the user a first time ever chatter? Check/update file
function isFirstTimeChatter(username) {
	try {
		// We need to lowercase names for comparison
		username = username.toLowerCase();
		// Initialze allChatters here to simplify the logic if the file doesn't exist
		let allChatters = "";

		if (fs.existsSync(allChattersFile)) {
			// read contents of the allChatters file
			allChatters = fs.readFileSync(allChattersFile, 'UTF-8');
			if (allChatters.includes(username)) {
				return false;
			}
		}
		// If we're here, then either the file doesn't exist, or doesn't contain the user.  Add them.
		fs.appendFileSync(allChattersFile, `${username}\n`);
		return true;

	} catch (err) {
		console.error(err);
	}
}

// Return a random line from a file
function readRandomLine(fileName) {
	try {
		// read contents of the file
		let data = fs.readFileSync(fileName, 'UTF-8');
		// split the contents by new line
		let lines = data.split(/\r?\n/);
		// Read a random line
		let lineNumber = Math.floor(Math.random() * lines.length);
		let text = lines[lineNumber];
		console.log(`readRandomLine: Line number is ${lineNumber} of ${lines.length}, text is '${text}'`);
		return text;

	} catch (err) {
		console.error(err);
	}
}

function isFeatureEnabled(command) {
	return (cFEATURE_FLAGS in env && command in env[cCOMMANDS_FEATURE_FLAGS] && env[cCOMMANDS_FEATURE_FLAGS][command] === "true")
}

function enableFeature(command) {
	env[cCOMMANDS_FEATURE_FLAGS][command] = "true";
}

function disableFeature(command) {
	env[cCOMMANDS_FEATURE_FLAGS][command] = "false";
}

// Load or reload the config file
function loadConfigFile() {
	delete require.cache[require.resolve(configFile)];
	try {
		let envNew = require(configFile);
		console.log(`config file '${configFile}' loaded`);
		if (envNew && Object.keys(envNew).length > 0) {
			env = envNew;
		}

		runPeriodicMessages();
	} catch (err) {
		console.log(`Error loading configuration file: ${err}`);

		// If this is the first load, then exit.  Otherwise warn in chat and just don't update env
		if (channel && client) {
			client.say(channel, `Could not load configuration file, continuing with existing configuration.`);
		} else {
			exit(1);
		}
	}
}

// Counters
function counterInc(target, user, commandName, args) {
	let counterName = getCounterName(args[0].substring(2));
	let offset = Number(args[2]);
	if (isNaN(Number(offset))) {
		offset = 1;
	}
	let counterValue = counterRead(counterName) + offset;
	counterWrite(counterName, counterValue);
	counterSay(target, user, counterName, counterValue);
}


function counterDec(target, user, commandName, args) {
	let counterName = getCounterName(args[0].substring(2));
	let offset = Number(args[2]);
	if (isNaN(Number(offset))) {
		offset = 1;
	}
	let counterValue = Math.max(counterRead(counterName) - offset, 0);
	counterWrite(counterName, counterValue);
	counterSay(target, user, counterName, counterValue);
}

function counterSet(target, user, commandName, args) {
	let counterName = getCounterName(args[0].substring(2));
	let counterValue = Number(args[2]);
	if (isNaN(Number(counterValue))) {
		counterValue = 0;
	}
	counterWrite(counterName, counterValue);
	counterSay(target, user, counterName, counterValue);
}

function counterQuery(target, user, commandName, args) {
	let counterName = getCounterName(args[0].substring(2));
	let counterValue = counterRead(counterName);
	counterSay(target, user, counterName, counterValue);
}

function counterSay(target, user, counterName, counterValue) {
	client.say(target, `Counter ${counterName} is currently ${counterValue}`);
}

function counterRead(counterName) {
	let currentValue = 0;
	let counterFile = `data/counter_${counterName}.txt`;

	if (fs.existsSync(counterFile)) {
		// read contents of the allChatters file
		currentValue = Number(fs.readFileSync(counterFile, 'UTF-8'));
	}
	return currentValue;
}

function counterWrite(counterName, counterValue) {
	let counterFile = `data/counter_${counterName}.txt`;
	fs.writeFileSync(counterFile, counterValue.toString(), 'UTF-8');

	// Update any browser sources with the new number
	console.log(`Socket server sending ${counterValue} to counter_${counterName}_update`);
	if (isFeatureEnabled("webserver")) {
		socketServer.emit(`counter_${counterName}_update`, counterValue );
	}
}

function getCounterName(counterName) {
	counterName = counterName.replace(/[^a-zA-Z0-9_-]/g,"");
	return counterName;
}

function getAudioFileName(baseFileName) {
	return baseFileName.replace(/[/]*audio[/]*/,"").replace(/.*[/]/,"").replace(/[^.aaa-zA-Z0-9_-]/g,"");
}

// Take out the /audio/ part and ensure the baseFileName doesn't have any illegal characters
// or paths that could lead to reading other directories or other shenanigans
// Make sure the file exists
function getAudioFilePath(baseFileName) {
	if(env[cWEB_SERVER] && env[cWEB_SERVER][cAUDIO_FILE_PATH]) {
		baseFileName = getAudioFileName(baseFileName);
		let fullPath = `${env[cWEB_SERVER][cAUDIO_FILE_PATH]}/${baseFileName}`;
		if(fs.existsSync(fullPath)) {
			return fullPath;
		} else {
			console.log(`ERROR: audio file '${fullPath}' does not exist, cannot play audio`);
		}
	} else {
		console.log(`ERROR: WEB_SERVER or WEB_SERVER[cAUDIO_FILE_PATH] not defined, cannot play audio`);
	}
	return("");
}