// https://dev.twitch.tv/docs/irc

const tmi = require('tmi.js');
const fs = require('fs');
var audioPlayer = require('play-sound')()


// First parameter is the config file to load
const configFile = process.argv[2];
console.log(`config file '${configFile}'`);
if (!configFile || configFile.length === 0) {
	console.log(`No config file specified, exiting`);
	process.exit(1);
}
const env = require(configFile);

var seenUsers = [];

// Define configuration options
const opts = {
	identity: {
		username: env.BOT_NAME,
		password: env.TMI_OAUTH
	},
	channels: env.CHANNELS
};

// Create a client with our options
const client = new tmi.client(opts);

// Register our event handlers (defined below)
// https://d-fischer.github.io/twitch-chat-client/reference/classes/ChatClient.html
client.on('message', onMessageHandler);
client.on('connected', onConnectedHandler);



client.on('usernotice', (channel, user, message, self) => {
	console.log(`Got a usernotice [${channel}|${user}|${message}]`);
});

client.on('host', (channel, target, viewers) => {
	console.log(`Got a host [${channel}|${target}|${viewers}]`);
});

client.on('raid', (channel, msg) => {
	console.log(`Got a raid [${channel}|${msg}]`);
});

// https://github.com/tmijs/tmi.js/issues/363
const tierList = { 1000: 'Tier 1', 2000: 'Tier 2', 3000: 'Tier 3' };
client.on('resub', (channel, username, months, message, userstate, methods) => {
	const { prime, plan, planName } = methods;
	let msg = `${username} just resubbed`;
	if (prime) msg += ' using Prime';
	else if (plan !== '1000') msg += ' at ${tierList[plan]}';
	client.say(channel, `${msg}!`);
});


// https://twurple.js.org/docs/examples/chat/basic-bot.html
client.on('sub', (channel, user) => {
	console.log(`Thanks to @${user} for subscribing to the channel!`);
});

client.on('resub', (channel, user, subInfo) => {
	console.log(`)Thanks to @${user} for subscribing to the channel for a total of ${subInfo.months} months!`);
});

client.on('subgift', (channel, user, subInfo) => {
	console.log(`Thanks to ${subInfo.gifter} for gifting a subscription to ${user}!`);
});


/*
client.on('chat', (channel, user, message, self) => {
	console.log(`Got a chat [${channel}|${user}|${message}]`);
	});
*/

// Connect to Twitch:
client.connect();

/////////////////////////  Event Handlers


// Called every time the bot connects to Twitch chat
function onConnectedHandler(addr, port) {
	console.log(`Connected to ${addr}:${port}`);
}

// Called every time a message comes in
function onMessageHandler(target, user, msg, self) {
	if (env.IGNORE_USERS.includes(user.username)) {
		// console.log(`Ignoring message '${msg}' from '${user.username}'`);
		return;
	}


	// Remove whitespace from chat message
	let commandName = msg.replace(/[^\x20-\x7E]/g, '').trim();
	console.log(`Got '${commandName}' from '${user.username}' was '${msg}'`);

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
		if (commandName === '!dice') {
			const num = rollDice();
			client.say(target, `You rolled a ${num}`);
		} else if (commandName === '!dadjoke') {
			client.say(target, readRandomLine("dadjokes"));
		} else {
			console.log(`Unknown command '${commandName}' from '${user.username}'`);
		}
	} else {
		// Not a command

		// Is this a new user?
		greetNewUsers(target, user);

	}
}

///////////////////////// Helper methods

// Greet new users
function greetNewUsers(target, user) {
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
			audioPlayer.play(soundFile, function(err){
				if (err) throw err
			  })		}

	}
}

// Function called when the "dice" command is issued
function rollDice() {
	const sides = 6;
	return Math.floor(Math.random() * sides) + 1;
}

// Return a random line from a file
function readRandomLine(dataFile) {
	try {
		// Look up the dataFile name
		fileName = env.DATA_FILES[dataFile];

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


