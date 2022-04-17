TuxTwitchTalker
===

# Introduction

TuxTwitchTalker is a chat bot to connect to a Twitch channel and add functionality, respond to events, etc.  All of the functionality released so far are independent of the streaming software you use, as it only connects to Twitch (that may change in the future).

Some of the features (like playing media in response to events) are only effective if running on the streaming computer, but most could run on any computer, since most of the functionality is interacting with chat.

TuxTwitchTalker is written on NodeJS, and should work on pretty much any operating system and the slowest of computers.  It uses the [tmi Twitch library](https://tmijs.com/) to interact with chat.  The software is designed so that its configuration drives all its functionality, so streamers should not have to change the code at all to customize the advertised features to their stream.

A part of my motivation to create TuxTwitchTalker was to help myself and others move away from tools that are offered by companies we would rather not be associated with.  It's no coincidence that the first release of this bot is shortly after Streamlabs (no, I'm not going to link to their website) made several marketing blunders exposing just how much of their IP they copied from other companies, many of which were not treated well.

Most users will not need to change (or even understand) the program itself.  All configuration is done via a [JSON file](https://en.wikipedia.org/wiki/JSON).  It has extensive comments in it to help you customize it for your needs.

This program is, and always will be, free and open source.  See **Licensing** below.

___
# Features, already implemented

## **Greetings**
When a viewer types in chat for the first time since TuxTwitchTalker was started, they can be greeted with text sent to chat/media file.
  * Individual regular viewers can have a special greeting/media play for them
  * Mods can have a separate greeting/media play for them
  * VIPs can have a separate greeting/media play for them
  * First time chatters in the stream (ever) can have a separate greeting/media play for them.  The streamers already seen are stored in the file **data/all_chatters.txt**, so the list persists runs of the program.  You can pre-populate that file with lower case usernames if you wish, but there's no need to add anyone who is already handled by one of the other greeting options (personal/mod/vip/etc).
  * Other streamers can automatically be shouted out (executes the shoutout command, does not shout them out directly)
  * There can also be a default greeting/media for those without specific greetings.
  * Greetings can have the new viewer's username inserted in the message.
  * Multiple greetings can be specified in an array, and one will be picked at random

## **Periodic messages**
Messages sent to chat at a fixed rate.  This is often used for things like social links, channel rules, making up !commands, etc.

## **Triggered messages**
Messages sent to chat when a specific word or phrase is mentioned.  This can be used for thanking subscribers/followers/raiders, responding to a phrase with a media file or message, etc.
   *  The trigger can be a [regular expression](https://www.oreilly.com/content/an-introduction-to-regular-expressions/)
   * messages can have the sender's username inserted in the message.
   * Multiple messages can be specified in an array, and one will be picked at random
   * Any triggered message starting with **!!** can only be used by administrators

## **Forbidden phrases**
When a specific word or phrase is mentioned, the user can be just warned, they can be timed out for a specified number of seconds, or they can be banned.
   *  The trigger can be a [regular expression](https://www.oreilly.com/content/an-introduction-to-regular-expressions/)
   * messages can have the sender's username inserted in the message.
   * Multiple messages can be specified in an array, and one will be picked at random
   * Forbidden phrases can be optionally disabled for mods and VIPs via feature flag

## **Administrative commands**
Administratuve commands can only be executed by specific users you specify in the configuration file.
#### **!!greetingsOff**
Disable greeting feature.  Useful for raids where lots of people start talking in chat at once
#### !!greetingsOn
Enable greeting feature again

#### !!clearSeen
Clears the list of seen users, so they will be greeted again when they next chat.
#### !!delSeen USERNAME
Remove USERNAME from the seen list (specify a real username)
####  !!addSeen USERNAME
Adds USERNAME to the seen list (specify a real username)
####  !!testGreeting USERNAME
Tests the chat and media greetings for USERNAME to verify they are configured right (specify a real username)
####  !!exit
Stops the bot from running.
####  !!reload
Reload the configuration file without restarting the bot. Useful when you make configuration changes mid-stream, like adding a greeting for a user.

## **User commands**
User commands can be run by everyone in chat.  All user commands can be turned on and off in the configuration.

#### Temperature conversion
**!xF** (where x is a number) will print the celsius equivalent in chat, and !xC (where x is a number) will print the fahrenheit equivalent in chat.  For instance, typing **!44F** in chat will print **44F = 6.67C** in chat.

#### !times
This command will print the current time in different time zones in chat.  The time zones it prints are determined by your configuration file.
#### !dice
Rolls a dice and replies in chat with the number (1-6) rolled.  This is mostly a proof of concept, as it was the first command I created.

#### !timer [MINUTES] [TIMERNAME]
Start a timer that will wait the specified number of minutes and then alert when the timer is done, with it's name.  The alert can be a message sent to chat and/or playing a mediafile.
    * **!timer 5 Five minutes of exercise**
    * **!timer 1.5** (Timer for 90 seconds with no name)

#### Counters
Any number of separate counters, identified by a unique word (letters, numbers, underscore, dash only), can be tracked and updated.  The counter commands start with **!+** (increment), **!-** (decrement), **!=** (set), and **!?** (query), IMMEDIATELY followed by the word that identifies that timer (no space in between).  For increment and decrement you can specify an offset.

Values are stored in a file, so they are persisted across runs of the bot.  They do not need to be pre-created.  Arbitrarily-named counters are created by just using the name.

Examples:
* **!+burp**: Increment the burp counter by 1, or set it to 1 if it doesn't exist
* **!+burp 3**: Increment the burp counter by 3, or set it to 3 if it doesn't exist
* **!-deaths**: Decrement the deaths counter by 1, set to zero if it would be negative
* **!-deaths 2**: Decrement the deaths counter by 2, set to zero if it would be negative
* **!=follows 5**: Set the follows counter to 5
* **!?donuts**: Query the donut counter.  It is never high enough.

## Random File Line Commands
Send a random line from a text file to chat when a command is executed.  This can be used for random facts, choosing from a collection of things, pick a random reward from a list, whatever you want.  This is really unique functionality.  Think of it like the magic 8 ball command but you have complete control of the content.

As shipped, the bot is configured with a **!dadjoke** command that will send a random joke from a file to chat.

## **Web server browser sources**
TuxTwitchTaker has a built-in web server that can be used as a browser source in your streaming software (like OBS) to expose information from the bot.  The base browser source functionality was added in version 2.3.0.  I have much more planned to do with this feature now that I have it working, so look for more goodies here.

Each browser source is associated with one or more separate template filess, so the content to send can be changed without modifying the main program at all.

No styling is needed in the template because styling can be specified in the browser source configuration in your streaming software. For instance:

    body { color: rgb(255, 10, 10); background-color: rgba(0, 0, 0, 0); font-size: 40px; margin: 0px auto; overflow: hidden; }

will make the text red and medium sized, transparent background, no margins.


The below documentation assumes TuxTwitchTalker is running on the same computer as your streaming software,and using the default port of **8888**.  If that's not the case then replace **localhost** with the URL of the computer TuxTwitchTalker is running on.  The port can be changed in the configuration file.
### Browser sources

#### **Playing media**
Sound files can be played on the local system by using the media player application defined by the **MEDIA_PLAYER_COMMAND** entry in the config file, or through the media browser source.  If the **AUDIO_FILE_PATH** parameter is defined in the **WEB_SERVER** section, then all media will be played through the browser source instead of the local media player.  All media played through the browser source must come from this directory (which can be relative or absolute) for security reasons, to guarantee no files can be accessed from unintended paths.

The browser source URL for media is **http://localhost:8888/media**, and if using OBS, it's a good idea to select the **Control audio via OBS** option and include that source in all scenes, so you can control the volume separately.  Future versions will allow images and possibly video clips to be sent to the browser source.  The browser source content template is **html/media_template.html**

#### **Counters**
Counters can appear on your stream as a browser source using the URL **http://localhost:8888/counter/COUNTER_NAME_HERE** (eg http://localhost:8888/counter/deaths).  The browser source content template is **html/counter_template.html**, but a counter-specific one will be used if it exists.  The naming convention is html/counter_COUNTER_NAME_template.html (eg html/counter_deaths_template.html) exists.  Using these templates, you can customize how the browser source looks.  The string COUNTER_NAME is replaced with the name of the counter, and the string COUNTER_VALUE is replaced with the current value of that counter.

#### **Timers**
Timers can appear on your stream as a browser source using the URL **http://localhost:8888/timer** (eg http://localhost:8888/timer).   The browser source content template is **html/timer_template.html**.  As currently implemented, it will show the last timer started.  If you have a timer running, and start another timer before the first one finishes, it will display the new timer.  Having separate browser sources or templates for specific timers would be hard since they have arbitrary names that can include spaces, but if there is interest, I will look into redesigning it.


## Feature flags
Many features and commands can be enabled or disabled without changing the code.  See the **COMMANDS_FEATURE_FLAGS** section in the configuration file.


___
# Features, planned

* Greeting/media on raid
* Greeting/media on host
* Greeting/media on follow
* Greeting/media on sub/resub
* Greeting/media on gift sub

### Potential long-term features

* A way to alert with video in addition to media and chat messages
* A way to replace Streamlabs Labels to update files with latest follower, latest sub, etc.
* Multi-tenant redesign so that one instance of TuxTwitchTalker can respond to the chat for multiple streamers, each with their separate configuration.

My goal is to get most of these features implemented by mid-2022.

___
# Licensing

TuxTwitchTalker is released under the [Apache 2.0 licence ](https://www.apache.org/licenses/LICENSE-2.0).  A simplified explanation of this license [from Wikipedia](https://en.wikipedia.org/wiki/Apache_License) is:
> The Apache License is a permissive free software license written by the Apache Software Foundation (ASF).[5] It allows users to use the software for any purpose, to distribute it, to modify it, and to distribute modified versions of the software under the terms of the license, without concern for royalties.

In essence, anyone can use TuxTwitchTalker, but I don't want a company (like Streamlabs) to take it and sell it as a commercial product.  It will ALWAYS be free and open source.  However, I do appreciate attribution/mentions in your About panels or periodic messages in your chat.


![](https://i.imgur.com/raTPBU7.png)

___
# Creating An Account For Your Bot

While not strictly necessary, it's a good idea to make a separate Twitch account for your bot, so you can control its access, and it's less confusing for your viewers when bot messages come from a separate user.

1. Go to https://www.twitch.tv and set up a new separate account.  If you don't want to log out of your current account, open up an incognito window and set up the new account in that.
2. [Register your bot with Twitch](https://dev.twitch.tv/docs/authentication#registration).  Make sure to record the client_id that it returns.  It will be needed for future releases of TuxTwitchTalker.
3. The library I use for chat communications, [tmi.js](https://tmijs.com/), requires an oAuth token that you will need to put in your TuxTwitchTalker configuration file.  In a browser logged in as your bot, go to https://twitchapps.com/tmi/ and it will give you an oAuth token.  Make note of it.
4. Go into Twitch Roles Manager and give your bot the moderator and editor roles.

___
# Installing TuxTwitchTalker

To take full advantage of TuxTwitchTalker's features, it should be installed on your streaming computer.  You can install it on any computer, but some functionality, like playing media over stream, won't be sent to your broadcast.


1. [Install NodeJS](https://nodejs.org/en/download/) as per their directions for your platform.
2. Clone my repository by running

    > **git clone https://github.com/LinuxLovah/TuxTwitchTalker**

	or [download](https://github.com/LinuxLovah/TuxTwitchTalker/archive/refs/heads/main.zip) and expand the contents into some directory.  If you clone the repository, it makes it much easier to keep it updated.  If you download the zip file, unzip it into an empty directory.
3. Open up a command line shell in the directory you cloned/unzipped TuxTwitchTalker into
4. Run **npm install** in that shell to install all the NodeJS modules the project depends on.
5. If you are running TuxTwitchTalker on your streaming computer and want the ability to play sounds on stream (a big part of the bot's functionality) you will need some sort of media player.  I find that the open source [VLC](https://www.videolan.org/) works very well for this purpose, is free and runs on almost anything.  The media player is configurable in the config file, but the sample config file already has the right parameters for VLC by default.

___
# Configuring TuxTwitchTalker

TuxTwitchTalker is configured using [a JSON file](https://en.wikipedia.org/wiki/JSON), which allows complex expressions and lists to flexibly customize it.  The default configuration file is **config.json**

There is a sample configuration file called **sample_config.json**.  It's important to note that JSON file doesn't support comments, so the documentation is included as JSON format as lines starting with **"COMMENT"**.
1. Copy **sample_config.json** to **config.json**
2. Edit config.json in your favorite text editor.  Do not use Word, or Wordpad, or any other word processing program that will change characters to non-ASCII characters.  On Windows, Notepad will work.
3. Follow the directions in the config file to fill in the rest of the file, like users to respond to, etc.  All sections that start with **"COMMENT** are just documentation to help you, and should not be changed.

The most important settings to update before the bot will run are:
- "BOT_NAME"
- "TMI_OAUTH"
- "IGNORE_USERS"
- "ADMIN_USERS"
- "CHANNELS"

___
# Running TuxTwitchTalker

1. Open up a terminal/command window and change to the directory you set up TuxTwitchTalker in
2. type
> npm start

If you need to specify an alternate configuration file, type
> npm start MY_CONFIGURATION_FILE.json


___
# Support/Contact

* [LinuxLovah@gmail.com](mailto:LinuxLovah@gmail.com)
* https://twitter.com/LinuxLovahTTV
* https://twitch.tv/LinuxLovah
* I offer support [on my Discord server](https://discord.gg/dJeFM2GpZN) in the **#streaming-tech-talk** channel

___
# Donations

I will NEVER charge for this bot. It will always be free open source.  If you would like to donate, though, [you can paypal me](https://www.paypal.com/donate/?business=MYYKAGE7725C4&no_recurring=0&currency_code=USD).

I also appreciate, though do not require, that you leave the periodic message in mentioning TuxTwitchTalker, even if it runs very infrequently.
