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
const { exit } = require('process');
const http = require('http');
const url = require('url');

//--------------------- Global variables
var seenUsers = [];
var browserSourceAlertContent = "";

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
const channel = env.CHANNELS[0];

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

//--------------------- Periodic messages
for(const message of env.PERIODIC_MESSAGES) {
	console.log(`Loading periodic message '${message["TITLE"]}'`);

	setInterval(()=> {
		client.say(channel, message["TEXT"]);
	  },message["INTERVAL"] * 60000); // milliseconds = minutes * 60 * 1000


}

//--------------------- Browser Source web server

http.createServer(onWebRequest).listen(8888);
console.log('Web server has started listing on 8888');

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
			if (commandName === '!!clearSeen') {
				seenUsers = [];
				console.log(`Seen list is now ${seenUsers}`);
			} else if (commandName.startsWith("!!delSeen ")) {
				user = commandName.split(" ")[1];
				for( var i = 0; i < seenUsers.length; i++){
					if ( seenUsers[i] === user) {
						seenUsers.splice(i, 1);
					}
				}
				console.log(`Seen list is now ${seenUsers}`);
			} else if (commandName.startsWith("!!addSeen ")) {
				user = commandName.split(" ")[1];
				seenUsers.push(user);
				console.log(`Seen list is now ${seenUsers}`);
			} else if (commandName.startsWith("!!testGreeting ")) {
				user = commandName.split(" ")[1];
				testGreeting(target, user, commandName);
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
		browserSourceAlertContent = commandName;
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

// Test the chat and media greeting of a user
function testGreeting(target, user, commandName) {
	if(env.CHAT_GREETINGS[user]) {
		message = env.CHAT_GREETINGS[user].replace('USERNAME', user);
		console.log(`User greeting '${user}':'${message}'`);
	}
	if(env.AUDIO_GREETINGS[user]) {
		mediaFile = env.AUDIO_GREETINGS[user]
		console.log(`User media '${user}':'${mediaFile}'`);
		playMedia(mediaFile);
	}

}

function onWebRequest(request, response) {
	const querystring=request.url;
	console.log(`Web request: ${querystring}`);

	if(querystring.startsWith("/lastSeen")) {
		response.writeHead(200);
		response.write(`${seenUsers}`);
		response.end();
	} else if(querystring.startsWith("/alert")) {
		response.writeHead(200);
		response.write(`${browserSourceAlertContent}`);
		response.end();
	} else if(querystring.startsWith("/peng")) {
		response.writeHead(200);
		response.write('<html><head></head><body><iframe src="https://giphy.com/embed/VkMV9TldsPd28" width="480" height="270" frameBorder="0" class="giphy-embed" allowFullScreen></iframe><p><a href="https://giphy.com/gifs/penguin-business-VkMV9TldsPd28"></a></p></body>');
		response.end();
	} else if(querystring.startsWith("/pr0n")) {
		response.writeHead(200);
		response.write('<html><body><video id="example_video_1" class="video-js vjs-default-skin" width="640" height="264" src="file://videos/__Envy_Anne-_3.75_OF_-_Good_girl_does_what_she_s_told-1440870490696916995.mp4" type="video/mp4" /></video></body>');
		//file:///tmp/__Envy_Anne-_3.75_OF_-_Good_girl_does_what_she_s_told-1440870490696916995.mp4"></iframe>');
		response.end();
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
