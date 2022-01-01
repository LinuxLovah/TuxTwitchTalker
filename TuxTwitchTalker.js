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
var counters = {};

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
		console.log(`Posting periodic message ${message["TITLE"]} every ${message["INTERVAL"]}`);
		client.say(channel, message["TEXT"]);
	  },message["INTERVAL"] * 60000); // milliseconds = minutes * 60 * 1000


}

//--------------------- Browser Source web server
if(isFeatureEnabled("webserver")) {
	http.createServer(onWebRequest).listen(8888);
	console.log('Web server has started listing on 8888');
}

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
	let args = commandName.split(/(\s+)/)

	// If we haven't seen this user before, greet them
	runFirstSeen(target, user, commandName, args);

	// If the command is known, let's execute it
	// Admin commands begin with !!
	if (commandName.slice(0, 2) === "!!") {
		runAdminCommand(target, user, commandName, args);
	} else if (commandName.slice(0, 1) === "!") {
		runUserCommand(target, user, commandName, args);
	} else {
		// Is it a command triggered by a regular expression in chat
		runTriggeredCommand(target, user, commandName, args);
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


function runUserCommand(target, user, commandName, args) {
	if (commandName === '!dice') {
		runRollDice(target, user, commandName);
	} else if(commandName.startsWith("!timer ") && isFeatureEnabled("timer")) {
		runTimer(target, user, commandName, args);
	} else if(commandName.startsWith("!+") && isFeatureEnabled("counter")) {
		counterInc(target, user, commandName, args);
	} else if(commandName.startsWith("!-") && isFeatureEnabled("counter")) {
		counterDec(target, user, commandName, args);
	} else if(commandName.startsWith("!=") && isFeatureEnabled("counter")) {
		counterSet(target, user, commandName, args);
	} else if(commandName.startsWith("!?") && isFeatureEnabled("counter")) {
		counterGet(target, user, commandName, args);
	}

	// Is this a response command, that spits out canned text from the config?
	runResponseCommands(target, user, commandName);

	// Is this a command to return a random line from a a file defined in RANDOM_FILE_LINE_COMMANDS?
	runRandomFileLineCommands(target, user, commandName);
}

function runTriggeredCommand(target, user, message, args) {
	for(const trigger in env.TRIGGERED_MESSAGES) {
		let regex = new RegExp(trigger);
		if(message.match(regex) && trigger in env.TRIGGERED_MESSAGES) {
			console.log(`Found message matching ${regex}`)
			if("CHAT" in env.TRIGGERED_MESSAGES[trigger]) {
				let reply = env.TRIGGERED_MESSAGES[trigger]["CHAT"].replace("USERNAME", user.username);
				sendChat(target, user, reply);
			}
			if("MEDIA" in env.TRIGGERED_MESSAGES[trigger]) {
				let mediaFile = env.TRIGGERED_MESSAGES[trigger]["MEDIA"].replace("USERNAME", user.username);
				playMedia(target, user, mediaFile);
			}
		}
	}
}


// Greet viewers the first time we see them in chat
function runFirstSeen(target, user, commandName, args) {
	// Don't greet the broadcaster, he doesn't like talking to themself
	if ("badges" in user && "broadcaster" in user.badges) {
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
	if (isFeatureEnabled("dice")) {
		const sides = 6;
		var num = Math.floor(Math.random() * sides) + 1;
		client.say(target, `You rolled a ${num}, ${user.username}`);
	}
}

// Some commands are to read a random line from a file.
// These commands will be defined in the RANDOM_FILE_LINE_COMMANDS array in the config file
function runRandomFileLineCommands(target, user, commandName) {
	if (commandName in env.RANDOM_FILE_LINE_COMMANDS) {
		var fileName = env.RANDOM_FILE_LINE_COMMANDS[commandName];
		client.say(target, readRandomLine(fileName));
	}
}

//Commands that send out canned text (with username substitution) from the RESPONSE_COMMANDS array
function runResponseCommands(target, user, commandName) {
	if ("RESPONSE_COMMANDS" in env && commandName in env.RESPONSE_COMMANDS) {
		var reply = env.RESPONSE_COMMANDS[commandName];
		sendChat(target, user, reply);
	}
}

// Start a time, responding as per the TIMER_ALERT entries
function runTimer(target, user, commandName, args) {
	let timerName = "";
	if( (!args[2]) || isNaN(args[2]) ) {
		client.say(target, "Missing or invalid timer length in minutes");
		return;
	}
	let timeout=Number(args[2]) * 60000;

	if(args[4]) {
		timerName = args.slice(4).join("");
	}
	client.say(target, `Starting timer '${timerName}' for ${timeout}ms`);
	setTimeout( (timerName)=> {
		if("TIMER_ALERT" in env) {
			if("CHAT" in env["TIMER_ALERT"]){
				sendChat(target, user, env["TIMER_ALERT"]["CHAT"].replace("TIMERNAME", timerName));
			}
			if("MEDIA" in env["TIMER_ALERT"]) {
				playMedia(target, user, env["TIMER_ALERT"]["MEDIA"].replace("TIMERNAME", timerName), user);
			}
		}
	}, timeout, timerName);

}

function counterInc(target, user, commandName, args) {
	let counterName = args[0].substring(2);
	let offset = Number(args[2]);
	if(isNaN(Number(offset))) {
		offset = 1;
	}
	if(counterName in counters) {
		counters[counterName] += offset;
	} else {
		counters[counterName] = 1;
	}
	counterGet(target, user, commandName, args);
}

function counterDec(target, user, commandName, args) {
	let counterName = args[0].substring(2);
	let offset = Number(args[2]);
	if(isNaN(Number(offset))) {
		offset = 1;
	}
	if(counterName in counters && (counters[counterName] - offset > 0)) {
		counters[counterName] -= offset;
	} else {
		counters[counterName] = 0;
	}
	counterGet(target, user, commandName, args);
}

function counterSet(target, user, commandName, args) {
	let counterName = args[0].substring(2);
	let count = Number(args[2]);
	if(! isNaN(Number(count))) {
		counters[counterName] = count;
	}
	counterGet(target, user, commandName, args);
}

function counterGet(target, user, commandName, args) {
	let counterName = args[0].substring(2);
	if(counterName in counters) {
		client.say(target, `Counter ${counterName} is currently ${counters[counterName]}`);
	} else {
		client.say(target, `Counter ${counterName} does not exist`);
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
	if ("GREETINGS" in env) {
		let greeting = "";
		// Find and format greeting text
		if (user.username in env.GREETINGS && "CHAT" in env.GREETINGS[user.username]) {
			greeting = env.GREETINGS[user.username]["CHAT"];
		} else if (user.mod && "default_mod" in env.GREETINGS && "CHAT" in env.GREETINGS["default_mod"]) {
			greeting = env.GREETINGS["default_mod"]["CHAT"];
		} else if (user.vip && "default_vip" in env.GREETINGS && "CHAT" in env.GREETINGS["default_vip"]) {
			greeting = env.GREETINGS["default_vip"]["CHAT"];
		} else if ("CHAT" in env.GREETINGS["default"]) {
			greeting = env.GREETINGS["default"]["CHAT"];
		}
		sendChat(target, user, greeting);

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
		playMedia(target, user, greeting);

		// Shout out the user.  Does not do the shouting out itself but runs your shoutout command.
		// We want to delay this a bit so it doesn't clash with any media playing
		if (user.username in env.GREETINGS && "SHOUTOUT" in env.GREETINGS[user.username]) {
			greeting = env.GREETINGS[user.username]["SHOUTOUT"];
			setTimeout( ()=> {
				sendChat(target, user, greeting);
			}, 5000, target, greeting);
		}
	}
}


// Send a message to chat.
// USERNAME will be replaced by the username
// If message is an array, one will be chosen at random.
function sendChat(target, user, message) {
	if(target && message && message.length > 0) {
		if(Array.isArray(message)) {
			var num = Math.floor(Math.random() * message.length);
			client.say(target, message[num].replace("USERNAME", user.username));
		} else {
			client.say(target, message.replace("USERNAME", user.username));
		}

	}
}


// Play a media file.
// USERNAME will be replaced by the username for per-username sounds
// If media is an array, one will be chosen at random.
function playMedia(target, user, media) {
	if(env.MEDIA_PLAYER_COMMAND && media && media.length > 0) {
		let file;
		if(Array.isArray(media)) {
			var num = Math.floor(Math.random() * media.length);
			file = media[num];
		} else {
			file = media;
		}
		let command = env.MEDIA_PLAYER_COMMAND.replace("MEDIAFILE",file).replace("USERNAME", user.username);

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
	return ("COMMANDS_FEATURE_FLAGS" in env && command in env.COMMANDS_FEATURE_FLAGS && env.COMMANDS_FEATURE_FLAGS[command] === "true")
}
