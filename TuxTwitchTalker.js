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

// Connect to Twitch:
client.connect();


//--------------------- Periodic messages
for(const message of env.PERIODIC_MESSAGES) {
	console.log(`Loading periodic message '${message["TITLE"]}'`);

	setInterval(()=> {
		console.log(`Posting periodic message ${message["TITLE"]} every ${message["INTERVAL"]}`)
		client.say(channel, message["TEXT"])
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
		return;
	}

	// Remove whitespace from chat message
	let commandName = msg.replace(/[^\x20-\x7E]/g, '').trim();

	// If the command is known, let's execute it
	// Admin commands begin with !!
	if (commandName.slice(0, 2) === "!!") {
		runAdminCommand(target, user, commandName);
	} else if (commandName.slice(0, 1) === "!") {
		runUserCommand(target, user, commandName);
	} else {
		// Not a command

		// Is this a new user?
		runFirstSeen(target, user, commandName);

		// Is it a trigger command
		runTriggeredCommand(target, user, commandName);
	}
}

// Greet viewers the first time we see them in chat
function runFirstSeen(target, user, commandName) {
	// Don't greet the broadcaster, he doesn't like talking to themself
	if (user.badges && user.badges.broadcaster) {
		return;
	}

	if (!seenUsers.includes(user.username)) {
		seenUsers.push(user.username);
		console.log(`New user seen '${user.username}'`);
		greetUser(target, user, commandName);
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

function runAdminCommand(target, user, commandName) {
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
			let username = commandName.split(" ")[1];
			user = {
				"username": username
			}
			greetUser(target, user, commandName);
		} else {
			console.log(`Unknown admin command ${commandName}`);
		}
	} else {
		console.log(`Ignoring admin command '${commandName}' from '${user.username}'`);
	}
}


function runUserCommand(target, user, commandName) {
	if (commandName === '!dice') {
		runRollDice(target, user, commandName);
	}

	// Is this a response command, that spits out canned text from the config?
	runResponseCommands(target, user, commandName);

	// Is this a command to return a random line from a a file defined in RANDOM_FILE_LINE_COMMANDS?
	runRandomFileLineCommands(target, user, commandName);
}

function runTriggeredCommand(target, user, message) {
	for(const trigger in env.TRIGGERED_MESSAGES) {
		let regex = new RegExp(trigger);
		if(message.match(regex)) {
			console.log(`Found message matching ${regex}`)
			if(env.TRIGGERED_MESSAGES[trigger]["CHAT"]) {
				let reply = env.TRIGGERED_MESSAGES[trigger]["CHAT"].replace("USERNAME", user.username);
				client.say(target, reply);
			}
			if(env.TRIGGERED_MESSAGES[trigger]["MEDIA"]) {
				let mediaFile = env.TRIGGERED_MESSAGES[trigger]["MEDIA"].replace("USERNAME", user.username);
				playMedia(mediaFile);
			}
		}
	}
}


// Most of the browser source/web server stuff is experimental
// and will be used more in later releases
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
	}
}


//--------------------- Helper Methods

function greetUser(target, user, commandName) {
	if (env.GREETINGS) {
		let greeting = "";
		// Find and format greeting text
		if (env.GREETINGS[user.username] && env.GREETINGS[user.username]["CHAT"]) {
			greeting = env.GREETINGS[user.username]["CHAT"];
		} else if (user.mod && env.GREETINGS["default_mod"]["CHAT"]) {
			greeting = env.GREETINGS["default_mod"]["CHAT"];
		} else if (user.vip && GREETINGS["default_vip"]["CHAT"]) {
			greeting = env.GREETINGS["default_vip"]["CHAT"];
		} else if (env.GREETINGS["default"]["CHAT"]) {
			greeting = env.GREETINGS["default"]["CHAT"];
		}

		if (greeting && greeting.length > 0) {
			greeting = greeting.replace("USERNAME", user.username);
			client.say(target, greeting);
		}

		// Find and play media
		greeting = "";
		if (env.GREETINGS[user.username] && env.GREETINGS[user.username]["MEDIA"]) {
			greeting = env.GREETINGS[user.username]["MEDIA"];
		} else if (user.mod && env.GREETINGS["default_mod"]["MEDIA"]) {
			greeting = env.GREETINGS["default_mod"]["MEDIA"];
		} else if (user.vip && GREETINGS["default_vip"]["MEDIA"]) {
			greeting = env.GREETINGS["default_vip"]["MEDIA"];
		} else if (env.GREETINGS["default"]["MEDIA"]) {
			greeting = env.GREETINGS["default"]["MEDIA"];
		}

		if (greeting && greeting.length > 0) {
			greeting = greeting.replace("USERNAME", user.username);
			playMedia(greeting);
		}
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
