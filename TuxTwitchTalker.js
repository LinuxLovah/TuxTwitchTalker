// https://dev.twitch.tv/docs/irc

const tmi = require('tmi.js');
const env = require('./linux_lovah_config.json');

var seenUsers = [];

// Define configuration options
const opts = {
	identity: {
		username: env.BOT_NAME,
		password: env.TMI_OAUTH
	},
	channels: env.CHANNELS
};


console.log(`-------- LOGGING IN`);
// Create a client with our options
const client = new tmi.client(opts);
console.log(`-------- LOGGED IN`);

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
    if(prime) msg += ' using Prime';
    else if(plan !== '1000') msg += ' at ${tierList[plan]}';
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



// Called every time a message comes in
function onMessageHandler(target, user, msg, self) {
	if (env.IGNORE_USERS.includes(user.username)) {
		console.log(`Ignoring message '${msg}' from '${user.username}'`);
		return;
	}

	console.log(`Got '${msg}' from '${user.username}'`);

	// Remove whitespace from chat message
	const commandName = msg.trim();

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
			console.log(`Executed ${commandName} command`);
		} else {
			console.log(`Unknown command '${commandName}' from '${user.username}'`);
		}
	} else {
		// Not a command

		// Is this a new user?
		greetNewUsers(target, user);

	}
}

// Greet new users
function greetNewUsers(target, user) {
	// Don't greet the broadcaster, he doesn't like talking to themself
	if (user.badges && user.badges.broadcaster) {
		return;
	}

	if (!seenUsers.includes(user.username)) {
		seenUsers.push(user.username);
		console.log(`New user '${user.username}'`);
		var reply;
		if (user.mod) {
			reply = env.NEW_MOD_GREETING.replace('USERNAME', user.username);
		} else {
			reply = env.NEW_USER_GREETING.replace('USERNAME', user.username);
		}
		client.say(target, reply);
	}
}

// Function called when the "dice" command is issued
function rollDice() {
	const sides = 6;
	return Math.floor(Math.random() * sides) + 1;
}

// Called every time the bot connects to Twitch chat
function onConnectedHandler(addr, port) {
	console.log(`Connected to ${addr}:${port}`);
}

