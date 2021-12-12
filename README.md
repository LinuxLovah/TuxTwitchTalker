TuxTwitchTalker
===

Introduction
---
TuxTwitchTalker is a chat bot to connect to a Twitch channel and add functionality, respond to events, etc.  All of the functionality released so far are independent of the streaming software you use, as it only connects to Twitch (that may change in the future).

Some of the features (like playing sounds in response to events) are only effective if running on the streaming computer, but most could run on any computer, since most of the functionality is interacting with chat.

TuxTwitchTalker is written on NodeJS, and should work on pretty much any operating system and the slowest of computers.  It uses the [tmi Twitch library](https://tmijs.com/) to interact with chat.  The software is designed so that its configuration drives all its functionality, so streamers should not have to change the code at all to customize the advertised features to their stream.

A part of my motivation to create TuxTwitchTalker was to help myself and others move away from tools that are offered by companies we would rather not be associated with.  It's no coincidence that the first release of this bot is shortly after Streamlabs (no, I'm not going to link to their website) made several marketing blunders exposing just how much of their IP they copied from other companies, many of which were not treated well.


Features, already implemented
---
* When a viewer types in chat for the first time since TuxTwitchTalker was started, they can be greeted with text sent to chat/sound file.
  * Individual regulars can have a special greeting/sound play for them
  * Mods can have a separate greeting/sound play for them
  * There can also be a default greeting/sound for those without specific greetings.
  * Greetings can have the new viewer's username inserted in the message.
* "Response commands" are commands that the bot replies to with a canned message (can be used for listing alerts, social links, etc.).
  * messages can have the sender's username inserted in the message.
* Periodic messages are text that gets sent to chat at a fixed rate.  This is often used for things like social links, channel rules, etc.
* Administrative commands that can only be executed by specific users
  * **!!clearSeen**: Clears the list of seen users, so everyone will be greeted again when they next chat.
  *  **!!delSeen USERNAME**: Remove USERNAME from the seen list (specify a real username)
  *  **!!addSeen USERNAME**: Adds USERNAME to the seen list (specify a real username)
  *  **!!testGreeting USERNAME**: Tests the chat and media greetings for USERNAME to verify they are configured right (specify a real username)
* User commands can be run by everyone.  All user commands can be turned on and off in the configuration.
  * **!dice**: Rolls a dice and replies in chat with the number (1-6) rolled.


Features, planned
---
* Greeting/sound when chat matches a regular expression
* Greeting/sound on raid
* Greeting/sound on host
* Greeting/sound on follow
* Greeting/sound on sub/resub
* Greeting/sound on gift sub
* Identify VIP users (if possible) as I do moderators
* Automatic shout-outs for a set list of users


Features, long term
---
* A way to alert with video in addition to sounds and chat messages
* A way to replace Streamlabs Labels to update files with latest follower, latest sub, etc.
* Multi-tenant redesign so that one instance of TuxTwitchTalker can respond to the chat for multiple streamers, each with their separate configuration.
* Browser source to push visual content to broadcasting software

My goal is to get most of these features implemented by the end of 2021.


Licensing
---
TuxTwitchTalker is released under the [Apache 2.0 licence ](https://www.apache.org/licenses/LICENSE-2.0).  A simplified explanation of this license [from Wikipedia](https://en.wikipedia.org/wiki/Apache_License) is:
> The Apache License is a permissive free software license written by the Apache Software Foundation (ASF).[5] It allows users to use the software for any purpose, to distribute it, to modify it, and to distribute modified versions of the software under the terms of the license, without concern for royalties.

In essence, anyone can use TuxTwitchTalker, but I don't want a company (like Streamlabs) to take it and sell it as a commercial product.


Installation
---
To take full advantage of TuxTwitchTalker's features, it should be installed on your streaming computer.  You can install it on any computer, but some functionality, like playing sounds over stream, won't be sent to your broadcast.

1. [Install NodeJS](https://nodejs.org/en/download/) as per their directions for your platform.
2. Clone [my repository](https://github.com/LinuxLovah/TuxTwitchTalker) or download and expand the contents into some directory.
3. Run **npm install** in the project directory to install all the NodeJS modules the project depends on.


Configuration
---
TuxTwitchTalker is configured using [a JSON file](https://en.wikipedia.org/wiki/JSON), which allows complex expressions and lists to flexibly customize it.  The default configuration file is **config.json**.  You can specify a different filename for the config file as the first parameter to the command
> node TuxTwitchTalker.js my_other_config_file.json

There is a sample configuration file called **sample_config.json**.  It's important to note that JSON file doesn't support comments, so the documentation is included as JSON format as lines starting with **"COMMENT"**.
1. Copy **sample_config.json** to **config.json**
2. Edit config.json in your favorite text editor.  Do not use Word, or Wordpad, or any other word processing program that will change characters to non-ASCII characters.
3. TuxTwitchTalker can log in with your personal username, or you can create a new twitch account for the bot to log into.  Add the username to the config file
4. Generate an OAuth hash at https://twitchapps.com/tmi/ while logged into Twitch as the username the bot will log in as, and add the hash to the config file
5. Follow the directions in the config file to fill in the rest of the file, like users to respond to, etc., making sure to replace all text surrounded in % (percent)


Running TuxTwitchTalker
---
1. Open up a terminal/command window and change to the directory you set up TuxTwitchTalker in
2. type
> npm start

If you need to specify an alternate configuration file, type
> npm start MY_CONFIGURATION_FILE.json


Support/Contact
---
* [LinuxLovah@gmail.com](mailto:LinuxLovah@gmail.com)
* https://twitter.com/LinuxLovahTTV
* I offer support [on my Discord server](https://discord.gg/dJeFM2GpZN) in the **#streaming-tech-talk** channel

Donations
---
I will NEVER charge for this bot. It will always be free open source.  If you would like to donate, though you can paypal here:
<form action="https://www.paypal.com/donate" method="post" target="_top">
<input type="hidden" name="business" value="MYYKAGE7725C4" />
<input type="hidden" name="no_recurring" value="0" />
<input type="hidden" name="currency_code" value="USD" />
<input type="image" src="https://www.paypalobjects.com/en_US/i/btn/btn_donate_SM.gif" border="0" name="submit" title="PayPal - The safer, easier way to pay online!" alt="Donate with PayPal button" />
<img alt="" border="0" src="https://www.paypal.com/en_US/i/scr/pixel.gif" width="1" height="1" />
</form>
