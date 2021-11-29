/**
 * TuxTwitchTalker: A bot to interact with Twitch Chat.
 * See https://github.com/LinuxLovah/TuxTwitchTalker
 *
 * Parts of this program were modeled on:
 * 		https://dev.twitch.tv/docs/irc
 * 		https://d-fischer.github.io/twitch-chat-client/reference/classes/ChatClient.html
 * 		https://github.com/tmijs/tmi.js/issues/363
 * 		https://twurple.js.org/docs/examples/chat/basic-bot.html
 */



//--------------------- Load dependency objects
const tmi = require('tmi.js');
const path = require('path');
const fs = require('fs');
const { exec } = require("child_process");
//const audioPlayer = require('play-sound')()

//--------------------- Global variables
var seenUsers = [];

//--------------------- Config
// First parameter is the config file to load
// Default is "./config.json"
var configFile = process.argv[2];
if(! configFile || configFile.length === 0) {
	configFile = "./config.json";
}
if (! configFile || configFile.length === 0) {
	console.log(`No config file specified. Exiting.`);
	process.exit(1);
} else if(! fs.existsSync(configFile)) {
	console.log(`Config file '${configFile}' does not exist.  Exiting.`);
	process.exit(1);
}
const env = require(configFile);
console.log(`config file '${configFile}'`);

//--------------------- Connect and register handlers
// Define tmi configuration options
const opts = {
	identity: {
		username: env.BOT_NAME,
		password: env.TMI_OAUTH
	},
	channels: env.CHANNELS
};

const client = new tmi.client(opts);

client.on('connected', onConnectedHandler);
client.on('message', onMessageHandler);


// UNTESTED
client.on('usernotice', (channel, user, message, self) => {
	console.log(`Got a usernotice [${channel}|${user}|${message}]`);
});

// UNTESTED
client.on('host', (channel, target, viewers) => {
	console.log(`Got a host [${channel}|${target}|${viewers}]`);
});

// UNTESTED
client.on('raid', (channel, msg) => {
	console.log(`Got a raid [${channel}|${msg}]`);
});

// UNTESTED
const tierList = { 1000: 'Tier 1', 2000: 'Tier 2', 3000: 'Tier 3' };
client.on('resub', (channel, username, months, message, userstate, methods) => {
	const { prime, plan, planName } = methods;
	let msg = `${username} just resubbed`;
	if (prime) msg += ' using Prime';
	else if (plan !== '1000') msg += ' at ${tierList[plan]}';
	client.say(channel, `${msg}!`);
});

// UNTESTED
client.on('sub', (channel, user) => {
	console.log(`Thanks to @${user} for subscribing to the channel!`);
});

// UNTESTED
client.on('resub', (channel, user, subInfo) => {
	console.log(`)Thanks to @${user} for subscribing to the channel for a total of ${subInfo.months} months!`);
});

// UNTESTED
client.on('subgift', (channel, user, subInfo) => {
	console.log(`Thanks to ${subInfo.gifter} for gifting a subscription to ${user}!`);
});

/*
What is the difference between onChat and onMessage?
client.on('chat', (channel, user, message, self) => {
	console.log(`Got a chat [${channel}|${user}|${message}]`);
	});
*/

// Connect to Twitch:
client.connect();


//--------------------- Event Handlers

// Called every time the bot connects to Twitch chat
function onConnectedHandler(addr, port) {
	console.log(`Connected to ${addr}:${port}`);
}

// Called every time a message comes in
function onMessageHandler(target, user, msg) {
	if (env.IGNORE_USERS.includes(user.username)) {
		console.log(`Ignoring message '${msg}' from '${user.username}'`);
		return;
	}

	// Remove whitespace from chat message
	let commandName = msg.replace(/[^\x20-\x7E]/g, '').trim();
	console.log(`Got '${commandName}' from '${user.username}'`);

	// If the command is known, let's execute it
	// Admin commands begin with !!
	if (commandName.slice(0, 2) === "!!") {
		if (env.ADMIN_USERS.includes(user.username)) {
			if (commandName === '!!clearseen') {
				seenUsers = [];
				console.log(`Cleared seen users list`);
			} else {
				console.log(`Unknown admin command ${commandName}`);
			}
		} else {
			console.log(`Ignoring admin command '${commandName}' from '${user.username}'`);
		}
	} else if (commandName.slice(0, 1) === "!") {
		// Non-admin commands
		if (commandName === '!dice') {
			runRollDice(target, user, commandName);
		}

		// Is this a response command, that spits out canned text from the config?
		runResponseCommands(target, user, commandName);

		// Is this a command to return a random line from a a file defined in RANDOM_FILE_LINE_COMMANDS?
		runRandomFileLineCommands(target, user, commandName);
	} else {
		// Not a command

		// Is this a new user?
		runFirstSeen(target, user, commandName);



	}
}

// Greet viewers the first time we see them in chat
function runFirstSeen(target, user, commandName) {
	// Don't greet the broadcaster, he doesn't like talking to themself
	//if (user.badges && user.badges.broadcaster) {
	//	return;
	//}

	if (!seenUsers.includes(user.username)) {
		seenUsers.push(user.username);
		console.log(`New user '${user.username}'`);

		// Chat reply
		var reply = "";
		if (env.CHAT_GREETINGS) {
			// Find and format greeting text
			if (env.CHAT_GREETINGS[user.username]) {
				reply = env.CHAT_GREETINGS[user.username]
			} else if (user.mod && env.CHAT_GREETINGS['default_mod']) {
				reply = env.CHAT_GREETINGS['default_mod'];
			} else if (env.CHAT_GREETINGS['default']) {
				reply = env.CHAT_GREETINGS['default'];
			}

			if (reply && reply.length > 0) {
				reply = reply.replace('USERNAME', user.username);
				client.say(target, reply);
			}
		}

		// Audio reply
		var soundFile = "";
		if (env.AUDIO_GREETINGS[user.username]) {
			soundFile = env.AUDIO_GREETINGS[user.username]
		} else if (user.mod && env.AUDIO_GREETINGS['default_mod']) {
			soundFile = env.AUDIO_GREETINGS['default_mod'];
		} else if (env.AUDIO_GREETINGS['default']) {
			soundFile = env.AUDIO_GREETINGS['default'];
		}

		if (soundFile && soundFile.length > 0) {
			playMedia(soundFile);
		}

	}
}

// Function called when the "dice" command is issued
function runRollDice(target, user, commandName) {
	if (isCommandEnabled("!dice")) {
		const sides = 6;
		var num = Math.floor(Math.random() * sides) + 1;
		client.say(target, `You rolled a ${num}, ${user.username}`);
	}
}

// Some commands are to read a random line from a file.
// These commands will be defined in the RANDOM_FILE_LINE_COMMANDS array in the config file
function runRandomFileLineCommands(target, user, commandName) {
	if (env.RANDOM_FILE_LINE_COMMANDS[commandName]) {
		var fileName = env.RANDOM_FILE_LINE_COMMANDS[commandName];
		client.say(target, readRandomLine(fileName));
	}
}

//Commands that send out canned text (with username substitution) from the RESPONSE_COMMANDS array
function runResponseCommands(target, user, commandName) {
	if (env.RESPONSE_COMMANDS && env.RESPONSE_COMMANDS[commandName]) {
		var reply = env.RESPONSE_COMMANDS[commandName].replace('USERNAME', user.username);
		client.say(target, reply);
	}
}


//--------------------- Helper Methods

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

function isCommandEnabled(command) {
	return (env.COMMANDS_FEATURE_FLAGS[command] && env.COMMANDS_FEATURE_FLAGS[command] === "true")
}

function playMedia(mediaFile) {
	if(env.MEDIA_PLAYER_COMMAND) {
		let command = env.MEDIA_PLAYER_COMMAND.replace("MEDIAFILE",mediaFile);

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


	}
}
